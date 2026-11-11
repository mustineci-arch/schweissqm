import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: w } = await sb.from("wps").insert({ tenant_id: tenantId, wps_no: String(fd.get("no")), title: String(fd.get("title")) || null }).select("id").single();
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  if (w) await sb.from("wps_revisions").insert({
    tenant_id: tenantId, wps_id: w.id, revision: 0, process: String(fd.get("process")),
    material_group: String(fd.get("mg")) || null, thickness_min: n("tmin"), thickness_max: n("tmax"),
  });
  revalidatePath("/wps");
}

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("wps").select("id,wps_no,title,wps_revisions(revision,status,process,material_group,thickness_min,thickness_max)").order("wps_no");
  return (
    <>
      <h1>WPS</h1>
      <form className="card" action={neu}>
        <input name="no" placeholder="WPS-Nr" required /><input name="title" placeholder="Titel" />
        <input name="process" placeholder="Verfahren" required /><input name="mg" placeholder="Werkstoffgruppe" />
        <input name="tmin" type="number" step="0.1" placeholder="Dicke min" /><input name="tmax" type="number" step="0.1" placeholder="Dicke max" />
        <button>Anlegen (Rev. 0)</button>
      </form>
      <table><thead><tr><th>WPS-Nr</th><th>Titel</th><th>Rev.</th><th>Status</th><th>Verfahren</th><th>Werkstoff</th><th>Dicke</th></tr></thead><tbody>
        {(data ?? []).flatMap((w) => (w.wps_revisions as any[]).map((r) => (
          <tr key={w.id + r.revision}><td>{w.wps_no}</td><td>{w.title}</td><td>{r.revision}</td><td>{r.status}</td><td>{r.process}</td><td>{r.material_group}</td><td>{r.thickness_min ?? "–"}–{r.thickness_max ?? "–"}</td></tr>
        )))}
      </tbody></table>
    </>
  );
}
