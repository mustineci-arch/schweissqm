// Durchsuchbare Normregel-Übersicht für den Decoder – 1:1 inhaltlich an
// https://iso9606-audit-engine.vercel.app/iso9606.html (Tab "Normregeln", NORM_RULES_VIEW)
// angelehnt. Wo die Referenz-App eine bereits bei uns berechnete Matrix anzeigt (Verfahren,
// FM-Gruppen, Werkstoffgruppen, Schweißzusatzarten, Schweißdetails, Lagenaufbau, Tabelle 10),
// wird hier NICHT erneut hartcodiert, sondern direkt aus lib/iso9606.ts/lib/norm-namen.ts
// abgeleitet – damit diese Übersicht nie von der tatsächlich angewendeten Logik abweichen kann.
import {
  PROZESS_AEQUIVALENZ, FM_SCOPE, ZUSATZART_SCOPE, DETAIL_SCOPE, LAGENAUFBAU_SCOPE,
  WERKSTOFFGRUPPEN_QUALIFIKATION, POSITION_MATRIX_FW,
} from "./iso9606";
import {
  VERFAHREN_NAMEN, FM_NAMEN, SCHWEISSZUSATZART_NAMEN, SCHWEISSDETAIL_NAMEN,
  LAGENAUFBAU_NAMEN, WERKSTOFFGRUPPEN_NAMEN, POSITION_NAMEN,
} from "./norm-namen";

export type NormRegel = { key: string; title: string; headers: [string, string]; rows: [string, string][]; note?: string };

const mitNamen = (code: string, namen: Record<string, string>) => (namen[code] ? `${code} · ${namen[code]}` : code);

