// Normrechner DIN EN ISO 9606-1: berechnet aus der rohen Prüfbezeichnung (Produktform,
// Nahtart, Prüfstück-Dicke/-Durchmesser, Prüfposition) den gültigen Geltungsbereich, und
// stellt die Qualifikationsmatrizen für Verfahren und Werkstoffgruppen bereit.
// Portiert und 1:1 übernommen aus der bereits fachlich genutzten App
// https://iso9606-audit-engine.vercel.app/ (iso9606.html) – dort als Normrechner/Audit-Engine im Einsatz.
// Die Norm wird nur hier interpretiert; deckung.ts nutzt diese Funktionen als fertige
// Entscheidungsregeln und vergleicht sonst nur noch direkt (gespeicherte Bereiche/Mengen).

export type Produktform = "P" | "T";
export type Nahtart = "BW" | "FW";

// Tabelle 9 (BW/Stumpfnaht) und Tabelle 10 (FW/Kehlnaht): Prüfposition -> qualifizierte Positionen.
export const POSITION_MATRIX_BW: Record<string, string[]> = {
  PA: ["PA"], PC: ["PA", "PC"], PE: ["PA", "PE"], PF: ["PA", "PF"], PG: ["PA", "PG"],
  PH: ["PA", "PE", "PF"], PJ: ["PA", "PG", "PJ"],
  HL045: ["PA", "PC", "PE", "PF", "HL045"], JL045: ["PA", "PC", "PG", "JL045"],
};
export const POSITION_MATRIX_FW: Record<string, string[]> = {
  PA: ["PA"], PB: ["PA", "PB"], PC: ["PA", "PB", "PC"], PD: ["PA", "PB", "PC", "PD", "PE"],
  PE: ["PA", "PB", "PC", "PD", "PE"], PF: ["PA", "PB", "PF"], PH: ["PA", "PB", "PC", "PD", "PE", "PF"],
  PG: ["PG"], PJ: ["PA", "PB", "PD", "PE", "PG"],
};

export type Bereich = { min: number | null; max: number | null };

// Abschnitt 5.4/Tabelle 6: Dicke s bei Stumpfnaht (BW). 111-Sonderfall: Faktor 1,5 statt 2.
export function bwThicknessRange(s: number | null, processes: string[]): Bereich {
  if (!s) return { min: null, max: null };
  const faktor = processes.includes("311") ? 1.5 : 2;
  if (s < 3) return { min: s, max: Math.max(3, faktor * s) };
  if (s < 12) return { min: 3, max: faktor * s };
  return { min: 3, max: Infinity };
}

// Tabelle 8: Dicke t bei Kehlnaht (FW).
export function fwThicknessRange(t: number | null): Bereich {
  if (!t) return { min: null, max: null };
  if (t < 3) return { min: t, max: Math.max(3, 2 * t) };
  return { min: 3, max: Infinity };
}

// Tabelle 7: Rohr-Außendurchmesser D, nur bei Produktform T (Rohr) relevant.
export function diameterRange(D: number | null, produkt: Produktform | null): Bereich {
  if (produkt && produkt !== "T") return { min: null, max: null };
  if (!D) return { min: null, max: null };
  if (D <= 25) return { min: D, max: 2 * D };
  return { min: Math.max(0.5 * D, 25), max: Infinity };
}

export type PositionEingabe = {
  nahtart: Nahtart;
  produkt: Produktform;
  position: string; // Prüfposition, z. B. "PH"
  durchmesser: number | null; // Rohr-Außendurchmesser D der Prüfung
  hatPC: boolean; // Zusatzprüfung in Zwangslage PC vorhanden (Abschnitt 5.8)
  mehrfachlage: boolean; // 2/3 + 1/3-Umfangsprüfung (Abschnitt 5.8, D ≥ 150)
  richtung: "steigend" | "fallend";
};

