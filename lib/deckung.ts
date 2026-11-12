// Deckungsprüfung – Tri-State. Keine Freigabe bei fehlenden Daten.
// Vergleiche gegen gespeicherte Bereiche/Mengen bzw. die Qualifikationsregeln aus iso9606.ts
// (dort steht, welche Norm welche Regel ist). Der WPS-gegen-WPQR-Vergleich (ISO 15614-1
// Geltungsbereich) ist NICHT implementiert -> NICHT_BEWERTBAR.
import { verfahrenGedeckt, werkstoffgruppeGedeckt, produktformGedeckt, fmGruppeGedeckt, zusatzartGedeckt, schweissdetailGedeckt, lagenaufbauGedeckt } from "./iso9606";
export type Status = "GEDECKT" | "NICHT_GEDECKT" | "NICHT_BEWERTBAR";
export type Pruefpunkt = { parameter: string; soll: string; ist: string; regel: string; status: Status };

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "–" : String(v));

export function gesamt(punkte: Pruefpunkt[]): Status {
  if (punkte.some((p) => p.status === "NICHT_GEDECKT")) return "NICHT_GEDECKT";
  if (punkte.length === 0 || punkte.some((p) => p.status === "NICHT_BEWERTBAR")) return "NICHT_BEWERTBAR";
  return "GEDECKT";
}

export type WpsRev = {
  process: string; material_group: string | null; joint_type: string | null; product_type: string | null;
  fm_group: string | null; filler_type: string | null; weld_detail: string | null; layer_build: string | null;
  thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; positions: string[] | null;
};
export type Cert = {
  process: string; material_group: string | null; joint_type: string | null; product_type: string | null;
  fm_group: string | null; filler_type: string | null; weld_detail: string | null; layer_build: string | null;
  thickness_min: number | null; thickness_max: number | null; diameter_min: number | null; diameter_max: number | null;
  positions: string[] | null; has_fillet_test: boolean; combined_joint_test: boolean; test_thickness: number | null;
  test_diameter: number | null; fixed_pipe: boolean; rotating_pipe: boolean; valid_until: string | null;
};
export type Wpqr = { process: string; material_group: string | null };

function eq(parameter: string, soll: string | null, ist: string | null, regel: string): Pruefpunkt {
  if (!soll || !ist) return { parameter, soll: s(soll), ist: s(ist), regel, status: "NICHT_BEWERTBAR" };
  return { parameter, soll, ist, regel, status: soll.trim().toLowerCase() === ist.trim().toLowerCase() ? "GEDECKT" : "NICHT_GEDECKT" };
}

