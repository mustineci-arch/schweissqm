import { ctx } from "@/lib/tenant";
import { ampel } from "@/lib/fristen";
import { FristAmpel } from "@/components/Ampel";

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("welder_certificates").select("id,standard,process,material_group,valid_until,last_confirmed_on,welders(name)");
  const rows = ((data ?? []) as any[]).map((c) => ({ ...c, a: ampel(c.valid_until) }))
    .sort((x, y) => (x.a.tage ?? 99999) - (y.a.tage ?? 99999));
  return (
    <>
      <h1>Fristen</h1>
      <p className="sub">Überfällige zuerst. Rot = abgelaufen, gelb = innerhalb 60 Tage, grün = gültig, grau = kein Datum.</p>
      <table><thead><tr><th>Schweißer</th><th>Prüfung</th><th>Verfahren</th><th>Werkstoff</th><th>Gültig bis</th></tr></thead><tbody>
        {rows.map((c) => (
          <tr key={c.id}><td>{c.welders?.name}</td><td>{c.standard}</td><td>{c.process}</td><td>{c.material_group ?? "–"}</td><td><FristAmpel datum={c.valid_until} /></td></tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={5}>Keine Prüfungen hinterlegt.</td></tr>}
      </tbody></table>
    </>
  );
}
