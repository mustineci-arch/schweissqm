// Deckungsprüfung – Tri-State. Keine Freigabe bei fehlenden Daten.
// Nur direkte Vergleiche gegen gespeicherte Bereiche. Normtabellen (z. B. ISO 15614-1
// Geltungsbereich Blechdicke) sind NICHT implementiert -> NICHT_BEWERTBAR.
export type Status = "GEDECKT" | "NICHT_GEDECKT" | "NICHT_BEWERTBAR";
export type Pruefpunkt = { parameter: string; soll: string; ist: string; regel: string; status: Status };

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "–" : String(v));

export function gesamt(punkte: Pruefpunkt[]): Status {
  if (punkte.some((p) => p.status === "NICHT_GEDECKT")) return "NICHT_GEDECKT";
  if (punkte.length === 0 || punkte.some((p) => p.status === "NICHT_BEWERTBAR")) return "NICHT_BEWERTBAR";
  return "GEDECKT";
}

export type WpsRev = { process: string; material_group: string | null; thickness_min: number | null; thickness_max: number | null; diameter_min: number | null };
export type Cert = { process: string; material_group: string | null; thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; valid_until: string | null };
export type Wpqr = { process: string; material_group: string | null };

function eq(parameter: string, soll: string | null, ist: string | null, regel: string): Pruefpunkt {
  if (!soll || !ist) return { parameter, soll: s(soll), ist: s(ist), regel, status: "NICHT_BEWERTBAR" };
  return { parameter, soll, ist, regel, status: soll.trim().toLowerCase() === ist.trim().toLowerCase() ? "GEDECKT" : "NICHT_GEDECKT" };
}

function bereich(parameter: string, wmin: number | null, wmax: number | null, cmin: number | null, cmax: number | null, regel: string): Pruefpunkt {
  const soll = `${s(wmin)}–${s(wmax)} mm`;
  const ist = `${s(cmin)}–${s(cmax)} mm`;
  if (wmin === null || wmax === null || cmin === null || cmax === null)
    return { parameter, soll, ist, regel, status: "NICHT_BEWERTBAR" };
  return { parameter, soll, ist, regel, status: cmin <= wmin && cmax >= wmax ? "GEDECKT" : "NICHT_GEDECKT" };
}

export function schweisserGegenWps(wps: WpsRev, cert: Cert, heute = new Date()): Pruefpunkt[] {
  const regel = "Direkter Vergleich mit Bereich der Prüfbescheinigung";
  let gueltig: Pruefpunkt;
  if (!cert.valid_until) gueltig = { parameter: "Gültigkeit", soll: "≥ heute", ist: "–", regel, status: "NICHT_BEWERTBAR" };
  else gueltig = { parameter: "Gültigkeit", soll: "≥ heute", ist: cert.valid_until, regel,
    status: new Date(cert.valid_until + "T23:59:59") >= heute ? "GEDECKT" : "NICHT_GEDECKT" };
  return [
    eq("Verfahren", wps.process, cert.process, regel),
    eq("Werkstoffgruppe", wps.material_group, cert.material_group, regel),
    bereich("Blechdicke", wps.thickness_min, wps.thickness_max, cert.thickness_min, cert.thickness_max, regel),
    gueltig,
  ];
}

export function wpsGegenWpqr(wps: WpsRev, q: Wpqr): Pruefpunkt[] {
  const regel = "Direkter Vergleich";
  return [
    eq("Verfahren", wps.process, q.process, regel),
    eq("Werkstoffgruppe", wps.material_group, q.material_group, regel),
    { parameter: "Geltungsbereich Dicke/Durchmesser/Position", soll: "–", ist: "–",
      regel: "ISO 15614-1 Geltungsbereich: Regelset nicht validiert", status: "NICHT_BEWERTBAR" },
  ];
}
