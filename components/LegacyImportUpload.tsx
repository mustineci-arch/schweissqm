"use client";
import { useState } from "react";

export function LegacyImportUpload() {
  const [laedt, setLaedt] = useState(false);
  const [ergebnis, setErgebnis] = useState<string | null>(null);

  async function onDateien(e: React.ChangeEvent<HTMLInputElement>) {
    const dateien = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!dateien.length) return;
    setLaedt(true); setErgebnis(null);
    try {
      const fd = new FormData();
      dateien.forEach((d) => fd.append("dateien", d));
      const resp = await fetch("/wpqr/legacy-import/save", { method: "POST", body: fd });
      const daten = await resp.json();
      if (!resp.ok) throw new Error(daten.fehler ?? "Fehler beim Import");
      setErgebnis(daten.ergebnis);
    } catch (err) {
      setErgebnis(err instanceof Error ? `Fehler: ${err.message}` : "Fehler beim Import");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="card">
      <label className="f">🗂 Dateien wählen (mehrere auf einmal möglich)
        <input type="file" accept="application/json,.json" multiple onChange={onDateien} disabled={laedt} />
      </label>
      {laedt && <p className="sub">Importiere …</p>}
      {ergebnis && <p className={ergebnis.startsWith("Fehler") ? "err" : "ok"} style={{ marginTop: 10 }}>{ergebnis}</p>}
    </div>
  );
}
