// Import der Desktop-App-Altdaten (schweisser.json, gespeicherte_protokolle/*.json, autosave.json)
// der Referenz-App. Reines Parsen/Zuordnen ohne DB-Zugriff, damit es ohne Browser/Supabase testbar
// ist – das eigentliche Schreiben übernimmt die aufrufende Route.
//
// Format laut app-daten.js/wpqr.js der Referenz-App:
// - schweisser.json: Array von { name, zeichen?, geburtsdatum?, zertifikate: [{zertifikat_nr,
//   zertifikat_bezeichnung, gueltig_bis, verlaengerung}] } ODER der flachen Variante mit
//   zertifikat_nr/zertifikat_bezeichnung/gueltig_bis/verlaengerung direkt auf der Person.
// - gespeicherte_protokolle/*.json (hat _name) bzw. autosave.json (hat _gespeichert_um oder
//   kennzeichnung): AP-Protokoll-Formularstand mit u. a. m_wpqr_nr, sw_idx/sw_zert_idx (Index in
//   das im selben Import mitgelieferte schweisser.json) und diversen Freitextfeldern.
// - Dateien mit excel_pfad/sig_pfad (nur lokale Pfade der Desktop-App) werden ignoriert.

export type LegacyZertifikat = { zertifikat_nr?: string; zertifikat_bezeichnung?: string; gueltig_bis?: string; verlaengerung?: string };
export type LegacySchweisser = {
  name: string; zeichen?: string; geburtsdatum?: string; zertifikate?: LegacyZertifikat[];
  zertifikat_nr?: string; zertifikat_bezeichnung?: string; gueltig_bis?: string; verlaengerung?: string;
};

export function istLegacySchweisserListe(d: unknown): d is LegacySchweisser[] {
  return Array.isArray(d) && d.length > 0 && d.every((s) => s && typeof s === "object" && typeof (s as any).name === "string" && (s as any).name.trim());
}

// Legacy-Zertifikate je Person auf die flache zertifikate-Form normalisieren.
export function legacySchweisserZertifikate(s: LegacySchweisser): LegacyZertifikat[] {
  if (Array.isArray(s.zertifikate)) return s.zertifikate;
  if (s.zertifikat_nr || s.zertifikat_bezeichnung) return [{ zertifikat_nr: s.zertifikat_nr, zertifikat_bezeichnung: s.zertifikat_bezeichnung, gueltig_bis: s.gueltig_bis, verlaengerung: s.verlaengerung }];
  return [];
}

// Verfahren lässt sich bei Altdaten nur aus der Bezeichnung ableiten (kein eigenes Feld),
// z. B. "ISO 9606-1 141 T BW FM1 S s3,6 D60,3 PH" -> "141".
export function prozessAusBezeichnung(bezeichnung: string | undefined): string | null {
  const m = /\b(\d{2,3})\s+[PT]\s+(?:BW|FW)\b/i.exec(bezeichnung ?? "");
  return m ? m[1] : null;
}

function isoDatum(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/.exec(s);
  if (m) {
    const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${jahr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export type GeplanteZertifikat = { cert_no: string | null; process: string; bezeichnung: string | null; valid_until: string | null; verlaengerung_nach: string | null };
export type GeplanterSchweisser = { name: string; stamp: string | null; birthdate: string | null; certs: GeplanteZertifikat[] };

// schweisser.json -> Einfüge-Plan. Zertifikate ohne erkennbares Verfahren werden übersprungen
// (process ist in der DB Pflichtfeld), genau wie beim Excel-/Bulk-Import.
export function legacySchweisserPlan(liste: LegacySchweisser[]): GeplanterSchweisser[] {
  return liste.filter((s) => s.name?.trim()).map((s) => ({
    name: s.name.trim(), stamp: s.zeichen?.trim() || null, birthdate: isoDatum(s.geburtsdatum),
    certs: legacySchweisserZertifikate(s)
      .map((z) => ({ zertifikat_nr: z.zertifikat_nr, zertifikat_bezeichnung: z.zertifikat_bezeichnung, gueltig_bis: z.gueltig_bis, verlaengerung: z.verlaengerung, process: prozessAusBezeichnung(z.zertifikat_bezeichnung) }))
      .filter((z): z is typeof z & { process: string } => z.process !== null)
      .map((z) => ({ cert_no: z.zertifikat_nr?.trim() || null, process: z.process, bezeichnung: z.zertifikat_bezeichnung?.trim() || null, valid_until: isoDatum(z.gueltig_bis), verlaengerung_nach: z.verlaengerung?.trim() || null })),
  }));
}

export type LegacyProtokollArt = "protokoll" | "entwurf" | "einstellungen" | "unbekannt";
export function legacyProtokollArt(d: Record<string, unknown>): LegacyProtokollArt {
  if (!d || typeof d !== "object") return "unbekannt";
  if (d._name) return "protokoll";
  if (d._gespeichert_um || d.kennzeichnung != null) return "entwurf";
  if (d.excel_pfad != null || d.sig_pfad != null) return "einstellungen";
  return "unbekannt";
}

export type GeplantesProtokoll = {
  wpqr_no_gesucht: string | null; welder_name_gesucht: string | null;
  ap_datum: string; pruefstueck: string | null; weitere_angaben: string | null;
};

const PROTOKOLL_FREITEXT_FELDER = ["herstell_nr", "wps_nr", "grundwerkstoff", "prozess", "dicke_t", "rohr_d", "position", "zusatz_norm", "zusatz_hersteller", "schutzgas", "kennblatt_nr", "besteller", "sonstige"] as const;

// Legacy-Protokoll (gespeicherte_protokolle/*.json bzw. autosave.json) -> Einfüge-Plan.
// sw_idx/sw_zert_idx verweisen auf die Person/das Zertifikat im selben Import mitgelieferten
// schweisser.json (Position in der Liste) - wie in der Referenz-App, da die Desktop-App keine
// IDs kennt, die in unserer DB wiederzufinden wären.
export function legacyProtokollPlan(d: Record<string, any>, schweisserImBatch: LegacySchweisser[] | null): GeplantesProtokoll {
  const wpqrNr = (d.m_wpqr_nr ?? "").toString().trim() || null;
  let welderName: string | null = null;
  if (schweisserImBatch && typeof d.sw_idx === "number") {
    const sw = schweisserImBatch[d.sw_idx];
    if (sw) welderName = sw.name;
  }
  const freitext = PROTOKOLL_FREITEXT_FELDER.map((k) => (d[k] != null && String(d[k]).trim() ? `${k}: ${d[k]}` : null)).filter(Boolean).join(" · ") || null;
  return {
    wpqr_no_gesucht: wpqrNr, welder_name_gesucht: welderName,
    ap_datum: isoDatum(d.datum_schweissung) ?? new Date().toISOString().slice(0, 10),
    pruefstueck: (d.kennzeichnung ?? "").toString().trim() || null,
    weitere_angaben: freitext,
  };
}

const normWpqrNr = (s: string) => s.replace(/\s/g, "").toLowerCase();

export function findeWpqrId(gesucht: string | null, vorhandene: { id: string; wpqr_no: string }[]): string | null {
  if (!gesucht) return null;
  const treffer = vorhandene.find((w) => normWpqrNr(w.wpqr_no) === normWpqrNr(gesucht));
  return treffer?.id ?? null;
}

export function findeWelderId(gesucht: string | null, vorhandene: { id: string; name: string }[]): string | null {
  if (!gesucht) return null;
  const treffer = vorhandene.find((w) => w.name.trim().toLowerCase() === gesucht.trim().toLowerCase());
  return treffer?.id ?? null;
}
