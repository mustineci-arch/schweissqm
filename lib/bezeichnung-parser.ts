// Parst eine genormte Prüfungsbezeichnung (wie von pruefbezeichnung() erzeugt, z. B.
// "141 T BW FM3 S s3,6 D60,3 PH ss nb ml" oder mit optionalem "ISO 9606-1 "-Präfix) in ihre
// Einzelfelder – Umkehrung von pruefbezeichnung() in lib/iso9606.ts, für den Decoder.
// Best effort: die Grammatik ist positionsbasiert mit optionalen Teilen, daher wird tokenweise
// anhand bekannter Muster erkannt statt strikt an festen Positionen.
export type GeparstePruefbezeichnung = {
  process: string | null; produkt: "P" | "T" | null; nahtart: "BW" | "FW" | null;
  fmGroup: string | null; fillerType: string | null; dicke: number | null; durchmesser: number | null;
  position: string | null; weldDetail: string | null; layerBuild: "sl" | "ml" | null;
  unerkannt: string[];
};

const FILLER_TYPES = ["S", "M", "B", "R", "PZ", "V", "W", "Y", "Z", "C"];
const POSITIONEN = ["PA", "PB", "PC", "PD", "PE", "PF", "PG", "PH", "PJ", "HL045", "JL045"];

export function parsePruefbezeichnung(text: string): GeparstePruefbezeichnung {
  const out: GeparstePruefbezeichnung = {
    process: null, produkt: null, nahtart: null, fmGroup: null, fillerType: null,
    dicke: null, durchmesser: null, position: null, weldDetail: null, layerBuild: null, unerkannt: [],
  };
  const bereinigt = text.trim().replace(/^ISO\s*9606-1\s*/i, "");
  const tokens = bereinigt.split(/\s+/).filter(Boolean);
  const weldDetailTeile: string[] = [];

  for (const roh of tokens) {
    const t = roh.toUpperCase();
    if (out.process === null && /^\d{2,3}$/.test(t)) { out.process = t; continue; }
    if (out.produkt === null && /^[PT]$/.test(t)) { out.produkt = t as "P" | "T"; continue; }
    if (out.nahtart === null && /^(BW|FW)$/.test(t)) { out.nahtart = t as "BW" | "FW"; continue; }
    if (out.fmGroup === null && /^FM\d$/.test(t)) { out.fmGroup = t; continue; }
    if (out.fillerType === null && FILLER_TYPES.includes(t)) { out.fillerType = t; continue; }
    if (out.dicke === null && /^[ST]\d/i.test(roh)) { out.dicke = parseFloat(roh.slice(1).replace(",", ".")); continue; }
    if (out.durchmesser === null && /^D\d/i.test(roh)) { out.durchmesser = parseFloat(roh.slice(1).replace(",", ".")); continue; }
    if (out.position === null) {
      const posM = POSITIONEN.find((p) => t === p || t.startsWith(p + "-"));
      if (posM) { out.position = t; continue; }
    }
    if (out.layerBuild === null && /^(SL|ML)$/i.test(t)) { out.layerBuild = t.toLowerCase() as "sl" | "ml"; continue; }
    if (/^[a-z]{2}$/i.test(roh)) { weldDetailTeile.push(t.toLowerCase()); continue; }
    out.unerkannt.push(roh);
  }
  if (weldDetailTeile.length) out.weldDetail = weldDetailTeile.join("_");
  return out;
}
