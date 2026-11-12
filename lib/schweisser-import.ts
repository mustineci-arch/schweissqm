// Gruppiert die Zeilen des Schweißer-Excel-/CSV-Exports (eine Zeile je Zertifikat) wieder zu
// einem Schweißer-Datensatz mit mehreren Zertifikaten – Gegenstück zu app/schweisser/export/route.ts.
export type ImportZertifikat = {
  cert_no: string | null; process: string; bezeichnung: string | null; material_group: string | null;
  thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; diameter_max: number | null;
  positions: string[] | null; valid_until: string | null; last_confirmed_on: string | null;
};
export type ImportSchweisser = {
  name: string; stamp: string | null; birthdate: string | null; employer: string | null; active: boolean;
  certs: ImportZertifikat[];
};

const leer = (s: string | undefined) => (s ?? "").trim() || null;
const zahl = (s: string | undefined) => { const v = parseFloat((s ?? "").replace(",", ".")); return Number.isFinite(v) ? v : null; };

export function schweisserAusCsvZeilen(rows: Record<string, string>[]): ImportSchweisser[] {
  const gruppen = new Map<string, ImportSchweisser>();
  for (const r of rows) {
    const name = (r["Name"] ?? "").trim();
    if (!name) continue;
    const schluessel = name.toLowerCase();
    if (!gruppen.has(schluessel)) {
      gruppen.set(schluessel, {
        name, stamp: leer(r["Zeichen"]), birthdate: leer(r["Geburtsdatum"]), employer: leer(r["Arbeitgeber"]),
        active: (r["Aktiv"] ?? "ja").trim().toLowerCase() !== "nein", certs: [],
      });
    }
    const hatZertifikat = leer(r["Zert.-Nr."]) || leer(r["Bezeichnung"]);
    const process = leer(r["Verfahren"]);
    // Verfahren ist in der DB Pflichtfeld (welder_certificates.process NOT NULL) - eine Zertifikat-Zeile
    // ohne Verfahren (z. B. aus einer älteren Export-Version ohne diese Spalte) wird übersprungen,
    // statt einen DB-Fehler zu riskieren.
    if (hatZertifikat && process) {
      gruppen.get(schluessel)!.certs.push({
        cert_no: leer(r["Zert.-Nr."]), process, bezeichnung: leer(r["Bezeichnung"]), material_group: leer(r["Werkstoffgruppe"]),
        thickness_min: zahl(r["Dicke min"]), thickness_max: zahl(r["Dicke max"]),
        diameter_min: zahl(r["Durchmesser min"]), diameter_max: zahl(r["Durchmesser max"]),
        positions: leer(r["Positionen"]) ? r["Positionen"].split(/[\s,;]+/).map((p) => p.toUpperCase()).filter(Boolean) : null,
        valid_until: leer(r["Gültig bis"]), last_confirmed_on: leer(r["Zuletzt bestätigt"]),
      });
    }
  }
  return [...gruppen.values()];
}
