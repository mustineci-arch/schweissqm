import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { gesamt, schweisserGegenWps } from "@/lib/deckung";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  const v = (k: string) => (String(fd.get(k) ?? "") || null);
  await sb.from("welds").insert({
    tenant_id: tenantId, project_id: String(fd.get("project")), weld_no: String(fd.get("no")),
    object: v("object"), joint_type: String(fd.get("typ")), material_group: v("mg"),
    thickness: n("dicke"), diameter: n("dn"), wps_revision_id: v("rev"), welder_id: v("welder"),
  });
  revalidatePath("/naehte");
}
async function status(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  await sb.from("welds").update({ status: String(fd.get("status")) }).eq("id", String(fd.get("id")));
  revalidatePath("/naehte");
}

export default async function Page() {
  const { sb } = await ctx();
  const [{ data: projects }, { data: revs }, { data: welders }, { data: welds }] = await Promise.all([
    sb.from("projects").select("id,project_no").order("project_no"),
    sb.from("wps_revisions").select("id,revision,process,material_group,thickness_min,thickness_max,diameter_min,wps(wps_no)"),
    sb.from("welders").select("id,name,welder_certificates(process,material_group,thickness_min,thickness_max,diameter_min,valid_until)"),
    sb.from("welds").select("*, projects(project_no)").order("weld_no"),
  ]);
  const R = (revs ?? []) as any[]; const W = (welders ?? []) as any[];
  const pruef = (w: any) => {
    const r = R.find((x) => x.id === w.wps_revision_id); const s = W.find((x) => x.id === w.welder_id);
    if (!r || !s) return "NICHT_BEWERTBAR";
    const certs = s.welder_certificates as any[];
    if (certs.length === 0) return "NICHT_BEWERTBAR";
    const erg = certs.map((c) => gesamt(schweisserGegenWps(r, c)));
    return erg.includes("GEDECKT") ? "GEDECKT" : erg.includes("NICHT_GEDECKT") ? "NICHT_GEDECKT" : "NICHT_BEWERTBAR";
  };
  return (
    <>
      <h1>Schweißnähte</h1>
      <form className="card" action={neu}>
        <select name="project" required><option value="">Projekt</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.project_no}</option>)}</select>
        <input name="no" placeholder="Naht-Nr" required /><input name="object" placeholder="Objekt/Bauteil" />
        <select name="typ"><option>BW</option><option>FW</option></select>
        <input name="mg" placeholder="Werkstoffgruppe" /><input name="dicke" type="number" step="0.1" placeholder="Dicke" /><input name="dn" type="number" step="0.1" placeholder="Durchmesser" />
        <select name="rev"><option value="">WPS</option>{R.map((r) => <option key={r.id} value={r.id}>{r.wps?.wps_no} Rev.{r.revision}</option>)}</select>
        <select name="welder"><option value="">Schweißer</option>{W.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button>Anlegen</button>
      </form>
      <table><thead><tr><th>Projekt</th><th>Naht</th><th>Objekt</th><th>Typ</th><th>Dicke</th><th>Status</th><th>Schweißer↔WPS</th></tr></thead><tbody>
        {((welds ?? []) as any[]).map((w) => {
          const p = pruef(w);
          return (
            <tr key={w.id}><td>{w.projects?.project_no}</td><td>{w.weld_no}</td><td>{w.object}</td><td>{w.joint_type}</td><td>{w.thickness ?? "–"}</td>
              <td><form action={status}><input type="hidden" name="id" value={w.id} />
                <select name="status" defaultValue={w.status}><option>offen</option><option>geschweisst</option><option>geprueft</option><option>freigegeben</option></select><button>OK</button></form></td>
              <td className={p}>{p}</td></tr>
          );
        })}
      </tbody></table>
    </>
  );
}
