// Liest eine Zertifikat-PDF im Browser ein (pdfjs-dist) und wertet jede Seite mit
// lib/zert-extractor.ts aus. Nur Textlayer-PDFs – gescannte Seiten (kein Textlayer,
// OCR) werden aktuell NICHT unterstützt und als Fehler markiert.
import type { Wort, Zertifikat } from "./zert-extractor";
import { auswerten, isScanned, wordsToText } from "./zert-extractor";

// Emuliert pdfplumber extract_words aus pdfjs-Textitems: Leerzeichen-Items sind echte
// Wortgrenzen, eng benachbarte Fragmente ohne Trenner werden zusammengeführt.
async function extractWordsFromPage(page: any): Promise<Wort[]> {
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const pageH = viewport.height;
  type Frag = { text: string; x0: number; x1: number; top: number; base: number };
  const raw: Frag[] = [];
  const seps: { x0: number; x1: number; base: number }[] = [];

  content.items.forEach((item: any) => {
    if (item.str === undefined) return;
    const tx = item.transform;
    const x = tx[4], y = tx[5];
    const h = item.height || Math.abs(tx[3]) || 10;
    const top = pageH - y - h;

    if (!item.str.trim()) {
      if (item.str.length) seps.push({ x0: x, x1: x + item.width, base: y });
      return;
    }
    const str = item.str as string;
    const charW = str.length ? item.width / str.length : 0;

    const parts: { s: string; i: number; e: number }[] = [];
    const wre = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = wre.exec(str)) !== null) parts.push({ s: m[0], i: m.index, e: m.index + m[0].length });

    const merged: { s: string; i: number; e: number }[] = [];
    parts.forEach((p) => {
      const prev = merged[merged.length - 1];
      if (prev) {
        const gapChars = p.i - prev.e;
        const glue = gapChars === 1 && (
          /[^\s-]-$/.test(prev.s) ||
          /^[\.;]/.test(p.s) ||
          (/\d$/.test(prev.s) && /^-[A-Za-z0-9]/.test(p.s))
        );
        if (glue) { prev.s += p.s; prev.e = p.e; return; }
        seps.push({ x0: x + prev.e * charW, x1: x + p.i * charW, base: y });
      }
      merged.push({ s: p.s, i: p.i, e: p.e });
    });

    merged.forEach((p, idx) => {
      let x1 = x + p.e * charW;
      if (idx === merged.length - 1 && /\S$/.test(str)) x1 = x + item.width;
      raw.push({ text: p.s, x0: x + p.i * charW, x1, top, base: y });
    });
  });

  function sepBetween(a: Frag, b: Frag): boolean {
    return seps.some((s) => Math.abs(s.base - a.base) <= 2.5 && s.x1 > a.x1 - 0.5 && s.x0 < b.x0 + 0.5);
  }

  const yTol = 2.5;
  const sortedRaw = [...raw].sort((a, b) => a.base - b.base);
  const rowsRaw: Frag[][] = [];
  let curRow: Frag[] | null = null, prevKey: number | null = null;
  sortedRaw.forEach((w) => {
    if (curRow === null || prevKey === null || w.base - prevKey > yTol) { curRow = []; rowsRaw.push(curRow); }
    curRow!.push(w);
    prevKey = w.base;
  });

  const words: Wort[] = [];
  rowsRaw.forEach((row) => {
    const sorted = [...row].sort((a, b) => a.x0 - b.x0);
    let cur: Wort | null = null;
    sorted.forEach((w) => {
      if (cur && w.x0 - cur.x1 < 3 && w.x0 - cur.x1 > -2 && !sepBetween({ text: cur.text, x0: cur.x0, x1: cur.x1, top: cur.top, base: cur.base }, w)) {
        cur.text += w.text; cur.x1 = Math.max(cur.x1, w.x1); cur.top = Math.min(cur.top, w.top);
      } else {
        if (cur) words.push(cur);
        cur = { text: w.text, x0: w.x0, x1: w.x1, top: w.top, base: w.base };
      }
    });
    if (cur) words.push(cur);
  });
  return words;
}

// Ein einziger Tesseract-Worker für die gesamte Sitzung (Erststart lädt WASM-Core + Sprachdaten
// von einer CDN und dauert ein paar Sekunden, danach ist er für weitere Seiten/Dateien bereit).
let ocrWorkerPromise: ReturnType<typeof ladeOcrWorker> | null = null;
async function ladeOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("deu");
}
async function holeOcrWorker() {
  if (!ocrWorkerPromise) ocrWorkerPromise = ladeOcrWorker();
  return ocrWorkerPromise;
}

// Rendert eine PDF-Seite in erhöhter Auflösung auf ein <canvas> (bessere OCR-Erkennung als bei
// Bildschirmauflösung) und lässt Tesseract den reinen Text erkennen. Liefert nur Fließtext ohne
// Wortpositionen – Tabellen-/Positionsbasierte Felder (TÜV-NORD-Format) bleiben daher leer;
// zuFormular() fängt die wichtigsten davon über einen Bezeichnung-Fallback auf.
async function ocrSeite(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const worker = await holeOcrWorker();
  const { data } = await worker.recognize(canvas);
  return data.text;
}

export async function extrahiereZertifikate(file: File): Promise<Zertifikat[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const records: Zertifikat[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const words = await extractWordsFromPage(page);
    const text = wordsToText(words);
    if (isScanned(words, text)) {
      try {
        const ocrText = await ocrSeite(page);
        const rec = auswerten([], ocrText, file.name, pageNum, doc.numPages);
        rec._ocr_used = true;
        if (!rec.bezeichnung && !rec.name) rec._error = "OCR konnte keine verwertbaren Felder erkennen – bitte Werte manuell eintragen/prüfen.";
        records.push(rec);
      } catch (err) {
        records.push({
          _datei: file.name, _seite: pageNum, _pages: doc.numPages, _ocr_used: false,
          _error: "OCR fehlgeschlagen: " + (err instanceof Error ? err.message : String(err)),
        } as Zertifikat);
      }
      continue;
    }
    records.push(auswerten(words, text, file.name, pageNum, doc.numPages));
  }
  return records;
}
