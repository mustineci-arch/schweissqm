"use client";
import { useState } from "react";
import { extrahiereZertifikate } from "@/lib/pdf-zertifikat";
import { zuFormular, type Zertifikat } from "@/lib/zert-extractor";

type Zeile = ReturnType<typeof zuFormular> & { _datei: string; _seite: number; _fehler?: string };

export function BulkZertifikatImport() {
  const [laedt, setLaedt] = useState(false);
  const [fortschritt, setFortschritt] = useState("");
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [uebersprungen, setUebersprungen] = useState<{ datei: string; seite: number; grund: string }[]>([]);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [speichertLaedt, setSpeichertLaedt] = useState(false);

  async function onDateien(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    e.target.value = "";
    if (!dateien.length) return;
    setLaedt(true); setErgebnis(null);
    const neueZeilen: Zeile[] = [];
    const neueUebersprungen: { datei: string; seite: number; grund: string }[] = [];
    for (let i = 0; i < dateien.length; i++) {
      const datei = dateien[i];
      setFortschritt(`Lese ${i + 1}/${dateien.length}: ${datei.name}`);
      try {
        const records = await extrahiereZertifikate(datei);
        for (const d of records) {
          if (d._error) { neueUebersprungen.push({ datei: datei.name, seite: d._seite, grund: d._error }); continue; }
          const f = zuFormular(d);
          if (!f.process) { neueUebersprungen.push({ datei: datei.name, seite: d._seite, grund: "Kein Verfahren erkannt" }); continue; }
          neueZeilen.push({ ...f, _datei: datei.name, _seite: d._seite });
        }
      } catch (err) {
        neueUebersprungen.push({ datei: datei.name, seite: 1, grund: err instanceof Error ? err.message : "Konnte PDF nicht lesen." });
      }
    }
    setZeilen((z) => [...z, ...neueZeilen]);
    setUebersprungen((z) => [...z, ...neueUebersprungen]);
    setLaedt(false); setFortschritt("");
  }

  function feldAendern(i: number, feld: keyof Zeile, wert: string) {
    setZeilen((z) => z.map((zeile, idx) => (idx === i ? { ...zeile, [feld]: wert } : zeile)));
  }

  function zeileEntfernen(i: number) {
    setZeilen((z) => z.filter((_, idx) => idx !== i));
  }

  async function alleUebernehmen() {
    setSpeichertLaedt(true); setErgebnis(null);
    try {
      const resp = await fetch("/schweisser/bulk-import/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zeilen }) });
      const daten = await resp.json();
      if (!resp.ok) throw new Error(daten.fehler ?? "Fehler beim Speichern");
      setErgebnis(daten.ergebnis);
      setZeilen([]);
    } catch (err) {
      setErgebnis(err instanceof Error ? `Fehler: ${err.message}` : "Fehler beim Speichern");
    } finally {
      setSpeichertLaedt(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <label className="f">📂 Ordner wählen (alle PDFs inkl. Unterordner)
        {/* @ts-expect-error webkitdirectory ist nicht im React-Typ, wird aber von Browsern unterstützt */}
        <input type="file" webkitdirectory="" directory="" multiple onChange={onDateien} disabled={laedt} />
      </label>
      <label className="f" style={{ marginTop: 8 }}>📄 oder einzelne PDFs wählen (mehrere möglich)
        <input type="file" accept="application/pdf" multiple onChange={onDateien} disabled={laedt} />
      </label>
      {laedt && <p className="sub">{fortschritt || "Lese PDFs …"}</p>}

      {uebersprungen.length > 0 && (
        <div className="err" style={{ marginTop: 10 }}>
          {uebersprungen.length} Seite(n) übersprungen:
          <ul style={{ margin: "4px 0 0 18px" }}>
            {uebersprungen.map((u, i) => <li key={i}>{u.datei} (Seite {u.seite}): {u.grund}</li>)}
          </ul>
        </div>
      )}

      {zeilen.length > 0 && (
        <>
          <p className="sub" style={{ marginTop: 10 }}>{zeilen.length} Zertifikat(e) gefunden – Namen prüfen/korrigieren, dann übernehmen. Gespeichert wird erst nach „Alle übernehmen“.</p>
          <table><thead><tr><th>Datei</th><th>Name</th><th>Bezeichnung</th><th>Verfahren</th><th>Gültig bis</th><th></th></tr></thead><tbody>
            {zeilen.map((z, i) => (
              <tr key={i}>
                <td style={{ fontSize: 12 }}>{z._datei} S.{z._seite}</td>
                <td><input value={z.name ?? ""} onChange={(e) => feldAendern(i, "name", e.target.value)} placeholder="Name (bitte prüfen)" style={{ width: 160 }} /></td>
                <td style={{ fontSize: 12 }}>{z.bezeichnung ?? "–"}</td>
                <td>{z.process}</td>
                <td>{z.bis ?? "–"}</td>
                <td><button type="button" className="sek" onClick={() => zeileEntfernen(i)}>✕</button></td>
              </tr>
            ))}
          </tbody></table>
          <button type="button" style={{ marginTop: 8 }} onClick={alleUebernehmen} disabled={speichertLaedt || zeilen.some((z) => !z.name)}>
            {speichertLaedt ? "Speichere …" : `✔ Alle ${zeilen.length} übernehmen`}
          </button>
          {zeilen.some((z) => !z.name) && <p className="err" style={{ marginTop: 6 }}>Bitte bei allen Zeilen einen Namen eintragen.</p>}
        </>
      )}
      {ergebnis && <p className={ergebnis.startsWith("Fehler") ? "err" : "ok"} style={{ marginTop: 10 }}>{ergebnis}</p>}
    </div>
  );
}