// Abschnitt 5.8: Sonderregeln für Rohre in Zwangslage (PH/PJ + PC, bzw. D ≥ 150 Umfangsprüfung).
function positionsErweiterung(e: PositionEingabe): string[] {
  const extra = new Set<string>();
  if (e.produkt !== "T") return [];
  if (e.position === "PH" && e.hatPC) extra.add("HL045");
  if (e.position === "PJ" && e.hatPC) extra.add("JL045");
  if ((e.durchmesser ?? 0) >= 150 && e.mehrfachlage && e.hatPC && (e.position === "PH" || e.position === "PJ")) {
    if (e.position === "PH" || e.richtung === "steigend") ["PA", "PB", "PC", "PD", "PE", "PF", "PH", "HL045"].forEach((p) => extra.add(p));
    if (e.position === "PJ" || e.richtung === "fallend") ["PA", "PB", "PC", "PD", "PE", "PG", "PJ", "JL045"].forEach((p) => extra.add(p));
  }
  return [...extra];
}

// Tabelle 9/10 + Abschnitt 5.8: berechnet die vollständige Menge qualifizierter Positionen.
export function positionScope(e: PositionEingabe): string[] {
  const matrix = e.nahtart === "FW" ? POSITION_MATRIX_FW : POSITION_MATRIX_BW;
  const basis = matrix[e.position] ?? [];
  return [...new Set([...basis, ...positionsErweiterung(e)])];
}

// Abschnitt 5.2: Verfahren-Äquivalenzen bei der Prüfung (geprüftes Verfahren qualifiziert auch das
// gleichwertige Partnerverfahren). Kurzschluss-Übergang (Transfer "D") bei 131/135/138 ist hier NICHT
// abgebildet, weil schweissqm die Übergangsart der Prüfung aktuell nicht erfasst.
const PROZESS_AEQUIVALENZ: Record<string, string[]> = {
  "135": ["135", "138"], "138": ["135", "138"],
  "121": ["121", "125"], "125": ["121", "125"],
  "141": ["141", "143", "145"], "143": ["141", "143", "145"], "145": ["141", "143", "145"],
  "142": ["142"],
};
export function verfahrenGedeckt(testProzess: string, jobProzess: string): boolean {
  return (PROZESS_AEQUIVALENZ[testProzess] ?? [testProzess]).includes(jobProzess);
}

// Werkstoffgruppen-Qualifikationsmatrix nach CEN ISO/TR 15608 (Abschnitt 5.5): eine Prüfung in
// Gruppe X qualifiziert oft auch andere, "leichtere" Gruppen – kein reiner Gleichheitsvergleich.
export const WERKSTOFFGRUPPEN_QUALIFIKATION: Record<string, string[]> = {
  "1.1": ["1.1"],
  "1.2": ["1.1", "1.2"],
  "1.3": ["1.1", "1.2", "1.3", "2.1"],
  "1.4": ["1.1", "1.2", "1.4"],
  "2.1": ["1.1", "1.2", "1.3", "2.1"],
  "2.2": ["1.2", "1.3", "2.1", "2.2"],
  "3.1": ["1.2", "1.3", "2.1", "2.2", "3.1"],
  "3.2": ["2.2", "3.1", "3.2"],
  "7.1": ["7.1"],
  "8.1 ohne Mo": ["8.1 ohne Mo"],
  "8.1": ["8.1"],
  "11": ["11"],
  "21": ["21"],
  "22.2": ["22.2", "22.3", "22.4"],
  "22.3": ["22.3"],
  "22.4": ["22.2", "22.3", "22.4"],
  "23.1": ["23.1", "23.2"],
  "23.2": ["23.1", "23.2"],
  "24.1": ["24.1", "24.2"],
  "24.2": ["24.1", "24.2"],
  "71": ["71"],
  "72": ["72"],
  "73": ["73"],
};
export function werkstoffgruppeGedeckt(testGruppe: string, jobGruppe: string): boolean {
  return (WERKSTOFFGRUPPEN_QUALIFIKATION[testGruppe] ?? [testGruppe]).includes(jobGruppe);
}

