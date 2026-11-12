// Einfacher, robuster CSV-Parser (Semikolon-getrennt, wie beim eigenen Export) ohne externe
// Abhängigkeit – reicht für den Re-Import des selbst exportierten Formats und schont uns vor
// den ungepatchten Sicherheitslücken der npm-xlsx-Pakete bei nicht vertrauenswürdigen Dateien.
export function parseCsv(text: string): Record<string, string>[] {
  const ohneBom = text.replace(/^﻿/, "");
  const zeilen = parseZeilen(ohneBom);
  if (!zeilen.length) return [];
  const kopf = zeilen[0];
  return zeilen.slice(1).filter((z) => z.some((f) => f !== "")).map((z) => {
    const row: Record<string, string> = {};
    kopf.forEach((h, i) => { row[h.trim()] = (z[i] ?? "").trim(); });
    return row;
  });
}

function parseZeilen(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; } else { inQuotes = false; }
      } else feld += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ";" || c === ",") { zeile.push(feld); feld = ""; }
    else if (c === "\r") continue;
    else if (c === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else feld += c;
  }
  if (feld !== "" || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}
