import { parsePruefbezeichnung } from "@/lib/bezeichnung-parser";
import {
  bwThicknessRange, fwThicknessRange, diameterRange, positionScope,
  werkstoffgruppeGedeckt, WERKSTOFFGRUPPEN_QUALIFIKATION, POSITION_MATRIX_BW, POSITION_MATRIX_FW,
  PROZESS_AEQUIVALENZ, FM_SCOPE, ZUSATZART_SCOPE, DETAIL_SCOPE, LAGENAUFBAU_SCOPE,
} from "@/lib/iso9606";
import {
  VERFAHREN_NAMEN, POSITION_NAMEN, FM_NAMEN, SCHWEISSZUSATZART_NAMEN, SCHWEISSDETAIL_NAMEN,
  LAGENAUFBAU_NAMEN, WERKSTOFFGRUPPEN_NAMEN,
} from "@/lib/norm-namen";

const unendlich = (v: number | null) => (v === Infinity ? "∞" : v);
const mitNamen = (codes: string[], namen: Record<string, string>) => codes.map((x) => namen[x] ? `${x} (${namen[x]})` : x).join(", ");

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
      <p className="sub">Prüfungsbezeichnung entschlüsseln, Werkstoffgruppen vergleichen und alle hinterlegten Qualifikationsmatrizen nachschlagen (DIN EN ISO 9606-1).</p>

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
            <tr><td>FM-Gruppe</td><td>{geparst.fmGroup ?? "–"}{geparst.fmGroup && FM_NAMEN[geparst.fmGroup] ? ` · ${FM_NAMEN[geparst.fmGroup]}` : ""}</td></tr>
            <tr><td>Schweißzusatzart</td><td>{geparst.fillerType ?? "–"}{geparst.fillerType && SCHWEISSZUSATZART_NAMEN[geparst.fillerType] ? ` · ${SCHWEISSZUSATZART_NAMEN[geparst.fillerType]}` : ""}</td></tr>
            <tr><td>Prüfstückdicke</td><td>{geparst.dicke ?? "–"} mm</td></tr>
            <tr><td>Rohraußendurchmesser</td><td>{geparst.durchmesser ?? "–"} mm</td></tr>
            <tr><td>Prüfposition</td><td>{geparst.position ?? "–"}{geparst.position && POSITION_NAMEN[geparst.position.replace(/-.*/, "")] ? ` · ${POSITION_NAMEN[geparst.position.replace(/-.*/, "")]}` : ""}</td></tr>
            <tr><td>Schweißdetail</td><td>{geparst.weldDetail ?? "–"}{geparst.weldDetail && SCHWEISSDETAIL_NAMEN[geparst.weldDetail] ? ` · ${SCHWEISSDETAIL_NAMEN[geparst.weldDetail]}` : ""}</td></tr>
            <tr><td>Lagenaufbau</td><td>{geparst.layerBuild ?? "–"}{geparst.layerBuild && LAGENAUFBAU_NAMEN[geparst.layerBuild] ? ` · ${LAGENAUFBAU_NAMEN[geparst.layerBuild]}` : ""}</td></tr>
          </tbody></table>
          {geparst.unerkannt.length > 0 && <p className="err">Nicht erkannte Teile: {geparst.unerkannt.join(", ")}</p>}

          <h3>Geltungsbereich</h3>
          <table><tbody>
            <tr><td>Verfahren deckt auch</td><td>{geparst.process ? mitNamen(PROZESS_AEQUIVALENZ[geparst.process] ?? [geparst.process], VERFAHREN_NAMEN) : "–"}</td></tr>
            <tr><td>Dicke</td><td>{dicke ? `${dicke.min ?? "–"} – ${unendlich(dicke.max)} mm` : "nicht berechenbar (Nahtart/Dicke fehlt)"}</td></tr>
            <tr><td>Durchmesser</td><td>{durchmesser ? (durchmesser.min !== null ? `${durchmesser.min} – ${unendlich(durchmesser.max)} mm` : "– (Blech)") : "nicht berechenbar (Produktform/Durchmesser fehlt)"}</td></tr>
            <tr><td>Positionen</td><td>{positionen ? mitNamen(positionen, POSITION_NAMEN) : "nicht berechenbar (Nahtart/Position fehlt)"}</td></tr>
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
        <summary>CEN ISO/TR 15608 – alle Werkstoffgruppen (bescheinigt → deckt ab)</summary>
        <table><thead><tr><th>Bescheinigt</th><th>Beispielwerkstoffe</th><th>Deckt ab</th></tr></thead><tbody>
          {Object.entries(WERKSTOFFGRUPPEN_QUALIFIKATION).map(([g, liste]) => (
            <tr key={g}><td>{g} – {WERKSTOFFGRUPPEN_NAMEN[g]?.name ?? ""}</td><td className="sub">{WERKSTOFFGRUPPEN_NAMEN[g]?.beispiele ?? "–"}</td><td>{liste.join(", ")}</td></tr>
          ))}
        </tbody></table>
      </details>

      <h2>Alle Qualifikationsmatrizen</h2>
      <p className="sub">Jede Spalte zeigt, was eine Prüfung in dieser Spalte über die Äquivalenz-/Qualifikationsregeln zusätzlich mit abdeckt.</p>
      <div className="grid2">
        <details>
          <summary>Abschnitt 5.2 – Verfahren-Äquivalenzen</summary>
          <table><thead><tr><th>Geprüft</th><th>Deckt ab</th></tr></thead><tbody>
            {Object.entries(PROZESS_AEQUIVALENZ).map(([p, liste]) => <tr key={p}><td>{p} · {VERFAHREN_NAMEN[p] ?? ""}</td><td>{mitNamen(liste, VERFAHREN_NAMEN)}</td></tr>)}
          </tbody></table>
        </details>
        <details>
          <summary>Tabelle 2/3 – FM-Gruppen</summary>
          <table><thead><tr><th>Geprüft</th><th>Deckt ab</th></tr></thead><tbody>
            {Object.entries(FM_SCOPE).map(([f, liste]) => <tr key={f}><td>{f} · {FM_NAMEN[f] ?? ""}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </details>
        <details>
          <summary>Tabelle 5 – Schweißzusatzarten</summary>
          <table><thead><tr><th>Geprüft</th><th>Deckt ab</th></tr></thead><tbody>
            {Object.entries(ZUSATZART_SCOPE).map(([f, liste]) => <tr key={f}><td>{f} · {SCHWEISSZUSATZART_NAMEN[f] ?? ""}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </details>
        <details>
          <summary>Tabelle 11 – Schweißdetails</summary>
          <table><thead><tr><th>Geprüft</th><th>Deckt ab</th></tr></thead><tbody>
            {Object.entries(DETAIL_SCOPE).map(([f, liste]) => <tr key={f}><td>{f} · {SCHWEISSDETAIL_NAMEN[f] ?? ""}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </details>
        <details>
          <summary>Tabelle 12 – Lagenaufbau</summary>
          <table><thead><tr><th>Geprüft</th><th>Deckt ab</th></tr></thead><tbody>
            {Object.entries(LAGENAUFBAU_SCOPE).map(([f, liste]) => <tr key={f}><td>{f} · {LAGENAUFBAU_NAMEN[f] ?? ""}</td><td>{liste.join(", ")}</td></tr>)}
          </tbody></table>
        </details>
        <details>
          <summary>Tabelle 6/7/8 – Dicke &amp; Durchmesser (Formeln)</summary>
          <table><tbody>
            <tr><td>BW-Dicke s &lt; 3</td><td>s bis max(3; 2s)</td></tr>
            <tr><td>BW-Dicke 3 ≤ s &lt; 12</td><td>3 bis 2s</td></tr>
            <tr><td>BW-Dicke s ≥ 12</td><td>≥ 3</td></tr>
            <tr><td>FW-Dicke t &lt; 3</td><td>t bis max(3; 2t)</td></tr>
            <tr><td>FW-Dicke t ≥ 3</td><td>≥ 3</td></tr>
            <tr><td>Durchmesser D ≤ 25</td><td>D bis 2D</td></tr>
            <tr><td>Durchmesser D &gt; 25</td><td>≥ max(0,5D; 25 mm)</td></tr>
          </tbody></table>
        </details>
      </div>

      <h2>Positions-Matrizen (Tabelle 9/10)</h2>
      <p className="sub">Geprüfte Position → qualifizierte Positionen, ohne die Sonderregeln aus Abschnitt 5.8 (PC-Zusatzprüfung, Mehrpositionsprüfung – siehe Schweißer-Detailseite für den vollständigen, je Zertifikat berechneten Geltungsbereich inkl. dieser Zusatzregeln).</p>
      <div className="grid2">
        <div>
          <h3>BW · Stumpfnaht (Tabelle 9)</h3>
          <table><thead><tr><th>Geprüft</th><th>Qualifiziert</th></tr></thead><tbody>
            {Object.entries(POSITION_MATRIX_BW).map(([p, liste]) => <tr key={p}><td>{p} · {POSITION_NAMEN[p] ?? ""}</td><td>{mitNamen(liste, POSITION_NAMEN)}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <h3>FW · Kehlnaht (Tabelle 10)</h3>
          <table><thead><tr><th>Geprüft</th><th>Qualifiziert</th></tr></thead><tbody>
            {Object.entries(POSITION_MATRIX_FW).map(([p, liste]) => <tr key={p}><td>{p} · {POSITION_NAMEN[p] ?? ""}</td><td>{mitNamen(liste, POSITION_NAMEN)}</td></tr>)}
          </tbody></table>
        </div>
      </div>
      <p className="hinweis">
        Mussmann-Beispiele und ein Speicher für Norm-PDFs aus der Referenz-App sind hier (noch) nicht umgesetzt.
        Wichtig: Diese Seite zeigt die reinen Normtabellen. Ein echtes Zertifikat kann einen breiteren
        Geltungsbereich ausweisen (z. B. kombinierte Zertifikate mit mehreren Prüfstücken) – in dem Fall hat
        der vom Zeugnis selbst ausgewiesene Geltungsbereich Vorrang (siehe Schweißer-Detailseite).
      </p>
    </>
  );
}
