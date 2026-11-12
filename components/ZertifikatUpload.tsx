"use client";
import { useState } from "react";
import { extrahiereZertifikate } from "@/lib/pdf-zertifikat";
import { zuFormular, type Zertifikat } from "@/lib/zert-extractor";

// Setzt die Werte in die umgebende <form> anhand der name-Attribute (keine eigene
// Formular-State-Verwaltung, der Mensch sieht die vorbefüllten Felder und bestätigt/korrigiert
// vor dem Absenden – genau wie bei den "Vorschlag aus ... bitte bestätigen"-Hinweisen anderswo).
function setzeFormularWerte(form: HTMLFormElement, werte: ReturnType<typeof zuFormular>) {
  const setzen = (name: string, wert: string | number | undefined) => {
    if (wert === undefined || wert === "") return;
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = String(wert);
  };
  setzen("name", werte.name);
  setzen("bezeichnung", werte.bezeichnung);
  setzen("process", werte.process);
  setzen("mg", werte.mg);
  setzen("nahtart", werte.nahtart);
  setzen("produkt", werte.produkt);
  setzen("s_oder_t", werte.s_oder_t);
  setzen("durchmesser", werte.durchmesser);
  setzen("position_roh", werte.position_roh);
  setzen("bis", werte.bis);
  // Vom Prüfer selbst ausgewiesener Geltungsbereich hat Vorrang vor dem Normrechner
  // (siehe neu() in app/schweisser/page.tsx: manuelle Felder überschreiben ihn nicht).
  setzen("tmin", werte.thickness_min);
  setzen("tmax", werte.thickness_max);
  setzen("dmin", werte.diameter_min);
  setzen("dmax", werte.diameter_max);
  if (werte.positions?.length) setzen("positions", werte.positions.join(", "));
}

export function ZertifikatUpload() {
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [records, setRecords] = useState<Zertifikat[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLaedt(true); setFehler(null); setRecords([]);
    try {
      const recs = await extrahiereZertifikate(file);
      if (recs.length === 1) {
        uebernehmen(recs[0]);
      } else {
        setRecords(recs);
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Konnte PDF nicht lesen.");
    } finally {
      setLaedt(false);
    }
  }

  function uebernehmen(d: Zertifikat) {
    const form = document.querySelector("form.card") as HTMLFormElement | null;
    if (!form) return;
    setzeFormularWerte(form, zuFormular(d));
    setRecords([]);
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <label className="f">Zertifikat-PDF einlesen (TÜV NORD, TÜV Thüringen, DVS – nur Textlayer, keine Scans)
        <input type="file" accept="application/pdf" onChange={onFile} disabled={laedt} />
      </label>
      {laedt && <p className="sub">Lese PDF …</p>}
      {fehler && <p className="err">{fehler}</p>}
      {records.length > 1 && (
        <div>
          <p className="sub">{records.length} Seiten gefunden – welche übernehmen?</p>
          {records.map((d, i) => (
            <div key={i} className="card" style={{ margin: "6px 0" }}>
              <b>Seite {d._seite}/{d._pages}</b>{d.name ? ` · ${d.name}` : ""}{d.bezeichnung ? ` · ${d.bezeichnung}` : ""}
              {d._error && <div className="err">{d._error}</div>}
              {!d._error && <button type="button" className="sek" onClick={() => uebernehmen(d)}>Übernehmen</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
