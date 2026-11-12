import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ctx } from "@/lib/tenant";

const clean = (t: string) => t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x20-\x7E -ÿ–]/g, "?");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, tenantId } = await ctx();
  if (!tenantId) return new Response("Nicht angemeldet", { status: 401 });
  const { data: p } = await sb.from("ap_protokolle").select("*,wpqr(*),welders(*)").eq("id", id).maybeSingle();
  if (!p) return new Response("Nicht gefunden", { status: 404 });
  const { data: settings } = await sb.from("tenant_settings").select("*").maybeSingle();

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 800;
  const L = 50;
  const line = (t: string, f: PDFFont = font, s = 11, color = rgb(0, 0, 0)) => { page.drawText(clean(t), { x: L, y, size: s, font: f, color }); y -= s + 8; };

  line("AP-Protokoll – Arbeitsprüfung", bold, 16);
  line("nach AD 2000 – Merkblatt HP 5/2", font, 10, rgb(0.3, 0.3, 0.3));
  y -= 8;
  if (settings?.firma) line(`Hersteller: ${settings.firma}`);
  if (settings?.adresse) line(`Ort der Schweißung: ${settings.adresse}`);
  y -= 8;
  line(`WPQR: ${p.wpqr?.wpqr_no ?? "-"} (Verfahren ${p.wpqr?.process ?? "-"})`, bold);
  line(`Schweißer: ${p.welders?.name ?? "-"}`);
  line(`AP-Datum: ${p.ap_datum}`);
  if (p.pruefstueck) line(`Arbeitsprüfstück: ${p.pruefstueck}`);
  if (p.weitere_angaben) line(`Weitere Angaben: ${p.weitere_angaben}`);
  if (p.bemerkung) line(`Bemerkung: ${p.bemerkung}`);
  y -= 30;
  line(`Ort, Datum: ${settings?.ort_unterschrift ?? "_______________"}, ${new Date().toISOString().slice(0, 10)}`);
  y -= 20;
  line("Unterschrift Schweißaufsichtsperson: _______________________________");

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="ap-protokoll-${p.ap_datum}.pdf"` } });
}
