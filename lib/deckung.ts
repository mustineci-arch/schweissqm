// Deckungsprüfung – Tri-State. Keine Freigabe bei fehlenden Daten.
// Nur direkte Vergleiche gegen gespeicherte Bereiche. Normtabellen (z. B. ISO 15614-1
// Geltungsbereich) sind NICHT implementiert -> NICHT_BEWERTBAR.
export type Status = "GEDECKT" | "NICHT_GEDECKT" | "NICHT_BEWERTBAR";
export type Pruefpunkt = { parameter: string; soll: string; ist: string; regel: string; status: Status };

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "–" : String(v));

export function gesamt(punkte: Pruefpunkt[]): Status {
  if (punkte.some((p) => p.status === "NICHT_GEDECKT")) return "NICHT_GEDECKT";
  if (punkte.length === 0 || punkte.some((p) => p.status === "NICHT_BEWERTBAR")) return "NICHT_BEWERTBAR";
  return "GEDECKT";
}

export type WpsRev = { process: string; material_group: string | null; thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; positions: string[] | null };
export type Cert = { process: string; material_group: string | null; thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; diameter_max: number | null; positions: string[] | null; valid_until: string | null };
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

// Positionen: WPS verlangt eine Menge an Positionen, die Prüfbescheinigung muss sie alle abdecken
// (Menge aus iso9606.ts beim Erfassen der Prüfung berechnet, hier nur Mengenvergleich).
function positionen(wps: string[] | null, cert: string[] | null): Pruefpunkt {
  const regel = "Menge der WPS-Positionen muss in den qualifizierten Positionen der Prüfung enthalten sein";
  const soll = wps && wps.length ? wps.join(", ") : "–";
  const ist = cert && cert.length ? cert.join(", ") : "–";
  if (!wps || wps.length === 0 || !cert || cert.length === 0) return { parameter: "Position", soll, ist, regel, status: "NICHT_BEWERTBAR" };
  return { parameter: "Position", soll, ist, regel, status: wps.every((p) => cert.includes(p)) ? "GEDECKT" : "NICHT_GEDECKT" };
}

// Durchmesser: WPS speichert nur eine Mindestgröße (diameter_min), die Prüfung einen Bereich
// (diameter_min/diameter_max, max = null bedeutet nach oben offen, Tabelle 7 Fall D > 25).
function durchmesser(wpsMin: number | null, certMin: number | null, certMax: number | null): Pruefpunkt {
  const regel = "Rohrdurchmesser der WPS muss im qualifizierten Bereich der Prüfung liegen";
  const soll = wpsMin === null ? "–" : `≥ ${wpsMin} mm`;
  const ist = certMin === null ? "–" : `${certMin}–${certMax === null ? "∞" : certMax} mm`;
  if (wpsMin === null || certMin === null) return { parameter: "Durchmesser", soll, ist, regel, status: "NICHT_BEWERTBAR" };
  const gedeckt = certMin <= wpsMin && (certMax === null || certMax >= wpsMin);
  return { parameter: "Durchmesser", soll, ist, regel, status: gedeckt ? "GEDECKT" : "NICHT_GEDECKT" };
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
    bereich("Dicke (Blech oder Rohrwand)", wps.thickness_min, wps.thickness_max, cert.thickness_min, cert.thickness_max, regel),
    positionen(wps.positions, cert.positions),
    // Durchmesser nur relevant, wenn die WPS überhaupt einen Rohrdurchmesser fordert (sonst Blech-WPS).
    ...(wps.diameter_min !== null ? [durchmesser(wps.diameter_min, cert.diameter_min, cert.diameter_max)] : []),
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

// Deckungscheck je Naht: konkrete Naht gegen WPS-Revision und Schweißer-Prüfung.
// Nur direkte Vergleiche (gleiches Verfahren/gleiche Gruppe, Wert innerhalb gespeicherter Bereiche).
export type Naht = { material_group: string | null; thickness: number | null };

function imBereich(parameter: string, wert: number | null, min: number | null, max: number | null, quelle: string): Pruefpunkt {
  const soll = wert === null ? "–" : `${wert} mm`;
  const ist = `${s(min)}–${s(max)} mm`;
  const regel = `Naht-Wert innerhalb Bereich (${quelle})`;
  if (wert === null || min === null || max === null) return { parameter, soll, ist, regel, status: "NICHT_BEWERTBAR" };
  return { parameter, soll, ist, regel, status: wert >= min && wert <= max ? "GEDECKT" : "NICHT_GEDECKT" };
}

export function nahtGegenWpsUndSchweisser(naht: Naht, wps: WpsRev, cert: Cert, heute = new Date()): Pruefpunkt[] {
  const regel = "Direkter Vergleich";
  const gueltig = schweisserGegenWps(wps, cert, heute).find((p) => p.parameter === "Gültigkeit")!;
  return [
    eq("Verfahren (WPS ↔ Prüfung)", wps.process, cert.process, regel),
    eq("Werkstoffgruppe (Naht ↔ WPS)", naht.material_group, wps.material_group, regel),
    eq("Werkstoffgruppe (Naht ↔ Prüfung)", naht.material_group, cert.material_group, regel),
    imBereich("Dicke (Naht ↔ WPS)", naht.thickness, wps.thickness_min, wps.thickness_max, "WPS"),
    imBereich("Dicke (Naht ↔ Prüfung)", naht.thickness, cert.thickness_min, cert.thickness_max, "Prüfbescheinigung"),
    gueltig,
  ];
}
