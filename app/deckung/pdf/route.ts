import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ctx } from "@/lib/tenant";
import { ladeDeckung } from "@/lib/deckung-load";

// Standardschrift (WinAnsi): Zeichen außerhalb ersetzen
const clean = (t: string) => t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/↔/g, "<->").replace(/[^\x20-\x7E -ÿ–]/g, "?");

function fit(text: string, font: PDFFont, size: number, width: number) {
  let t = clean(text);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > width) t = t.slice(0, -1);
  return t;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const { sb, tenantId, role } = await ctx();
  if (!tenantId) return new Response("Nicht angemeldet", { status: 401 });
  const { r, w, q, blocks, gesamt } = await ladeDeckung(sb, {
    rev: u.searchParams.get("rev") ?? undefined, welder: u.searchParams.get("welder") ?? undefined, wpqr: u.searchParams.get("wpqr") ?? undefined,
  });
  if (blocks.length === 0) return new Response("Keine Auswahl", { status: 400 });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]); let y = 800;
  const L = 40, W = 515;
  const line = (t: string, f = font, s = 10, color = rgb(0, 0, 0)) => {
    if (y < 60) { page = doc.addPage([595, 842]); y = 800; }
    page.drawText(fit(t, f, s, W), { x: L, y, size: s, font: f, color }); y -= s + 6;
  };
  const farbe = (s: string) => (s === "GEDECKT" ? rgb(0.04, 0.49, 0.2) : s === "NICHT_GEDECKT" ? rgb(0.7, 0.15, 0.12) : rgb(0.54, 0.38, 0));

  line("Nachweis Deckungspruefung", bold, 16); y -= 4;
  line(`Erstellt: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC | Rolle: ${role}`);
  if (r) line(`WPS: ${r.wps?.wps_no} Rev. ${r.revision} (Status: ${r.status}) | Verfahren ${r.process} | Werkstoff ${r.material_group ?? "-"}`);
  if (w) line(`Schweisser: ${w.name}`);
  if (q) line(`WPQR: ${q.wpqr_no}`);
  y -= 8;

  const cols = [110, 90, 90, 150, 75]; const heads = ["Parameter", "Soll (WPS)", "Ist (Nachweis)", "Regel", "Ergebnis"];
  for (const b of blocks) {
    const g = gesamt(b.punkte);
    y -= 6; line(`${b.titel}: ${g}`, bold, 12, farbe(g));
    if (b.punkte.length === 0) continue;
    const row = (cells: string[], f: PDFFont, colors?: (ReturnType<typeof rgb> | undefined)[]) => {
      if (y < 60) { page = doc.addPage([595, 842]); y = 800; }
      let x = L;
      cells.forEach((c, i) => { page.drawText(fit(c, f, 9, cols[i] - 4), { x, y, size: 9, font: f, color: colors?.[i] ?? rgb(0, 0, 0) }); x += cols[i]; });
      y -= 14;
    };
    row(heads, bold);
    for (const p of b.punkte) row([p.parameter, p.soll, p.ist, p.regel, p.status], font, [undefined, undefined, undefined, undefined, farbe(p.status)]);
  }
  y -= 10;
  line("Hinweis: Geltungsbereiche nach Norm sind nicht als validiertes Regelset hinterlegt (NICHT_BEWERTBAR).", font, 8);
  line("Dieser Nachweis ersetzt nicht die fachliche Freigabe durch die Schweissaufsicht.", font, 8);

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="deckungsnachweis.pdf"' } });
}
