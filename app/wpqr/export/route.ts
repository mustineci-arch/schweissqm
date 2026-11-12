import { ctx } from "@/lib/tenant";

const csvZelle = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const { sb, tenantId } = await ctx();
  if (!tenantId) return new Response("Nicht angemeldet", { status: 401 });
  const { data } = await sb.from("wpqr").select("*").order("wpqr_no");

  const kopf = ["WPQR-Nr", "Normausgabe", "Verfahren", "Werkstoffgruppe", "Prüfstückdicke", "Prüfstückdurchmesser", "Position", "Zusatzwerkstoff", "Berichtsdatum", "Prüfer", "AP-Intervall [Monate]"];
  const zeilen = [kopf.map(csvZelle).join(";")];
  for (const q of data ?? []) {
    zeilen.push([q.wpqr_no, q.standard_edition, q.process, q.material_group, q.thickness_test, q.diameter_test, q.position, q.filler, q.report_date, q.examiner, q.ap_interval_months].map(csvZelle).join(";"));
  }
  const csv = "﻿" + zeilen.join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="wpqr-export.csv"' } });
}
