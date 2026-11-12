import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { pruefeZuordnung } from "@/lib/zuordnung";

const FOLGE: Record<string, { next: string; label: string }> = {
  offen: { next: "geschweisst", label: "Freigeben & starten" },
  geschweisst: { next: "geprueft", label: "Als geprüft melden" },
  geprueft: { next: "freigegeben", label: "Naht freigeben" },
};

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  const v = (k: string) => (String(fd.get(k) ?? "").trim() || null);
  const { error } = await sb.from("welds").insert({
    tenant_id: tenantId, project_id: String(fd.get("project")), weld_no: String(fd.get("no")).trim(),
    object: v("object"), joint_type: String(fd.get("typ")), material_group: v("mg"), thickness: n("dicke"), diameter: n("dn"),
  });
  if (error) redirect("/naehte?fehler=" + encodeURIComponent(error.code === "23505" ? "Naht-Nr existiert im Projekt schon" : error.message));
  revalidatePath("/naehte");
}

async function zuordnen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("id")); const rev = String(fd.get("rev")); const welder = String(fd.get("welder"));
  if (!rev || !welder) redirect("/naehte?fehler=" + encodeURIComponent("WPS und Schweißer wählen"));
  const p = await pruefeZuordnung(sb, id, rev, welder);
  if (!p.ok) redirect("/naehte?fehler=" + encodeURIComponent("Zuordnung blockiert: " + p.gruende.join(" | ")));
  const { error } = await sb.from("welds").update({ wps_revision_id: rev, welder_id: welder }).eq("id", id);
  if (error) redirect("/naehte?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/naehte");
}

async function weiter(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("id"));
  const { data: w } = await sb.from("welds").select("status,wps_revision_id,welder_id").eq("id", id).maybeSingle();
  if (!w) return;
  const f = FOLGE[w.status];
  if (!f) return;
  if (w.status === "offen") {
    if (!w.wps_revision_id || !w.welder_id) redirect("/naehte?fehler=" + encodeURIComponent("Erst WPS und Schweißer zuordnen"));
    const p = await pruefeZuordnung(sb, id, w.wps_revision_id, w.welder_id);
    if (!p.ok) redirect("/naehte?fehler=" + encodeURIComponent("Start blockiert: " + p.gruende.join(" | ")));
  }
  await sb.from("welds").update({ status: f.next }).eq("id", id);
  revalidatePath("/naehte");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const { sb } = await ctx();
  const [{ data: projects }, { data: revs }, { data: welders }, { data: welds }] = await Promise.all([
    sb.from("projects").select("id,project_no").order("project_no"),
    sb.from("wps_revisions").select("id,revision,wps(wps_no)").eq("status", "freigegeben"),
    sb.from("welders").select("id,name").order("name"),
    sb.from("welds").select("*, projects(project_no)").order("weld_no"),
  ]);
  const R = (revs ?? []) as any[]; const W = (welders ?? []) as any[]; const N = (welds ?? []) as any[];
  const zaehl = (s: string) => N.filter((n) => n.status === s).length;
  return (
    <>
      <h1>Schweißnähte</h1>
      <p className="sub">Zuordnung nur mit freigegebener WPS und gedeckter Schweißerprüfung. Fehlende Deckung blockiert mit Begründung.</p>
      <div className="zustand">
        <span className="chip"><b>{zaehl("offen")}</b>offen</span><span className="chip"><b>{zaehl("geschweisst")}</b>geschweißt</span>
        <span className="chip"><b>{zaehl("geprueft")}</b>geprüft</span><span className="chip"><b>{zaehl("freigegeben")}</b>freigegeben</span>
      </div>
      {fehler && <p className="err">{fehler}</p>}
      <form className="card" action={neu}>
        <select name="project" required><option value="">Projekt</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.project_no}</option>)}</select>
        <input name="no" placeholder="Naht-Nr" required /><input name="object" placeholder="Objekt/Bauteil" />
        <select name="typ"><option>BW</option><option>FW</option></select>
        <input name="mg" placeholder="Werkstoffgruppe" /><input name="dicke" type="number" step="0.1" placeholder="Dicke mm" /><input name="dn" type="number" step="0.1" placeholder="Durchmesser" />
        <button>Naht anlegen</button>
      </form>
      <table><thead><tr><th>Projekt</th><th>Naht</th><th>Objekt</th><th>Typ</th><th>Werkstoff</th><th>Dicke</th><th>Zuordnung WPS / Schweißer</th><th>Status</th><th>Aktion</th></tr></thead><tbody>
        {N.map((w) => {
          const f = FOLGE[w.status];
          return (
            <tr key={w.id}><td>{w.projects?.project_no}</td><td>{w.weld_no}</td><td>{w.object}</td><td>{w.joint_type}</td><td>{w.material_group ?? "–"}</td><td>{w.thickness ?? "–"}</td>
              <td>
                {w.status === "offen" ? (
                  <form action={zuordnen} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={w.id} />
                    <select name="rev" defaultValue={w.wps_revision_id ?? ""}><option value="">WPS (freigegeben)</option>{R.map((r) => <option key={r.id} value={r.id}>{r.wps?.wps_no} Rev.{r.revision}</option>)}</select>
                    <select name="welder" defaultValue={w.welder_id ?? ""}><option value="">Schweißer</option>{W.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    <button className="sek">Zuordnen</button>
                  </form>
                ) : (<>{R.find((r) => r.id === w.wps_revision_id)?.wps?.wps_no ?? "WPS zugeordnet"} / {W.find((s) => s.id === w.welder_id)?.name ?? "–"}</>)}
              </td>
              <td><span className="status">{w.status}</span></td>
              <td>{f && <form action={weiter}><input type="hidden" name="id" value={w.id} /><button disabled={w.status === "offen" && !(w.wps_revision_id && w.welder_id)}>{f.label}</button></form>}</td></tr>
          );
        })}
        {N.length === 0 && <tr><td colSpan={9}>Noch keine Nähte.</td></tr>}
      </tbody></table>
    </>
  );
}