export const NORM_REGELN: NormRegel[] = [
  {
    key: "position58",
    title: "Abschnitt 5.8 – Schweißpositionen mit Tabelle 9 (BW) und Tabelle 10 (FW)",
    headers: ["Fall", "Geltungsbereich / Bedeutung"],
    rows: [
      ["Grundregel", "Geltungsbereich jeder Position nach Tabelle 9 (BW) bzw. Tabelle 10 (FW); Kurzzeichen nach ISO 6947"],
      ["PH + PC", "qualifiziert HL045 (steigend)"],
      ["PJ + PC", "qualifiziert JL045 (fallend)"],
      ["D ≥ 150 mm mit PH/PJ 2/3 Umfang + PC 1/3 Umfang", "umfasst alle Positionen der bei der Prüfung verwendeten Schweißrichtung"],
      ["Prüfstück", "muss in Übereinstimmung mit den Prüfpositionen nach ISO 6947 geschweißt werden"],
    ],
  },
  {
    key: "branchTypes",
    title: "Bild 1 – Arten von Rohrabzweigungen",
    headers: ["Art", "Maßgebende Größen"],
    rows: [
      ["a) aufgesetzte Rohrabzweigung", "D = Rohraußendurchmesser der Abzweigung; s = Dicke des Schweißgutes der Abzweigung"],
      ["b) durchgesetzte Rohrabzweigung", "D = Rohraußendurchmesser der Abzweigung; t/s nach Hauptrohr bzw. eingebrachtem Schweißgut bewerten"],
      ["c) eingesetzte Rohrabzweigung", "D = Rohraußendurchmesser der Abzweigung; t/s nach eingesetzter Ausführung bewerten"],
      ["Legende", "D = Rohraußendurchmesser; s = Schweißgutdicke; t = Werkstoffdicke; 1 = Abzweigung; 2 = Hauptrohr/Behältermantel"],
    ],
    note: "In der Deckungsprüfung noch nicht als eigenes Kriterium ausgewertet.",
  },
  {
    key: "productForm",
    title: "Abschnitt 5.3 – Produktform",
    headers: ["Regel", "Bedeutung"],
    rows: [
      ["Rohr D > 25 mm", "qualifiziert auch Blech"],
      ["Blech → fest eingespanntes Rohr", "nur bei D ≥ 500 mm"],
      ["Blech → rotierendes Rohr", "nur bei D ≥ 75 mm und Position PA/PB/PC/PD"],
    ],
  },
  {
    key: "jointType",
    title: "Abschnitt 5.4 – Nahtart",
    headers: ["Regel", "Bedeutung"],
    rows: [
      ["BW ≠ FW", "keine automatische gegenseitige Qualifikation"],
      ["BW → FW", "nur mit zusätzlicher Kehlnahtprüfung oder kombinierter Prüfung"],
      ["kombinierte BW/FW-Prüfung", "Prüfstück mindestens 10 mm"],
      ["FW → BW", "nicht qualifiziert"],
    ],
  },
  {
    key: "process",
    title: "Abschnitt 5.2 – Schweißprozesse",
    headers: ["Prüfung", "Gültig für"],
    rows: [
      ["Grundregel", "jede Prüfung qualifiziert normalerweise nur den geprüften Schweißprozess"],
      ...Object.entries(PROZESS_AEQUIVALENZ).map(([k, v]) => [mitNamen(k, VERFAHREN_NAMEN), v.map((x) => mitNamen(x, VERFAHREN_NAMEN)).join(", ")] as [string, string]),
    ],
  },
  {
    key: "fm",
    title: "Tabelle 2/3 – FM-Gruppen",
    headers: ["Prüfung", "Gültig für"],
    rows: Object.entries(FM_SCOPE).map(([k, v]) => [mitNamen(k, FM_NAMEN), v.join(", ")]),
  },
  {
    key: "materials",
    title: "CEN ISO/TR 15608 – Werkstoffgruppen",
    headers: ["Bescheinigte Gruppe", "Gültige Gruppen"],
    rows: Object.entries(WERKSTOFFGRUPPEN_QUALIFIKATION).map(([k, v]) => [`${k} – ${WERKSTOFFGRUPPEN_NAMEN[k]?.name ?? ""}`, v.join(", ")]),
  },
  {
    key: "electrode",
    title: "Tabelle 4 – Umhüllte Elektroden 111",
    headers: ["Prüfung", "Gültig für"],
    rows: [["A/RA/RB/RC/RR/R", "A/RA/RB/RC/RR/R"], ["B", "A/RA/RB/RC/RR/R, B"], ["C", "C"]],
    note: "In der Deckungsprüfung noch nicht automatisch geprüft (siehe Hinweis auf der Deckungsprüfungsseite).",
  },
  {
    key: "filler",
    title: "Tabelle 5 – Schweißzusatzarten",
    headers: ["Prüfung", "Gültig für"],
    rows: Object.entries(ZUSATZART_SCOPE).map(([k, v]) => [mitNamen(k, SCHWEISSZUSATZART_NAMEN), v.join(", ")]),
  },
  {
    key: "bwThickness",
    title: "Tabelle 6 – BW-Dicke s",
    headers: ["s", "Gültig"],
    rows: [["s < 3", "s bis max(3; 2s)"], ["3 ≤ s < 12", "3 bis 2s"], ["s ≥ 12", "≥ 3"]],
  },
  {
    key: "diameter",
    title: "Tabelle 7 – Durchmesser D",
    headers: ["D", "Gültig"],
    rows: [["D ≤ 25", "D bis 2D"], ["D > 25", "≥ max(0,5D; 25 mm)"]],
  },
  {
    key: "fwThickness",
    title: "Tabelle 8 – FW-Dicke t",
    headers: ["t", "Gültig"],
    rows: [["t < 3", "t bis max(2t; 3)"], ["t ≥ 3", "≥ 3"]],
  },
  {
    key: "positionFW",
    title: "Tabelle 10 – Kehlnahtpositionen",
    headers: ["Position", "Gültig"],
    rows: Object.entries(POSITION_MATRIX_FW).map(([k, v]) => [mitNamen(k, POSITION_NAMEN), v.map((x) => mitNamen(x, POSITION_NAMEN)).join(", ")]),
  },
  {
    key: "details",
    title: "Tabelle 11 – Schweißdetails",
    headers: ["Prüfung", "Gültig"],
    rows: Object.entries(DETAIL_SCOPE).map(([k, v]) => [mitNamen(k, SCHWEISSDETAIL_NAMEN), v.map((x) => mitNamen(x, SCHWEISSDETAIL_NAMEN)).join(", ")]),
  },
  {
    key: "layers",
    title: "Tabelle 12 – Lagenaufbau",
    headers: ["Prüfung", "Gültig"],
    rows: Object.entries(LAGENAUFBAU_SCOPE).map(([k, v]) => [mitNamen(k, LAGENAUFBAU_NAMEN), v.map((x) => mitNamen(x, LAGENAUFBAU_NAMEN)).join(", ")]),
  },
];
