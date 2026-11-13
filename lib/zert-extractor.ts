// Schweißer-Zertifikat-Extractor: liest Felder aus PDF-Textlayer von Prüfbescheinigungen.
// Portiert aus der bereits fachlich genutzten App https://iso9606-audit-engine.vercel.app/
// (zert-extractor.js). Unterstützt TÜV NORD, TÜV Thüringen und DVS-Format (textbasierte PDFs,
// keine Scans/OCR). Reine Text-/Regex-Logik, kein DOM – pdfjs liefert nur die Wort-Positionen.

import { parsePruefbezeichnung } from "./bezeichnung-parser";

export type Wort = { text: string; x0: number; x1: number; top: number; base: number };
export type Zeile = { y: number; words: Wort[] };

export const FIELDS = {
  zertifikat_nr: "Zertifikat-Nr.", bezeichnung: "Bezeichnung", name: "Name des Schweißers",
  geburtsdatum: "Geburtsdatum", geburtsort: "Geburtsort", arbeitgeber: "Arbeitgeber",
  wps_bezug: "WPS-Bezug", auftrags_nr: "Auftrags-Nr.", pruefberichts_nr: "Prüfberichts-Nr.",
  pruefgrundlage: "Prüfgrundlage", schweissprozess: "Schweißprozess (Prüfstück)",
  geltungsbereich_prozess: "Geltungsbereich Prozess", nahtart: "Nahtart (Prüfstück)",
  nahtart_geltung: "Nahtart (Geltungsbereich)", werkstoffgruppe: "Werkstoffgruppe (Prüfstück)",
  werkstoffgruppe_geltung: "Werkstoffgruppe (Geltungsbereich)", schweisszusatzgruppe: "Schweißzusatzgruppe (Prüfstück)",
  schweissposition: "Schweißposition (Prüfstück)", schweissposition_geltung: "Schweißposition (Geltungsbereich)",
  rohraussendurchmesser: "Rohraußendurchmesser mm (Prüfstück)", rohraussendurchmesser_g: "Rohraußendurchmesser mm (Geltungsbereich)",
  schweissgutdicke_s: "Schweißgutdicke s mm (Prüfstück)", schweissgutdicke_s_g: "Schweißgutdicke s mm (Geltungsbereich)",
  werkstoffdicke_t: "Werkstoffdicke t mm (Prüfstück)", werkstoffdicke_t_g: "Werkstoffdicke t mm (Geltungsbereich)",
  werkstoff: "Werkstoff (Parent metal)", zusatz_filler: "Zusatz / Filler",
  datum_schweissen: "Datum des Schweißens", gueltig_bis: "Gültig bis", verlaengerung_nach: "Verlängerung nach",
  fachkunde: "Fachkunde", ergaenzende_kehlnaht: "Ergänzende Kehlnahtprüfung",
} as const;
export const FIELD_ORDER = Object.keys(FIELDS) as (keyof typeof FIELDS)[];
export type Zertifikat = { -readonly [K in keyof typeof FIELDS]: string } & { _datei: string; _seite: number; _pages: number; _ocr_used: boolean; _error: string };

const X_LABEL_MAX = 165, X_HDR_LEFT_MAX = 328, X_HDR_RIGHT_MIN = 360, X_PRUEF_MAX = 360, Y_TABLE_START = 215;

function re(pattern: string, text: string, group = 1, flags = "is"): string {
  let m: RegExpExecArray | null;
  try { m = new RegExp(pattern, flags).exec(text); } catch { return ""; }
  if (!m) return "";
  const g = group === 0 ? m[0] : m[group];
  return g === undefined || g === null ? "" : g.trim();
}

function findall(pattern: string, text: string, flags = "i"): string[] {
  const out: string[] = [];
  const r = new RegExp(pattern, flags + "g");
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[0]);
    if (m.index === r.lastIndex) r.lastIndex++;
  }
  return out;
}

function isoZeilen(text: string): string[] {
  const gesehen = new Set<string>(), out: string[] = [];
  findall("((?:EN\\s+)?ISO\\s+9606-1\\s*\\d{3}(?:\\/\\d{3})?\\s+[PT]\\s+[^\\n]+)", text, "i").forEach((z) => {
    const s = z.replace(/\s+/g, " ").trim();
    if (!gesehen.has(s)) { gesehen.add(s); out.push(s); }
  });
  return out;
}

function bezeichnungMitZeilen(bez: string, text: string): string {
  const zeilen = isoZeilen(text);
  if (!zeilen.length) return bez;
  if (!bez) return zeilen.join("; ");
  const b = bez.replace(/\s+/g, " ").trim();
  const rest = zeilen.filter((z) => b.indexOf(z) < 0 && z.indexOf(b) < 0);
  return rest.length ? [b, ...rest].join("; ") : b;
}

