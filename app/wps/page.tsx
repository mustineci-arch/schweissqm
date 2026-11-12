import Link from "next/link";
import { redirect } from "next/navigation";
import { ctx } from "@/lib/tenant";
import { fehlendeAngaben } from "@/lib/wps";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: w, error } = await sb.from("wps").insert({ tenant_id: tenantId, wps_no: String(fd.get("no")).trim(), title: String(fd.get("title")).trim() || null }).select("id").single();
  if (error || !w) redirect("/wps?fehler=" + encodeURIComponent(error?.code === "23505" ? "WPS-Nr existiert schon" : error?.message ?? "Fehler"));
  const { error: e2 } = await sb.from("wps_revisions").insert({ tenant_id: tenantId, wps_id: w.id, revision: 0, process: String(fd.get("process")).trim(), joint_type: "BW" });
  if (e2) redirect("/wps?fehler=" + encodeURIComponent(e2.message));
  redirect(`/wps/${w.id}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const { sb } = await ctx();
  const { data } = await sb.from("wps").select("id,wps_no,title,wps_revisions(id,revision,status,process,joint_type,material_group,thickness_min,thickness_max,positions,filler,shielding_gas,released_at)").order("wps_no");
  const rows = ((data ?? []) as any[]).map((w) => {
    const revs = [...w.wps_revisions].sort((a: any, b: any) => b.revision - a.revision);
    const cur = revs[0];
    return { w, cur, fehlt: cur && cur.status === "entwurf" ? fehlendeAngaben(cur).length : 0 };
  }).filter((x) => x.cur);
  const frei = rows.filter((x) => x.cur.status === "freigegeben").length;
  const entw = rows.filter((x) => x.cur.status === "entwurf").length;
  const offen = rows.reduce((s, x) => s + x.fehlt, 0);
  return (
    <>
      <h1>WPS</h1>
      <div className="zustand">
        <span className="chip"><b>{frei}</b>freigegeben</span><span className="chip"><b>{entw}</b>Entwürfe</span><span className="chip"><b>{offen}</b>offene Pflichtangaben</span>
      </div>
      {fehler && <p className="err">{fehler}</p>}
      <form className="card" action={neu}>
        <input name="no" placeholder="WPS-Nr" required /><input name="title" placeholder="Titel (optional)" />
        <input name="process" placeholder="Verfahren (z. B. 135)" required />
        <button>WPS anlegen</button>
      </form>
      <table><thead><tr><th>WPS-Nr</th><th>Verfahren</th><th>Naht</th><th>Werkstoff</th><th>Dicke</th><th>Positionen</th><th>Zustand</th><th>Aktion</th></tr></thead><tbody>
        {rows.map(({ w, cur, fehlt }) => (
          <tr key={w.id}><td><b>{w.wps_no}</b><div className="sub" style={{ margin: 0 }}>{w.title}</div></td><td>{cur.process}</td><td>{cur.joint_type ?? "–"}</td><td>{cur.material_group ?? "–"}</td>
            <td>{cur.thickness_min ?? "–"}–{cur.thickness_max ?? "–"}</td><td>{(cur.positions ?? []).join(", ") || "–"}</td>
            <td><span className={`status ${cur.status}`}>{cur.status}</span>{cur.status === "entwurf" && fehlt > 0 && <div className="herkunft">{fehlt} Pflichtangabe(n) fehlen</div>}</td>
            <td>{cur.status === "freigegeben" ? <Link className="btn sek" href={`/wps/${w.id}`}>Ausgabe Rev. {cur.revision}</Link> : <Link className="btn" href={`/wps/${w.id}`}>{cur.status === "entwurf" ? "Bearbeiten" : "Öffnen"}</Link>}</td></tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={8}>Noch keine WPS.</td></tr>}
      </tbody></table>
    </>
  );
}
