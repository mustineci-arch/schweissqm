"use client";
import { useMemo, useState } from "react";
import { NORM_REGELN } from "@/lib/norm-regeln";

// Nachgebaut aus dem "Normregeln"-Tab der Referenz-App (iso9606-audit-engine.vercel.app):
// durchsuchbare Liste links, Detailtabelle rechts/darunter beim Anklicken.
export function NormregelnBrowser() {
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return NORM_REGELN;
    return NORM_REGELN.filter((r) => {
      const text = (r.key + " " + r.title + " " + (r.note ?? "") + " " + r.rows.map((row) => row.join(" ")).join(" ")).toLowerCase();
      return text.includes(q);
    });
  }, [suche]);

  const regel = NORM_REGELN.find((r) => r.key === gewaehlt) ?? null;

  return (
    <div className="grid2">
      <div className="card">
        <label className="f">Normregel suchen
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="z. B. Dicke, Durchmesser, FM, Nahtart, Tabelle 7, 5.3" />
        </label>
        <p className="sub">{suche ? `${treffer.length} Treffer für: ${suche}` : `${NORM_REGELN.length} implementierte Normbereiche verfügbar`}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {treffer.map((r) => (
            <button type="button" key={r.key} className="sek" style={gewaehlt === r.key ? { borderColor: "var(--kupfer)", borderWidth: 2 } : undefined} onClick={() => setGewaehlt(r.key)}>
              {r.title}
            </button>
          ))}
          {treffer.length === 0 && <p className="sub">Keine passende Normregel gefunden.</p>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Normregel anzeigen</h3>
        {!regel && <p className="sub">Bitte links eine Tabelle auswählen.</p>}
        {regel && (
          <>
            <p><b>{regel.title}</b></p>
            {regel.note && <p className="sub">{regel.note}</p>}
            <table><thead><tr><th>{regel.headers[0]}</th><th>{regel.headers[1]}</th></tr></thead><tbody>
              {regel.rows.map((row, i) => <tr key={i}><td><b>{row[0]}</b></td><td>{row[1]}</td></tr>)}
            </tbody></table>
          </>
        )}
      </div>
    </div>
  );
}
