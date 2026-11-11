import { redirect } from "next/navigation";
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

async function neueRevision(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const wpsId = String(fd.get("wps_id"));
  const { data: revs } = await sb.from("wps_revisions").select("*").eq("wps_id", wpsId).order("revision", { ascending: false });
  const last = revs?.[0];
  if (!last) return;
  if (revs!.some((r) => r.status === "entwurf")) redirect("/wps?fehler=" + encodeURIComponent("Es gibt bereits einen Entwurf"));
  const { id, status, released_by, released_at, created_at, ...rest } = last;
  const { error } = await sb.from("wps_revisions").insert({ ...rest, revision: last.revision + 1 });
  if (error) redirect("/wps?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/wps");
}

async function freigeben(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const { error } = await sb.from("wps_revisions").update({ status: "freigegeben" }).eq("id", String(fd.get("id")));
  if (error) redirect("/wps?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/wps");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const { sb, role } = await ctx();
  const kannFreigeben = role === "sfi" || role === "admin";
  const { data } = await sb.from("wps").select("id,wps_no,title,wps_revisions(id,revision,status,process,material_group,thickness_min,thickness_max,released_at)").order("wps_no");
  return (
    <>
      <h1>WPS</h1>
      {fehler && <p className="err">{fehler}</p>}
      <form className="card" action={neu}>
        <input name="no" placeholder="WPS-Nr" required /><input name="title" placeholder="Titel" />
        <input name="process" placeholder="Verfahren" required /><input name="mg" placeholder="Werkstoffgruppe" />
        <input name="tmin" type="number" step="0.1" placeholder="Dicke min" /><input name="tmax" type="number" step="0.1" placeholder="Dicke max" />
        <button>Anlegen (Rev. 0, Entwurf)</button>
      </form>
      <table><thead><tr><th>WPS-Nr</th><th>Titel</th><th>Rev.</th><th>Status</th><th>Verfahren</th><th>Werkstoff</th><th>Dicke</th><th>Aktion</th></tr></thead><tbody>
        {(data ?? []).flatMap((w) => {
          const revs = [...(w.wps_revisions as any[])].sort((a, b) => b.revision - a.revision);
          return revs.map((r, i) => (
            <tr key={r.id}><td>{w.wps_no}</td><td>{w.title}</td><td>{r.revision}</td><td>{r.status}{r.released_at ? ` (${r.released_at.slice(0, 10)})` : ""}</td>
              <td>{r.process}</td><td>{r.material_group}</td><td>{r.thickness_min ?? "–"}–{r.thickness_max ?? "–"}</td>
              <td>
                {r.status === "entwurf" && kannFreigeben && <form action={freigeben}><input type="hidden" name="id" value={r.id} /><button>Freigeben</button></form>}
                {r.status === "entwurf" && !kannFreigeben && "wartet auf SFI"}
                {i === 0 && r.status !== "entwurf" && <form action={neueRevision}><input type="hidden" name="wps_id" value={w.id} /><button>Neue Revision</button></form>}
              </td></tr>
          ));
        })}
      </tbody></table>
    </>
  );
}