function convertDate(s: string): string {
  if (!s) return s || "";
  const m = /^(\d{1,2})\.(\d{2})\.(\d{4})/.exec(s.trim());
  if (!m) return s;
  return m[3] + "-" + m[2] + "-" + ("0" + parseInt(m[1], 10)).slice(-2);
}

function cleanOcr(s: string): string {
  if (!s) return s || "";
  return s.replace(/[\\|]([A-ZÄÖÜ])/g, "$1").trim();
}

function stripDash(val: string): string {
  const v = (val || "").trim();
  return /^-{1,20}$/.test(v) ? "" : v;
}

const LABEL_KEYWORDS = [
  "wps-bezug", "wps-reference", "name des", "welder", "order no", "auftrags",
  "test report", "prüfberichts", "job knowledge", "fachkunde", "prüfstück", "geltungsbereich",
];
function isLabel(text: string): boolean {
  const lower = (text || "").toLowerCase().trim();
  return LABEL_KEYWORDS.some((kw) => lower.indexOf(kw) !== -1);
}

function isDvsFormat(text: string): boolean {
  return new RegExp("DVS.{0,10}(Pers[Zz]ert|ZERT|Pr[üu]fstelle)|Schwei[ßs]er-Pr[üu]fungsbescheinigung|Pr[üu]fungsbescheinigung", "i").test(text);
}
function isTuevNord(text: string): boolean { return /Name des Schwei[ßs]ers/i.test(text); }
function isTuevThueringen(text: string): boolean { return /WelderCert|6\s+Welder['’]?s\s+name:/i.test(text); }

export function groupWordsIntoRows(words: Wort[], yTol = 2.5): Zeile[] {
  const sorted = [...words].sort((a, b) => (a.base ?? a.top) - (b.base ?? b.top));
  const rows: Zeile[] = [];
  let cur: Zeile | null = null, prevKey: number | null = null;
  sorted.forEach((w) => {
    const key = w.base ?? w.top;
    if (cur === null || prevKey === null || key - prevKey > yTol) {
      cur = { y: w.top, words: [] };
      rows.push(cur);
    }
    cur.words.push(w);
    if (w.top < cur.y) cur.y = w.top;
    prevKey = key;
  });
  return rows;
}

function colText(words: Wort[], xMin: number, xMax: number): string {
  return words.filter((w) => w.x0 >= xMin && w.x0 < xMax).sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(" ");
}
function rowText(words: Wort[]): string {
  return [...words].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(" ");
}

function findValueRow(rows: Zeile[], labelKeyword: string, yMinOffset = 0, yMaxOffset = 10): Wort[] | null {
  const kw = labelKeyword.toLowerCase();
  let labelY: number | null = null;
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  for (const row of sorted) {
    const labels = row.words.filter((w) => w.x0 < X_LABEL_MAX);
    if (labels.some((w) => w.text.toLowerCase().indexOf(kw) !== -1)) { labelY = row.y; break; }
  }
  if (labelY === null) return null;
  let bestY: number | null = null, bestWords: Wort[] = [];
  rows.forEach((row) => {
    const diff = row.y - (labelY as number);
    if (diff >= yMinOffset && diff <= yMaxOffset) {
      const vals = row.words.filter((w) => w.x0 >= X_LABEL_MAX);
      if (vals.length && (bestY === null || diff < bestY - (labelY as number))) { bestY = row.y; bestWords = row.words; }
    }
  });
  return bestWords.length ? bestWords : null;
}

type Tabellenzeile = { label: string; pruef: string; gelt: string };
function buildTable(rows: Zeile[]): Tabellenzeile[] {
  const tbl: Tabellenzeile[] = [];
  [...rows].filter((r) => r.y > Y_TABLE_START).sort((a, b) => a.y - b.y).forEach((r) => {
    const label = rowText(r.words.filter((w) => w.x0 < X_LABEL_MAX));
    const pruef = rowText(r.words.filter((w) => w.x0 >= X_LABEL_MAX && w.x0 < X_PRUEF_MAX));
    const gelt = rowText(r.words.filter((w) => w.x0 >= X_PRUEF_MAX));
    if (label && (pruef || gelt)) tbl.push({ label, pruef, gelt });
  });
  return tbl;
}

export function wordsToText(words: Wort[]): string {
  const rows = groupWordsIntoRows(words, 3);
  return rows.sort((a, b) => a.y - b.y).map((r) => rowText(r.words)).join("\n");
}

// ── TÜV Thüringen (englisch, nummerierte Zeilen) ───────────────────────────
function fillTuevThueringen(d: Zertifikat, text: string) {
  d.zertifikat_nr = re("Certificate\\s+No\\.?\\s+([^\\s\\n]+)", text);
  const isoHits = findall("(ISO\\s+9606-1\\s*\\d+\\s+[^\\n]+)", text, "i");
  d.bezeichnung = isoHits.length ? isoHits.map((h) => h.trim()).join("; ") : "";
  d.wps_bezug = re("WPS-?Reference:\\s+(.+?)(?:\\s{2,}|Examining body|\\n|$)", text);
  d.name = cleanOcr(re("Welder['’]?s\\s+name:\\s+(.+?)(?:\\s*\\n|$)", text));

  const m8 = /Date and place of birth:\s*(\d{4}-\d{2}-\d{2}),?\s*(.+?)(?:\s+\(if required\)|\s*\n)/i.exec(text);
  if (m8) { d.geburtsdatum = m8[1].trim(); d.geburtsort = m8[2].trim(); }
  else d.geburtsdatum = re("Date.*?birth:\\s*(\\d{4}-\\d{2}-\\d{2})", text);

  const emp = re("9\\s+Employer:\\s*([^\\n\\d][^\\n]*)", text);
  d.arbeitgeber = emp && emp.trim().indexOf("10") !== 0 ? emp : "";
  d.pruefgrundlage = re("Code[/\\s]+testing\\s+standard:\\s*([^\\n]+)", text);
  d.ergaenzende_kehlnaht = re("Supplementary\\s+fillet\\s+weld\\s+test:\\s*([^\\n]+)", text);
  d.fachkunde = re("Job\\s+knowledge:\\s*([^\\n]+)", text);

  const m14 = /14\s+Weld[i!]?ng?\s+process.*?[;:]\s+([\d]+\s+\S+(?:\s+[/(]\s*\S+)*)\s{2,}(.+?)(?:\n|$)/i.exec(text);
  if (m14) { d.schweissprozess = m14[1].trim(); d.geltungsbereich_prozess = m14[2].trim(); }
  else d.schweissprozess = re("14\\s+Weld[i!]?ng?\\s+process.*?[;:]\\s+(\\d+\\s+\\S+)", text);

  const m17 = /17\s+Type\s+of\s+\w+\s+(\w+)\s+\w+\s+\w+\s+(.+?)(?:\n|$)/i.exec(text);
  if (m17) { d.nahtart = m17[1].trim(); d.nahtart_geltung = m17[2].trim(); }
  else d.nahtart = re("17\\s+Type\\s+of\\s+\\w+\\s+(\\w+)", text);

  const m18 = /18\s+Parent\s+material\s+group.*?\s+([\d\.]+)\s+(.+?)(?:\n|$)/i.exec(text);
  if (m18) { d.werkstoffgruppe = m18[1].trim(); d.werkstoffgruppe_geltung = m18[2].trim(); }
  else d.werkstoffgruppe = re("18\\s+Parent\\s+material\\s+group.*?\\s+([\\d\\.]+)", text);

  d.schweisszusatzgruppe = re("19\\s+Filler\\s+material\\s+group.*?\\s+(\\w+)\\s", text);

  // "position"/"thickness"/"pipe" tauchen in manchen PDFs dieses Formats (Schriftart-Subsetting-
  // Fehler des Erstellers) mit vertauschtem i/l auf (z. B. "posltion", "thlckness", "plpe") -
  // Zeichenklasse [il] statt literalem i macht die Regex robust gegen diese Variante.
  const m27 = /27\s+\w+[i!]?ng?\s+pos[il]tion.*?\s+(\S+)\s+(.+?)(?:\n|$)/i.exec(text);
  if (m27) { d.schweissposition = m27[1].trim(); d.schweissposition_geltung = m27[2].trim(); }
  else d.schweissposition = re("27\\s+\\w+[i!]?ng?\\s+pos[il]tion.*?\\s+(\\S+)", text);

  // Nur einen echten Prüfstückwert übernehmen, keinen aus der Geltungsbereich-Spalte: ein mit
  // ~/≥/>= eingeleiteter Wert (z. B. "FW: ~ 3.00") ist ein offener Bereich, kein Prüfstückmaß -
  // das Prüfstück-Feld ist in dem Fall leer ("-") und wird NICHT befüllt.
  const m24 = /24\s+Material\s+th[il]ckness.*?(?:FW:\s*)?(~|≥|>=)?\s*([\d\.,]+(?:\s+to\s+[\d\.,]+)?)/i.exec(text);
  if (m24 && !m24[1]) d.werkstoffdicke_t = m24[2].trim();

  const m25 = /25\s+Deposited\s+th[il]ckness.*?\s+([\d\.]+)\s+\([^)]+\)\s+(.+?)(?:\n|$)/i.exec(text);
  if (m25) { d.schweissgutdicke_s = m25[1].trim(); d.schweissgutdicke_s_g = m25[2].trim(); }
  else d.schweissgutdicke_s = re("25\\s+Deposited\\s+th[il]ckness.*?\\s+([\\d\\.]+)", text);

  const m26 = /26\s+Outside\s+p[il]pe\s+diameter.*?\s+([\d\.]+)\s+(.+?)(?:\n|$)/i.exec(text);
  if (m26) { d.rohraussendurchmesser = m26[1].trim(); d.rohraussendurchmesser_g = m26[2].trim(); }
  else d.rohraussendurchmesser = re("26\\s+Outside\\s+p[il]pe\\s+diameter.*?\\s+([\\d\\.]+)", text);

  d.werkstoff = re("Parent\\s+meta[l1]:\\s*(.+?)\\.?\\s*(?:Filler:|The\\s+requirements|\\n)", text);
  d.zusatz_filler = re("Filler:\\s*(.+?)(?:\\.\\s+The\\s+requirements|\\.\\s*\\n|\\.\\s*$)", text);
  d.verlaengerung_nach = re("Revalidation\\s+method[:\\s]+(\\d+[\\.,]\\d+\\s*[a-z])", text);
  d.datum_schweissen = re("Date\\s+of\\s+weld\\w*:\\s*(\\d{4}-\\d{2}-\\d{2})", text);
  d.gueltig_bis = re("Validity\\s+until:\\s*(\\d{4}-\\d{2}-\\d{2})", text);
  d.pruefberichts_nr = re("Test\\s+report\\s+no\\.?\\s*[:\\s]+([^\\s\\n]+)", text) || re("Pr[üu]fberichts-?Nr\\.?\\s*[:\\s]+([^\\s\\n]+)", text);
}

// ── DVS (deutsch) ───────────────────────────────────────────────────────────
function fillDvs(d: Zertifikat, text: string) {
  d.zertifikat_nr = re("Pr[üu]f\\.?\\s*-?\\s*Nr\\.?\\s*:?\\s*([A-Z0-9][-A-Z0-9/\\.\\s]+?)(?:\\s{2,}|\\n|$)", text) || re("Nr\\.:\\s*([A-Z0-9][-A-Z0-9/\\.]+)", text);
  d.bezeichnung = bezeichnungMitZeilen(re("Bezeichnung\\s*[:\\s]+(ISO\\s+\\d+[^\\n]+)", text) || re("Designation\\s*[:\\s]+(ISO\\s+\\d+[^\\n]+)", text), text);

  const rawName = re("Name des Schwei[ßs]ers\\s*[:\\s]+([A-ZÄÖÜ][^\\n]+?)(?:\\s{3,}|\\n)", text) || re("Name\\s*:\\s*([A-ZÄÖÜ][a-zA-ZÄÖÜäöüß\\-\\s]+?)(?:\\s{3,}|\\n)", text);
  if (rawName && !isLabel(rawName)) d.name = cleanOcr(rawName);

  const bdate = re("Geburtsdatum\\s*[:\\s]+(\\d{1,2}\\.\\d{2}\\.\\d{4})", text);
  d.geburtsdatum = bdate ? convertDate(bdate) : "";
  d.geburtsort = re("Geburtsort\\s*[:\\s]+([^\\n\\t]+?)(?:\\s{3,}|\\n|$)", text);
  d.arbeitgeber = re("Besch[äa]ftigt\\s+bei\\s*[:\\s]+([^\\n]+)", text) || re("Arbeitgeber\\s*[:\\s]+([^\\n]+)", text);
  d.wps_bezug = re("WPS[-\\s]?Bezug\\s*[:\\s]+([^\\s\\n]+)", text);
  d.auftrags_nr = re("Auftrags-?Nr\\.?\\s*[:\\s]+(\\S+)", text);
  d.pruefberichts_nr = re("Pr[üu]fberichts-?Nr\\.?\\s*[:\\s]+(\\S+)", text);
  d.pruefgrundlage = re("Vorschrift\\s*/\\s*Pr[üu]fnorm\\s*[:\\s]+([^\\n]+)", text) || re("Pr[üu]fgrundlage\\s*[:\\s]+([^\\n]+)", text);
  d.schweissprozess = re("Schwei[ßs]prozess\\s*[:\\s]+([^\\n]+)", text);
  d.nahtart = re("Nahtart\\s*[:\\s]+([^\\n]+)", text);
  d.werkstoffgruppe = re("Werkstoffgruppe\\(?n?\\)?\\s*[:\\s]+([^\\n]+)", text);
  d.schweisszusatzgruppe = re("Schwei[ßs]zusatzgruppe\\(?n?\\)?\\s*[:\\s]+([^\\n]+)", text);
  d.schweissposition = re("Schwei[ßs]position(?:en)?\\s*[:\\s]+([^\\n]+)", text);
  d.rohraussendurchmesser = re("Rohrau[ßs]endurchmesser\\s*[:\\s]+([^\\n]+)", text);
  d.schweissgutdicke_s = re("Schwei[ßs]gutdicke\\s*(?:\\(mm\\))?\\s*[:\\s]+([^\\n]+)", text);
  d.werkstoffdicke_t = re("Werkstoffdicke\\s*(?:\\(mm\\))?\\s*[:\\s]+([^\\n]+)", text);
  d.werkstoff = re("Werkstoff\\s*[:\\s]+([^\\n]+)", text);
  d.zusatz_filler = re("Schwei[ßs]zusatz\\s*[:\\s]+([^\\n]+)", text) || re("Zusatz\\s*/\\s*Filler\\s*[:\\s]+([^\\n]+)", text);

  const rawDatum = re("Datum des Schwei[ßs]ens\\s*[:\\s]+(\\d{1,2}\\.\\d{2}\\.\\d{4})", text);
  const rawGueltig = re("G[üu]ltig bis\\s*[:\\s]+(\\d{1,2}\\.\\d{2}\\.\\d{4})", text);
  d.datum_schweissen = rawDatum ? convertDate(rawDatum) : "";
  d.gueltig_bis = rawGueltig ? convertDate(rawGueltig) : re("G[üu]ltig bis\\s*[:\\s]+(\\d{4}-\\d{2}-\\d{2})", text);
  d.verlaengerung_nach = re("Verl[äa]ngerung\\s*(?:nach)?\\s*[:\\s]+([^\\n]+)", text);
  d.fachkunde = re("Fachkunde\\s*[:\\s]+([^\\n]+)", text) || re("(Bestanden\\s*/\\s*Acceptable|Nicht bestanden)", text);
  d.ergaenzende_kehlnaht = re("Erg[äa]nzende Kehlnahtpr[üu]fung\\s*[:\\s]+([^\\n]+)", text);
}

// ── TÜV NORD (deutsch/englisch, Positional-Extraktion) ─────────────────────
function extractNameWps(rows: Zeile[], text: string): [string, string] {
  for (const yMax of [12, 20, 30]) {
    let valRow = findValueRow(rows, "Schweißers", 1, yMax);
    if (!valRow) valRow = findValueRow(rows, "welder", 1, yMax);
    if (valRow) {
      const name = colText(valRow, X_LABEL_MAX, X_HDR_LEFT_MAX);
      let wps = colText(valRow, X_HDR_RIGHT_MIN, 9999);
      if (!wps) { wps = colText(valRow, X_HDR_LEFT_MAX, 9999); if (wps.split(/\s+/).length > 4) wps = ""; }
      if (name && !isLabel(name)) return [name.trim(), wps.trim()];
    }
  }
  const m = /Name des Schwei.ers:[\s\S]*?WPS-Bezug:\s*\n\s*(.+?)\s{2,}(\S+)\s*\n/.exec(text);
  if (m && !isLabel(m[1])) return [m[1].trim(), m[2].trim()];
  let wps2 = re("WPS-reference:?\\s*\\n?\\s*([A-Z0-9][\\w\\-/]{1,15})\\b", text);
  if (isLabel(wps2)) wps2 = "";
  if (!wps2) wps2 = re("\\b(P\\d{3,}(?:-\\d+)?)\\b", text);
  let name2 = "";
  const m2 = /Name des Schwei.ers:[\s\S]*?\n\s*([A-ZÄÖÜ][a-zA-ZÄÖÜäöüß]+(?:\s+[A-ZÄÖÜ][a-zA-ZÄÖÜäöüß]+)+)/.exec(text);
  if (m2 && !isLabel(m2[1])) name2 = m2[1].trim();
  return [name2, wps2];
}

function extractBirthPruef(d: Zertifikat, rows: Zeile[], text: string) {
  const birthRow = findValueRow(rows, "Geburtsdatum", 0, 3);
  if (birthRow) {
    const left = colText(birthRow, X_LABEL_MAX, X_HDR_LEFT_MAX);
    const right = colText(birthRow, X_HDR_RIGHT_MIN, 9999);
    const m = /^(\d{4}-\d{2}-\d{2})[,\.]?\s*([\s\S]*)/.exec(left);
    if (m) { d.geburtsdatum = m[1].trim(); d.geburtsort = m[2].trim(); } else d.geburtsdatum = left;
    d.pruefberichts_nr = right;
    return;
  }
  const m1 = /Geburtsdatum und -ort:\s*([\d\-]+)[,\.]?\s*(.+?)\s+Pr.fberichts/.exec(text);
  if (m1) { d.geburtsdatum = m1[1].trim(); d.geburtsort = m1[2].trim(); }
  else {
    d.geburtsdatum = re("([\\d]{4}-[\\d]{2}-[\\d]{2})", text);
    const m3 = /[\d]{4}-[\d]{2}-[\d]{2},\s*(.+?)(?:\s{2,}|\n)/.exec(text);
    d.geburtsort = m3 ? m3[1].trim() : "";
  }
  d.pruefberichts_nr = re("Pr.fberichts-Nr\\.?:?\\s*([0-9][^\\s\\n]+)", text) || re("Test report no\\.?:?\\s*([0-9][^\\s\\n]+)", text);
}

function extractKehlFach(d: Zertifikat, rows: Zeile[], text: string) {
  for (const yMax of [10, 20, 30]) {
    const kehlRow = findValueRow(rows, "Kehlnaht", 1, yMax);
    if (kehlRow) {
      const left = colText(kehlRow, X_LABEL_MAX, X_HDR_LEFT_MAX);
      const right = colText(kehlRow, X_HDR_RIGHT_MIN, 9999);
      if (left && !isLabel(left)) { d.ergaenzende_kehlnaht = left.trim(); d.fachkunde = right.trim(); return; }
    }
  }
  d.ergaenzende_kehlnaht = re("Erg.nzende Kehlnahtpr.fung:.*?\\n\\s*(Nein\\s*/\\s*No|Ja\\s*/\\s*Yes|Nein|Ja)", text) || re("Supplementary fillet weld test:\\s*([^\\n]+)", text);
  d.fachkunde = re("(Bestanden\\s*/\\s*Acceptable|Nicht bestanden\\s*/\\s*Not acceptable)", text) || re("(Bestanden|Acceptable|Nicht bestanden)", text) || re("Job knowledge:\\s*([^\\n]+)", text);
}

function fillTableFields(d: Zertifikat, tbl: Tabellenzeile[], text: string) {
  function get(keyword: string): [string, string] {
    const kw = keyword.toLowerCase();
    for (const row of tbl) if (row.label.toLowerCase().indexOf(kw) !== -1) return [stripDash(row.pruef), stripDash(row.gelt)];
    return ["", ""];
  }
  let pg = get("Schweißprozess");
  d.schweissprozess = pg[0] || re("Schwei.prozess[^;]*;\\s+(\\d+\\s+\\S+)", text);
  d.geltungsbereich_prozess = pg[1];
  pg = get("Nahtart");
  d.nahtart = pg[0] || re("Nahtart\\s+((?:BW|FW)\\s+\\S+(?:\\s+/\\s+\\S+)?)", text);
  d.nahtart_geltung = pg[1];
  pg = get("Werkstoffgruppe");
  d.werkstoffgruppe = pg[0] || re("Werkstoffgruppe\\(n\\)\\s+([\\d\\.]+)", text);
  d.werkstoffgruppe_geltung = pg[1];
  pg = get("Schweißzusatzgruppe");
  d.schweisszusatzgruppe = pg[0] || re("Schwei.zusatzgruppe\\(n\\)\\s+(\\S+)", text);
  pg = get("Schweißposition");
  d.schweissposition = pg[0] || re("Schwei.position\\(en\\)\\s+(\\S+)", text);
  d.schweissposition_geltung = pg[1];
  pg = get("Rohraußendurchmesser");
  d.rohraussendurchmesser = pg[0] || re("Rohrau.endurchmesser.*?(\\d+[,\\.]\\d+)", text);
  d.rohraussendurchmesser_g = pg[1];
  pg = get("Schweißgutdicke");
  d.schweissgutdicke_s = pg[0]; d.schweissgutdicke_s_g = pg[1];
  pg = get("Werkstoffdicke t");
  d.werkstoffdicke_t = pg[0]; d.werkstoffdicke_t_g = pg[1];
}

function fillTuevNord(d: Zertifikat, words: Wort[], text: string) {
  const rows = groupWordsIntoRows(words, 2.5);
  d.zertifikat_nr = re("Certificate\\s+no\\.?:?\\s*([0-9][^\\s\\n]+)", text) || re("Zertifikat\\s+Nr\\..*?:\\s*([0-9][^\\s\\n]+)", text);
  d.bezeichnung = bezeichnungMitZeilen(re("Bezeichnung:\\s*(ISO\\s+\\d+[^\\n]+)", text) || re("Designation:\\s*(ISO\\s+\\d+[^\\n]+)", text) || re("Bezeichnung:\\s*([^\\n]+)", text), text);
  const [name, wps] = extractNameWps(rows, text);
  d.name = name; d.wps_bezug = wps;
  d.auftrags_nr = re("Auftrags-?Nr\\.?:?\\s*(\\d{6,})", text);
  extractBirthPruef(d, rows, text);
  d.arbeitgeber = re("Arbeitgeber:?/?Employer:\\s*([^\\n]+)", text) || re("Employer:\\s*([^\\n]+)", text);
  d.pruefgrundlage = re("Specification:\\s*([^\\n]+)", text) || re("Pr.fgrundlage:.*?:\\s*([^\\n]+)", text);
  extractKehlFach(d, rows, text);
  const tbl = buildTable(rows);
  fillTableFields(d, tbl, text);
  d.werkstoff = re("Parent metal:\\s*(.+?)\\.\\s*(?:Zusatz|$)", text) || re("Werkstoff\\s*/\\s*Parent metal:\\s*(.+?)\\.\\s", text);
  d.zusatz_filler = re("Zusatz\\s*/\\s*Filler:\\s*(.+?)\\.", text) || re("Filler:\\s*(.+?)\\.", text);
  d.datum_schweissen = re("Date of welding\\s*(\\d{4}-\\d{2}-\\d{2})", text);
  d.verlaengerung_nach = re("Revalidation method\\s*([\\d\\.]+\\s*[a-zA-Z]?)", text);
  d.gueltig_bis = re("Validity until\\s*(\\d{4}-\\d{2}-\\d{2})", text);
}

export function isScanned(words: Wort[], text: string): boolean {
  return words.length < 25 && text.trim().length < 200;
}

// Bereich aus dem vom Prüfer selbst angegebenen Geltungsbereich-Text parsen, z. B.
// "3,00 - 10,20" -> {min:3, max:10.2}, "≥ 25,00" -> {min:25, max:null} (nach oben offen).
function parseBereich(s: string): { min: number; max: number | null } | null {
  const text = (s || "").trim();
  if (!text || /^-+$/.test(text)) return null;
  const num = (x: string) => parseFloat(x.replace(",", "."));
  let m = /([\d]+[.,]?[\d]*)\s*(?:-|bis|to)\s*([\d]+[.,]?[\d]*)/i.exec(text);
  if (m) return { min: num(m[1]), max: num(m[2]) };
  m = /(?:≥|>=|ab)\s*([\d]+[.,]?[\d]*)/.exec(text);
  if (m) return { min: num(m[1]), max: null };
  m = /^([\d]+[.,]?[\d]*)$/.exec(text);
  if (m) return { min: num(m[1]), max: num(m[1]) };
  return null;
}

const ALLE_POSITIONEN = ["PA", "PB", "PC", "PD", "PE", "PF", "PG", "PH", "PJ", "HL045", "JL045"];
// Positions-Geltungsbereich-Text parsen: entweder "Alle außer / All except PG" (Ausschlussliste)
// oder eine direkte Aufzählung ("ss mb, bs, ss gb" o. Ä. kommt hier nicht vor, nur Positionscodes).
function parsePositionsGeltung(s: string): string[] | null {
  const text = (s || "").trim();
  if (!text || /^-+$/.test(text)) return null;
  if (/alle außer|all except/i.test(text)) {
    const ausgeschlossen = (text.match(/PA|PB|PC|PD|PE|PF|PG|PH|PJ|HL045|JL045/gi) || []).map((x) => x.toUpperCase());
    return ALLE_POSITIONEN.filter((p) => !ausgeschlossen.includes(p));
  }
  const liste = text.match(/PA|PB|PC|PD|PE|PF|PG|PH|PJ|HL045|JL045/gi);
  return liste && liste.length ? [...new Set(liste.map((x) => x.toUpperCase()))] : null;
}

// Nur die reine Auswertung von bereits extrahierten Wörtern/Text (kein PDF-Zugriff) – testbar
// ohne Browser/pdfjs. Das Einlesen der PDF-Seiten selbst passiert im Client (siehe ZertifikatUpload).
// Bildet die Rohfelder des Zertifikats auf die Formularfelder der Schweißer-Seite ab
// (einfache, best-effort Erkennung – der Mensch sieht die Werte im Formular und bestätigt/korrigiert).
// Wichtig: wo das Zertifikat den Geltungsbereich (Dicke/Durchmesser/Position) bereits selbst
// ausweist, wird DER übernommen statt ihn aus dem Prüfstück-Wert neu zu berechnen – der Prüfer
// kennt z. B. bei kombinierten Zertifikaten (mehrere Prüfstücke) den tatsächlichen Gesamtbereich,
// während eine Neuberechnung aus nur einem Prüfstück den Bereich unterschätzen könnte.
export type FormularWerte = {
  name?: string; process?: string; mg?: string; nahtart?: "BW" | "FW"; produkt?: "P" | "T";
  bezeichnung?: string; s_oder_t?: number; durchmesser?: number; position_roh?: string; bis?: string;
  thickness_min?: number; thickness_max?: number; diameter_min?: number; diameter_max?: number; positions?: string[];
  fmGroup?: string; fillerType?: string; weldDetail?: string; layerBuild?: "sl" | "ml";
};
export function zuFormular(d: Zertifikat): FormularWerte {
  const out: FormularWerte = {};
  if (d.name) out.name = d.name;
  if (d.bezeichnung) out.bezeichnung = d.bezeichnung;
  const prozessM = /\d+/.exec(d.schweissprozess || "");
  if (prozessM) out.process = prozessM[0];
  const mgM = /[\d.]+/.exec(d.werkstoffgruppe || "");
  if (mgM) out.mg = mgM[0];
  const nahtM = /\b(BW|FW)\b/i.exec(d.nahtart || "");
  if (nahtM) out.nahtart = nahtM[1].toUpperCase() as "BW" | "FW";

  const dickeRoh = out.nahtart === "FW" ? d.werkstoffdicke_t || d.schweissgutdicke_s : d.schweissgutdicke_s || d.werkstoffdicke_t;
  const dickeM = /([\d]+[.,]?[\d]*)/.exec(dickeRoh || "");
  if (dickeM) out.s_oder_t = parseFloat(dickeM[1].replace(",", "."));
  const dickeGeltung = out.nahtart === "FW" ? d.werkstoffdicke_t_g || d.schweissgutdicke_s_g : d.schweissgutdicke_s_g || d.werkstoffdicke_t_g;
  const dickeBereich = parseBereich(dickeGeltung || "");
  if (dickeBereich) { out.thickness_min = dickeBereich.min; if (dickeBereich.max !== null) out.thickness_max = dickeBereich.max; }

  const dM = /([\d]+[.,]?[\d]*)/.exec(d.rohraussendurchmesser || "");
  if (dM) { out.durchmesser = parseFloat(dM[1].replace(",", ".")); out.produkt = "T"; }
  const durchmesserBereich = parseBereich(d.rohraussendurchmesser_g || "");
  if (durchmesserBereich) { out.diameter_min = durchmesserBereich.min; if (durchmesserBereich.max !== null) out.diameter_max = durchmesserBereich.max; }

  const posM = /\b(PA|PB|PC|PD|PE|PF|PG|PH|PJ|HL045|JL045)\b/i.exec(d.schweissposition || "");
  if (posM) out.position_roh = posM[1].toUpperCase();
  const positionenGeltung = parsePositionsGeltung(d.schweissposition_geltung || "");
  if (positionenGeltung) out.positions = positionenGeltung;

  if (d.gueltig_bis && /^\d{4}-\d{2}-\d{2}/.test(d.gueltig_bis)) out.bis = d.gueltig_bis.slice(0, 10);

  // Fallback, wenn die einzelnen Felder nicht erkannt wurden (z. B. bei per OCR gelesenen
  // gescannten Seiten ohne Textlayer/Tabellenstruktur, wo nur der Bezeichnung-Fließtext
  // zuverlässig lesbar ist): Verfahren/Produktform/Nahtart/Dicke/Durchmesser/Position direkt
  // aus der Bezeichnung selbst ableiten, z. B. "ISO 9606-1 141 T BW FM5 S s5,1 D48,3 PH-L045 ss gb".
  if (d.bezeichnung) ausBezeichnungErgaenzen(out, d.bezeichnung);
  if (!out.produkt) out.produkt = "P";
  return out;
}

function ausBezeichnungErgaenzen(out: FormularWerte, bezeichnung: string) {
  const m = /\b(\d{2,3})\s+([PT])\s+(BW|FW)\b/i.exec(bezeichnung);
  if (m) {
    if (!out.process) out.process = m[1];
    if (!out.produkt) out.produkt = m[2].toUpperCase() as "P" | "T";
    if (!out.nahtart) out.nahtart = m[3].toUpperCase() as "BW" | "FW";
  }
  if (out.s_oder_t === undefined) {
    const sM = /\bs\s*([\d]+[.,]?[\d]*)/i.exec(bezeichnung);
    if (sM) out.s_oder_t = parseFloat(sM[1].replace(",", "."));
  }
  if (out.durchmesser === undefined) {
    const dM = /\bD\s*([\d]+[.,]?[\d]*)/.exec(bezeichnung);
    if (dM) out.durchmesser = parseFloat(dM[1].replace(",", "."));
  }
  if (!out.position_roh) {
    const posM = /\b(PA|PB|PC|PD|PE|PF|PG|PH|PJ|HL045|JL045)\b/i.exec(bezeichnung);
    if (posM) out.position_roh = posM[1].toUpperCase();
  }
  // FM-Gruppe/Schweißzusatzart/Schweißdetail/Lagenaufbau hat das Zertifikat nirgends als eigenes
  // Feld, sondern nur codiert in der Bezeichnung selbst (z. B. "... FM1 S s8 D50 PH-L045 ss gb").
  const geparst = parsePruefbezeichnung(bezeichnung);
  if (!out.fmGroup && geparst.fmGroup) out.fmGroup = geparst.fmGroup;
  if (!out.fillerType && geparst.fillerType) out.fillerType = geparst.fillerType;
  if (!out.weldDetail && geparst.weldDetail) out.weldDetail = geparst.weldDetail;
  if (!out.layerBuild && geparst.layerBuild) out.layerBuild = geparst.layerBuild;
}

export function auswerten(words: Wort[], text: string, datei: string, seite: number, pages: number): Zertifikat {
  const d = {} as Zertifikat;
  FIELD_ORDER.forEach((k) => { (d as any)[k] = ""; });
  d._datei = datei; d._seite = seite; d._pages = pages; d._ocr_used = false; d._error = "";
  try {
    if (isDvsFormat(text)) fillDvs(d, text);
    else if (isTuevNord(text)) fillTuevNord(d, words, text);
    else fillTuevThueringen(d, text); // auch für TÜV Thüringen (gleiche Fallback-Logik wie Referenz-App)
  } catch (exc) {
    d._error = String(exc && (exc as any).message ? (exc as any).message : exc);
  }
  return d;
}