// Abschnitt 5.3: Produktform (Blech P / Rohr T). Rohrprüfung mit D > 25 mm qualifiziert auch
// Blech. Eine Blechprüfung qualifiziert ein Rohr nur bei fest eingespanntem Rohr D ≥ 500 mm
// oder rotierendem Rohr D ≥ 75 mm in den Positionen PA/PB/PC/PD.
export type ProduktformEingabe = {
  testProdukt: Produktform; jobProdukt: Produktform; testDurchmesser: number | null;
  jobDurchmesser: number | null; jobPositionen: string[] | null; festRohr: boolean; rotierendRohr: boolean;
};
export function produktformGedeckt(e: ProduktformEingabe): boolean {
  if (e.testProdukt === e.jobProdukt) return true;
  if (e.testProdukt === "T" && e.jobProdukt === "P") return (e.testDurchmesser ?? 0) > 25;
  if (e.testProdukt === "P" && e.jobProdukt === "T") {
    if (e.festRohr && (e.jobDurchmesser ?? 0) >= 500) return true;
    if (e.rotierendRohr && (e.jobDurchmesser ?? 0) >= 75 && (e.jobPositionen ?? []).every((p) => ["PA", "PB", "PC", "PD"].includes(p))) return true;
    return false;
  }
  return false;
}

// Tabelle 2/3: FM-Gruppe des Zusatzwerkstoffs (geprüfte Gruppe qualifiziert "leichtere" Gruppen).
const FM_SCOPE: Record<string, string[]> = {
  FM1: ["FM1", "FM2"], FM2: ["FM1", "FM2"], FM3: ["FM1", "FM2", "FM3"],
  FM4: ["FM1", "FM2", "FM3", "FM4"], FM5: ["FM5"], FM6: ["FM5", "FM6"],
};
export function fmGruppeGedeckt(testFm: string, jobFm: string): boolean {
  return (FM_SCOPE[testFm] ?? [testFm]).includes(jobFm);
}

// Tabelle 5: Schweißzusatzart (Massivdraht/Stab S, Metallpulver M, Fülldrahtgruppen B/R/PZ/V/W/Y/Z, Zellulose C).
const ZUSATZART_SCOPE: Record<string, string[]> = {
  S: ["S", "M"], M: ["S", "M"],
  B: ["B", "R", "PZ", "V", "W", "Y", "Z"], R: ["R", "PZ", "V", "W", "Y", "Z"], PZ: ["R", "PZ", "V", "W", "Y", "Z"],
  V: ["R", "PZ", "V", "W", "Y", "Z"], W: ["R", "PZ", "V", "W", "Y", "Z"], Y: ["R", "PZ", "V", "W", "Y", "Z"], Z: ["R", "PZ", "V", "W", "Y", "Z"],
  C: ["C"],
};
export function zusatzartGedeckt(testZusatzart: string, jobZusatzart: string): boolean {
  return (ZUSATZART_SCOPE[testZusatzart] ?? [testZusatzart]).includes(jobZusatzart);
}

// Tabelle 11: Schweißdetail (ss_nb einseitig ohne Badsicherung, ss_mb mit Badsicherung, bs beidseitig, ...).
const DETAIL_SCOPE: Record<string, string[]> = {
  ss_nb: ["ss_nb", "ss_mb", "bs", "ss_gb", "ss_fb"], ss_mb: ["ss_mb", "bs"], bs: ["ss_mb", "bs"],
  ss_gb: ["ss_mb", "bs", "ss_gb"], ci: ["ss_mb", "bs", "ci"], ss_fb: ["ss_mb", "bs", "ss_fb"],
};
export function schweissdetailGedeckt(testDetail: string, jobDetail: string): boolean {
  return (DETAIL_SCOPE[testDetail] ?? [testDetail]).includes(jobDetail);
}

// Tabelle 12: Lagenaufbau (mehrlagig sl qualifiziert auch mehrlagig ml nicht automatisch umgekehrt).
const LAGENAUFBAU_SCOPE: Record<string, string[]> = { sl: ["sl"], ml: ["sl", "ml"] };
export function lagenaufbauGedeckt(testLage: string, jobLage: string): boolean {
  return (LAGENAUFBAU_SCOPE[testLage] ?? [testLage]).includes(jobLage);
}
