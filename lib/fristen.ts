// Fristen-Ampel – explizite Regeln:
// abgelaufen = rot | heute bis 60 Tage = gelb | mehr als 60 Tage = grün | kein Datum = grau
export type Ampel = "rot" | "gelb" | "gruen" | "grau";
export const GELB_TAGE = 60;

export function ampel(datum: string | null | undefined, heute = new Date()): { farbe: Ampel; tage: number | null; text: string } {
  if (!datum) return { farbe: "grau", tage: null, text: "kein Datum" };
  const ende = new Date(datum + "T23:59:59");
  const tage = Math.floor((ende.getTime() - heute.getTime()) / 86400000);
  if (ende < heute) return { farbe: "rot", tage, text: `abgelaufen seit ${Math.abs(tage)} Tg.` };
  if (tage <= GELB_TAGE) return { farbe: "gelb", tage, text: `noch ${tage} Tg.` };
  return { farbe: "gruen", tage, text: `noch ${tage} Tg.` };
}
