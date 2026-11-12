// Normrechner DIN EN ISO 9606-1: berechnet aus der rohen Prüfbezeichnung (Produktform,
// Nahtart, Prüfstück-Dicke/-Durchmesser, Prüfposition) den gültigen Geltungsbereich.
// Portiert und 1:1 übernommen aus der bereits fachlich genutzten App
// https://iso9606-audit-engine.vercel.app/ (iso9606.html) – dort als Normrechner im Einsatz.
// Nur hier wird die Norm interpretiert; deckung.ts vergleicht danach nur noch direkt
// (gespeicherte Bereiche/Mengen), siehe Kommentar dort.

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
