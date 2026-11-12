// AP-Fälligkeit (Arbeitsprüfung nach AD 2000 HP 5/2): nächste AP = letzte AP + Intervall.
// Status analog zur Fristen-Ampel, aber mit eigenen Bezeichnungen wie in der Referenz-App.
export type ApStatus = "überfällig" | "bald fällig" | "gültig" | "unbekannt";

export function naechsteAp(letzteAp: string | null | undefined, intervallMonate: number): string | null {
  if (!letzteAp) return null;
  const d = new Date(letzteAp + "T00:00:00");
  d.setMonth(d.getMonth() + intervallMonate);
  return d.toISOString().slice(0, 10);
}

export function apStatus(letzteAp: string | null | undefined, intervallMonate: number, warnTage: number, heute = new Date()): { status: ApStatus; naechste: string | null; tage: number | null } {
  const naechste = naechsteAp(letzteAp, intervallMonate);
  if (!naechste) return { status: "unbekannt", naechste: null, tage: null };
  const ende = new Date(naechste + "T23:59:59");
  const tage = Math.floor((ende.getTime() - heute.getTime()) / 86400000);
  if (ende < heute) return { status: "überfällig", naechste, tage };
  if (tage <= warnTage) return { status: "bald fällig", naechste, tage };
  return { status: "gültig", naechste, tage };
}
