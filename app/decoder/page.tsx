import { parsePruefbezeichnung } from "@/lib/bezeichnung-parser";
import {
  bwThicknessRange, fwThicknessRange, diameterRange, positionScope,
  werkstoffgruppeGedeckt, WERKSTOFFGRUPPEN_QUALIFIKATION, POSITION_MATRIX_BW, POSITION_MATRIX_FW,
} from "@/lib/iso9606";

const VERFAHREN_NAMEN: Record<string, string> = {
  "111": "Lichtbogenhandschweißen (E)", "121": "UP-Einzeldraht", "125": "Fülldraht-UP",
  "131": "MIG", "135": "MAG (Massivdraht)", "136": "MAG (Fülldraht)", "138": "MAG (Metallpulver-Fülldraht)",
  "141": "WIG (TIG)", "142": "WIG ohne Zusatz (Autogen-WIG)", "143": "WIG mit Fülldraht", "145": "WIG mit Pulver-Fülldraht",
  "311": "Autogenschweißen",
};

const unendlich = (v: number | null) => (v === Infinity ? "∞" : v);

export default async function Decoder({ searchParams }: { searchParams: Promise<{ bez?: string; bgrp1?: string; bgrp2?: string }> }) {
  const sp = await searchParams;
  const bez = (sp.bez ?? "").trim();
  const geparst = bez ? parsePruefbezeichnung(bez) : null;

  let dicke: ReturnType<typeof bwThicknessRange> | null = null;
  let durchmesser: ReturnType<typeof diameterRange> | null = null;
  let positionen: string[] | null = null;
  if (geparst) {
    if (geparst.nahtart && geparst.dicke !== null) {
      dicke = geparst.nahtart === "FW" ? fwThicknessRange(geparst.dicke) : bwThicknessRange(geparst.dicke, geparst.process ? [geparst.process] : []);
    }
    if (geparst.produkt && geparst.durchmesser !== null) durchmesser = diameterRange(geparst.durchmesser, geparst.produkt);
    if (geparst.nahtart && geparst.position) {
      positionen = positionScope({
        nahtart: geparst.nahtart, produkt: geparst.produkt ?? "P", position: geparst.position.replace(/-.*/, ""),
        durchmesser: geparst.durchmesser, hatPC: false, mehrfachlage: false, richtung: "steigend",
      });
    }
  }

  const bgrp1 = (sp.bgrp1 ?? "").trim();
  const bgrp2 = (sp.bgrp2 ?? "").trim();
  const wgErgebnis = bgrp1 && bgrp2 ? werkstoffgruppeGedeckt(bgrp1, bgrp2) : null;

  return (
    <>
      <h1>Decoder &amp; Normregeln</h1>
      <p className="sub">Prüfungsbezeichnung entschlüsseln, Werkstoffgruppen vergleichen und die hinterlegten Positions-Matrizen nachschlagen (DIN EN ISO 9606-1).</p>

      <h2>Prüfungsbezeichnung entschlüsseln</h2>
      <form className="card" method="get">
        <input name="bez" defaultValue={bez} placeholder="z. B. 141 T BW FM3 S s3,6 D60,3 PH ss nb ml" style={{ width: "100%" }} />
        <input type="hidden" name="bgrp1" value={bgrp1} /><input type="hidden" name="bgrp2" value={bgrp2} />
        <button>Entschlüsseln</button>
      </form>
      {geparst && (
        <div className="card">
          <table><tbody>
            <tr><td>Verfahren</td><td><code>{geparst.process ?? "–"}</code>{geparst.process && VERFAHREN_NAMEN[geparst.process] ? ` · ${VERFAHREN_NAMEN[geparst.process]}` : ""}</td></tr>
            <tr><td>Produktform</td><td>{geparst.produkt === "T" ? "T · Rohr" : geparst.produkt === "P" ? "P · Blech" : "–"}</td></tr>
            <tr><td>Nahtart</td><td>{geparst.nahtart === "BW" ? "BW · Stumpfnaht" : geparst.nahtart === "FW" ? "FW · Kehlnaht" : "–"}</td></tr>
            <tr><td>FM-Gruppe</td><td>{geparst.fmGroup ?? "–"}</td></tr>
            <tr><td>Schweißzusatzart</td><td>{geparst.fillerType ?? "–"}</td></tr>
            <tr><td>Prüfstückdicke</td><td>{geparst.dicke ?? "–"} mm</td></tr>
            <tr><td>Rohraußendurchmesser</td><td>{geparst.durchmesser ?? "–"} mm</td></tr>
            <tr><td>Prüfposition</td><td>{geparst.position ?? "–"}</td></tr>
            <tr><td>Schweißdetail</td><td>{geparst.weldDetail ?? "–"}</td></tr>
            <tr><td>Lagenaufbau</td><td>{geparst.layerBuild ?? "–"}</td></tr>
          </tbody></table>
          {geparst.unerkannt.length > 0 && <p className="err">Nicht erkannte Teile: {geparst.unerkannt.join(", ")}</p>}

          <h3>Geltungsbereich</h3>
          <table><tbody>
            <tr><td>Dicke</td><td>{dicke ? `${dicke.min ?? "–"} – ${unendlich(dicke.max)} mm` : "nicht berechenbar (Nahtart/Dicke fehlt)"}</td></tr>
            <tr><td>Durchmesser</td><td>{durchmesser ? (durchmesser.min !== null ? `${durchmesser.min} – ${unendlich(durchmesser.max)} mm` : "– (Blech)") : "nicht berechenbar (Produktform/Durchmesser fehlt)"}</td></tr>
            <tr><td>Positionen</td><td>{positionen ? positionen.join(", ") : "nicht berechenbar (Nahtart/Position fehlt)"}</td></tr>
          </tbody></table>
        </div>
      )}

      <h2>Werkstoffgruppen-Prüfung</h2>
      <p className="sub">Prüft, ob eine bescheinigte Werkstoffgruppe eine andere (z. B. eine Auftragsgruppe) nach Abschnitt 5.5/CEN ISO-TR 15608 mit abdeckt.</p>
      <form className="card" method="get">
        <input type="hidden" name="bez" value={bez} />
        <input name="bgrp1" defaultValue={bgrp1} placeholder="Bescheinigte Gruppe (z. B. 1.3)" />
        <input name="bgrp2" defaultValue={bgrp2} placeholder="Auftragsgruppe (z. B. 1.1)" />
        <button>Prüfen</button>
      </form>
      {wgErgebnis !== null && (
        <p className={wgErgebnis ? "ok" : "err"}>
          {wgErgebnis ? `✔ Gruppe ${bgrp1} deckt Gruppe ${bgrp2} mit ab.` : `✘ Gruppe ${bgrp1} deckt Gruppe ${bgrp2} nicht ab.`}
        </p>
      )}
      <details>
        <summary className="sub">Hinterlegte Qualifikationsmatrix (bescheinigte Gruppe → abgedeckte Gruppen)</summary>
        <table><thead><tr><th>Bescheinigt</th><th>Deckt ab</th></tr></thead><tbody>
          {Object.entries(WERKSTOFFGRUPPEN_QUALIFIKATION).map(([g, liste]) => (
            <tr key={g}><td>{g}</td><td>{liste.join(", ")}</td></tr>
          ))}
        </tbody></table>
      </details>

      <h2>Positions-Matrizen (Tabelle 9/10)</h2>
      <p className="sub">Geprüfte Position → qualifizierte Positionen, ohne die Sonderregeln aus Abschnitt 5.8 (PC-Zusatzprüfung, Mehrpositionsprüfung).</p>
      <div className="grid2">
        <div>
          <h3>BW · Stumpfnaht (Tabelle 9)</h3>
          <table><thead><tr><th>Geprüft</th><th>Qualifiziert</th></tr></thead><tbody>
            {Object.entries(POSITION_MATRIX_BW).map(([p, liste]) => <tr key={p}><td>{p}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <h3>FW · Kehlnaht (Tabelle 10)</h3>
          <table><thead><tr><th>Geprüft</th><th>Qualifiziert</th></tr></thead><tbody>
            {Object.entries(POSITION_MATRIX_FW).map(([p, liste]) => <tr key={p}><td>{p}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </div>
      </div>
      <p className="hinweis">
        Mussmann-Beispiele und ein Speicher für Norm-PDFs aus der Referenz-App sind hier (noch) nicht umgesetzt –
        die Geltungsbereichs-Berechnung oben nutzt dieselbe Normrechner-Logik wie der Schweißer-Bereich.
      </p>
    </>
  );
}
