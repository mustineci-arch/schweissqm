import { ctx } from "@/lib/tenant";
import { gesamt, schweisserGegenWps, wpsGegenWpqr } from "@/lib/deckung";

export default async function Page({ searchParams }: { searchParams: Promise<{ rev?: string; welder?: string; wpqr?: string }> }) {
  const { rev, welder, wpqr } = await searchParams;
  const { sb } = await ctx();
  const [{ data: revs }, { data: welders }, { data: qs }] = await Promise.all([
    sb.from("wps_revisions").select("id,revision,process,material_group,thickness_min,thickness_max,diameter_min,wps(wps_no)").order("created_at"),
    sb.from("welders").select("id,name,welder_certificates(process,material_group,thickness_min,thickness_max,diameter_min,valid_until)").order("name"),
    sb.from("wpqr").select("id,wpqr_no,process,material_group").order("wpqr_no"),
  ]);
  const r = (revs as any[] | null)?.find((x) => x.id === rev);
  const w = (welders as any[] | null)?.find((x) => x.id === welder);
  const q = (qs as any[] | null)?.find((x) => x.id === wpqr);
  const blocks: { titel: string; punkte: ReturnType<typeof wpsGegenWpqr> }[] = [];
  if (r && w) for (const c of w.welder_certificates as any[]) blocks.push({ titel: `Schweißer ${w.name} ↔ WPS`, punkte: schweisserGegenWps(r, c) });
  if (r && w && (w.welder_certificates as any[]).length === 0) blocks.push({ titel: `Schweißer ${w.name}: keine Prüfung hinterlegt`, punkte: [] });
  if (r && q) blocks.push({ titel: `WPS ↔ WPQR ${q.wpqr_no}`, punkte: wpsGegenWpqr(r, q) });

  return (
    <>
      <h1>Deckungsprüfung</h1>
      <form className="card" method="get">
        <select name="rev" defaultValue={rev}><option value="">WPS wählen</option>
          {(revs as any[] | null)?.map((x) => <option key={x.id} value={x.id}>{x.wps?.wps_no} Rev.{x.revision}</option>)}</select>
        <select name="welder" defaultValue={welder}><option value="">Schweißer wählen</option>
          {(welders as any[] | null)?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select name="wpqr" defaultValue={wpqr}><option value="">WPQR wählen</option>
          {(qs as any[] | null)?.map((x) => <option key={x.id} value={x.id}>{x.wpqr_no}</option>)}</select>
        <button>Prüfen</button>
      </form>
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
