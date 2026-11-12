// Wandelt Zeilen des WPQR-Excel-/CSV-Exports zurück in wpqr-Datensätze (eine Zeile je WPQR).
export type ImportWpqr = {
  wpqr_no: string; standard_edition: string | null; process: string | null; material_group: string | null;
  thickness_test: number | null; diameter_test: number | null; position: string | null; filler: string | null;
  report_date: string | null; examiner: string | null; ap_interval_months: number | null;
};

const leer = (s: string | undefined) => (s ?? "").trim() || null;
const zahl = (s: string | undefined) => { const v = parseFloat((s ?? "").replace(",", ".")); return Number.isFinite(v) ? v : null; };
const ganzzahl = (s: string | undefined) => { const v = parseInt((s ?? "").trim(), 10); return Number.isFinite(v) ? v : null; };

export function wpqrAusCsvZeilen(rows: Record<string, string>[]): ImportWpqr[] {
  return rows
    .map((r) => ({
      wpqr_no: (r["WPQR-Nr"] ?? "").trim(),
      standard_edition: leer(r["Normausgabe"]), process: leer(r["Verfahren"]), material_group: leer(r["Werkstoffgruppe"]),
      thickness_test: zahl(r["Prüfstückdicke"]), diameter_test: zahl(r["Prüfstückdurchmesser"]),
      position: leer(r["Position"]), filler: leer(r["Zusatzwerkstoff"]), report_date: leer(r["Berichtsdatum"]),
      examiner: leer(r["Prüfer"]), ap_interval_months: ganzzahl(r["AP-Intervall [Monate]"]),
    }))
    .filter((w) => w.wpqr_no);
}
