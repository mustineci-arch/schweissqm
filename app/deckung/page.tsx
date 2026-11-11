import { ctx } from "@/lib/tenant";
import { ladeDeckung } from "@/lib/deckung-load";

export default async function Page({ searchParams }: { searchParams: Promise<{ rev?: string; welder?: string; wpqr?: string }> }) {
  const sp = await searchParams;
  const { sb } = await ctx();
  const { R, W, Q, blocks, gesamt } = await ladeDeckung(sb, sp);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <h1>Deckungsprüfung</h1>
      <form className="card" method="get">
        <select name="rev" defaultValue={sp.rev}><option value="">WPS wählen</option>
          {R.map((x) => <option key={x.id} value={x.id}>{x.wps?.wps_no} Rev.{x.revision} ({x.status})</option>)}</select>
        <select name="welder" defaultValue={sp.welder}><option value="">Schweißer wählen</option>
          {W.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select name="wpqr" defaultValue={sp.wpqr}><option value="">WPQR wählen</option>
          {Q.map((x) => <option key={x.id} value={x.id}>{x.wpqr_no}</option>)}</select>
        <button>Prüfen</button>
      </form>
      {blocks.length > 0 && <p><a href={`/deckung/pdf?${qs}`}>PDF-Nachweis herunterladen</a></p>}
      {blocks.map((b, i) => {
        const g = gesamt(b.punkte);
        return (
          <section key={i}>
            <h2>{b.titel}: <span className={g}>{g}</span></h2>
            {b.punkte.length > 0 && (
              <table><thead><tr><th>Parameter</th><th>WPS (Soll)</th><th>Nachweis (Ist)</th><th>Regel</th><th>Ergebnis</th></tr></thead><tbody>
                {b.punkte.map((p, j) => <tr key={j}><td>{p.parameter}</td><td>{p.soll}</td><td>{p.ist}</td><td>{p.regel}</td><td className={p.status}>{p.status}</td></tr>)}
              </tbody></table>
            )}
          </section>
        );
      })}
      <p style={{ marginTop: 16 }}>Hinweis: Geltungsbereiche nach Norm (z. B. ISO 15614-1) sind noch nicht als validiertes Regelset hinterlegt und bleiben NICHT_BEWERTBAR. Keine Freigabe ohne Prüfung durch die Schweißaufsicht.</p>
    </>
  );
}