// Wie eq(), aber mit einer Qualifikationsregel statt reiner Gleichheit (test = Prüfung/Ist,
// job = WPS-Vorgabe/Soll), z. B. Verfahrens-Äquivalenzen oder Werkstoffgruppen-Hierarchie.
function qualifiziert(parameter: string, soll: string | null, ist: string | null, deckt: (test: string, job: string) => boolean, regel: string): Pruefpunkt {
  if (!soll || !ist) return { parameter, soll: s(soll), ist: s(ist), regel, status: "NICHT_BEWERTBAR" };
  return { parameter, soll, ist, regel, status: deckt(ist, soll) ? "GEDECKT" : "NICHT_GEDECKT" };
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

// Nahtart (BW Stumpfnaht / FW Kehlnaht), DIN EN ISO 9606-1 Abschnitt 5.4:
// Gleiche Nahtart qualifiziert immer. BW qualifiziert FW nur mit Zusatzprüfung Kehlnaht
// oder kombinierter Prüfung (dann zusätzlich Dicke ≥ 10 mm). FW qualifiziert BW nie.
function nahtart(wps: string | null, cert: Cert): Pruefpunkt {
  const regel = "DIN EN ISO 9606-1 Abschnitt 5.4";
  const soll = s(wps), ist = s(cert.joint_type);
  if (!wps || !cert.joint_type) return { parameter: "Nahtart", soll, ist, regel, status: "NICHT_BEWERTBAR" };
  if (wps === cert.joint_type) return { parameter: "Nahtart", soll, ist, regel, status: "GEDECKT" };
  if (cert.joint_type === "BW" && wps === "FW") {
    if (cert.has_fillet_test) return { parameter: "Nahtart", soll, ist: ist + " + Zusatzprüfung Kehlnaht", regel, status: "GEDECKT" };
    if (cert.combined_joint_test) {
      if (cert.test_thickness === null) return { parameter: "Nahtart", soll, ist: ist + " + kombinierte Prüfung (Prüfstückdicke fehlt)", regel, status: "NICHT_BEWERTBAR" };
      const dickeOk = cert.test_thickness >= 10;
      return { parameter: "Nahtart", soll, ist: ist + ` + kombinierte Prüfung (Prüfstückdicke ${cert.test_thickness} mm)`, regel,
        status: dickeOk ? "GEDECKT" : "NICHT_GEDECKT" };
    }
    return { parameter: "Nahtart", soll, ist, regel, status: "NICHT_GEDECKT" };
  }
  return { parameter: "Nahtart", soll, ist, regel, status: "NICHT_GEDECKT" };
}

// Produktform (Blech P / Rohr T), DIN EN ISO 9606-1 Abschnitt 5.3.
function produktform(wps: WpsRev, cert: Cert): Pruefpunkt {
  const regel = "DIN EN ISO 9606-1 Abschnitt 5.3";
  const soll = s(wps.product_type), ist = s(cert.product_type);
  if (!wps.product_type || !cert.product_type) return { parameter: "Produktform", soll, ist, regel, status: "NICHT_BEWERTBAR" };
  const gedeckt = produktformGedeckt({
    testProdukt: cert.product_type as "P" | "T", jobProdukt: wps.product_type as "P" | "T",
    testDurchmesser: cert.test_diameter, jobDurchmesser: wps.diameter_min, jobPositionen: wps.positions,
    festRohr: cert.fixed_pipe, rotierendRohr: cert.rotating_pipe,
  });
  return { parameter: "Produktform", soll, ist, regel, status: gedeckt ? "GEDECKT" : "NICHT_GEDECKT" };
}

export function schweisserGegenWps(wps: WpsRev, cert: Cert, heute = new Date()): Pruefpunkt[] {
  const regel = "Direkter Vergleich mit Bereich der Prüfbescheinigung";
  let gueltig: Pruefpunkt;
  if (!cert.valid_until) gueltig = { parameter: "Gültigkeit", soll: "≥ heute", ist: "–", regel, status: "NICHT_BEWERTBAR" };
  else gueltig = { parameter: "Gültigkeit", soll: "≥ heute", ist: cert.valid_until, regel,
    status: new Date(cert.valid_until + "T23:59:59") >= heute ? "GEDECKT" : "NICHT_GEDECKT" };
  return [
    qualifiziert("Verfahren", wps.process, cert.process, verfahrenGedeckt, "DIN EN ISO 9606-1 Abschnitt 5.2 (Verfahrens-Äquivalenzen)"),
    qualifiziert("Werkstoffgruppe", wps.material_group, cert.material_group, werkstoffgruppeGedeckt, "CEN ISO/TR 15608 Werkstoffgruppen-Qualifikation"),
    nahtart(wps.joint_type, cert),
    bereich("Dicke (Blech oder Rohrwand)", wps.thickness_min, wps.thickness_max, cert.thickness_min, cert.thickness_max, regel),
    positionen(wps.positions, cert.positions),
    // Die folgenden Kriterien sind optional: nur geprüft, wenn die WPS sie überhaupt fordert,
    // sonst blockieren sie Projekte, die diese Angabe gar nicht brauchen.
    ...(wps.product_type !== null ? [produktform(wps, cert)] : []),
    ...(wps.diameter_min !== null ? [durchmesser(wps.diameter_min, cert.diameter_min, cert.diameter_max)] : []),
    ...(wps.fm_group !== null ? [qualifiziert("FM-Gruppe", wps.fm_group, cert.fm_group, fmGruppeGedeckt, "DIN EN ISO 9606-1 Tabelle 2/3")] : []),
    ...(wps.filler_type !== null ? [qualifiziert("Schweißzusatzart", wps.filler_type, cert.filler_type, zusatzartGedeckt, "DIN EN ISO 9606-1 Tabelle 5")] : []),
    ...(wps.weld_detail !== null ? [qualifiziert("Schweißdetail", wps.weld_detail, cert.weld_detail, schweissdetailGedeckt, "DIN EN ISO 9606-1 Tabelle 11")] : []),
    ...(wps.layer_build !== null ? [qualifiziert("Lagenaufbau", wps.layer_build, cert.layer_build, lagenaufbauGedeckt, "DIN EN ISO 9606-1 Tabelle 12")] : []),
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

// Enthält ALLE Kriterien aus schweisserGegenWps (Verfahren, Werkstoffgruppe, Produktform, Nahtart,
// Dicke, Position, FM-Gruppe, Zusatzart, Detail, Lagenaufbau, Durchmesser, Gültigkeit) plus die
// Naht-spezifischen Vergleiche gegen den tatsächlich gemessenen Wert der Naht. So blockiert die
// Naht-Zuordnung (lib/zuordnung.ts) bei jeder fehlenden Qualifikation, nicht nur bei einem Teil davon.
export function nahtGegenWpsUndSchweisser(naht: Naht, wps: WpsRev, cert: Cert, heute = new Date()): Pruefpunkt[] {
  return [
    ...schweisserGegenWps(wps, cert, heute),
    eq("Werkstoffgruppe (Naht ↔ WPS)", naht.material_group, wps.material_group, "Direkter Vergleich"),
    qualifiziert("Werkstoffgruppe (Naht ↔ Prüfung)", naht.material_group, cert.material_group, werkstoffgruppeGedeckt, "CEN ISO/TR 15608 Werkstoffgruppen-Qualifikation"),
    imBereich("Dicke (Naht ↔ WPS)", naht.thickness, wps.thickness_min, wps.thickness_max, "WPS"),
    imBereich("Dicke (Naht ↔ Prüfung)", naht.thickness, cert.thickness_min, cert.thickness_max, "Prüfbescheinigung"),
  ];
}
