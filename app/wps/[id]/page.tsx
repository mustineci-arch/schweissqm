import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { fehlendeAngaben } from "@/lib/wps";

function lies(fd: FormData) {
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const n = (k: string) => { const v = String(fd.get(k) ?? "").trim().replace(",", "."); return v === "" ? null : Number(v); };
  const pos = (t("positions") ?? "").split(/[\s,;]+/).map((x) => x.toUpperCase()).filter(Boolean);
  return {
    process: t("process"), joint_type: t("joint_type"), material_group: t("material_group"),
    product_type: t("product_type"), fm_group: t("fm_group"), filler_type: t("filler_type"),
    weld_detail: t("weld_detail"), layer_build: t("layer_build"),
    thickness_min: n("thickness_min"), thickness_max: n("thickness_max"), diameter_min: n("diameter_min"),
    positions: pos, filler: t("filler"), shielding_gas: t("shielding_gas"), heat_input_max: n("heat_input_max"),
    origin: {},
  };
}

async function speichern(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("rev_id")); const wps = String(fd.get("wps_id"));
  const { error } = await sb.from("wps_revisions").update(lies(fd)).eq("id", id);
  if (error) redirect(`/wps/${wps}?fehler=` + encodeURIComponent(error.message));
  revalidatePath(`/wps/${wps}`);
  redirect(`/wps/${wps}?ok=Gespeichert`);
}

async function speichernUndFreigeben(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("rev_id")); const wps = String(fd.get("wps_id"));
  const { error } = await sb.from("wps_revisions").update(lies(fd)).eq("id", id);
  if (error) redirect(`/wps/${wps}?fehler=` + encodeURIComponent(error.message));
  const { error: e2 } = await sb.from("wps_revisions").update({ status: "freigegeben" }).eq("id", id);
  if (e2) redirect(`/wps/${wps}?fehler=` + encodeURIComponent(e2.message));
  revalidatePath("/wps");
  redirect(`/wps/${wps}?ok=Freigegeben`);
}

async function neueRevision(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const wps = String(fd.get("wps_id"));
  const { data: revs } = await sb.from("wps_revisions").select("*").eq("wps_id", wps).order("revision", { ascending: false });
  const last = revs?.[0];
  if (!last) return;
  if (revs!.some((r) => r.status === "entwurf")) redirect(`/wps/${wps}?fehler=` + encodeURIComponent("Es gibt bereits einen Entwurf"));
  const { id, status, released_by, released_at, created_at, ...rest } = last;
  const { error } = await sb.from("wps_revisions").insert({ ...rest, origin: {}, revision: last.revision + 1 });
  if (error) redirect(`/wps/${wps}?fehler=` + encodeURIComponent(error.message));
  revalidatePath("/wps");
  redirect(`/wps/${wps}?ok=Kopie als Entwurf angelegt`);
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; ok?: string; rev?: string }> }) {
  const { id } = await params; const { fehler, ok, rev } = await searchParams;
  const { sb, role } = await ctx();
  const { data: w } = await sb.from("wps").select("id,wps_no,title,wps_revisions(*)").eq("id", id).maybeSingle();
  if (!w) notFound();
  const revs = [...(w.wps_revisions as any[])].sort((a, b) => b.revision - a.revision);
  const r = revs.find((x) => x.id === rev) ?? revs[0];
  const edit = r.status === "entwurf";
  const fehlt = edit ? fehlendeAngaben(r) : [];
  const kannFrei = role === "sfi" || role === "admin";
  const origin = (r.origin ?? {}) as Record<string, string>;
  const feld = (name: string, label: string, val: any, extra: Record<string, any> = {}) => (
    <label className="f" id={name}>{label}
      <input name={name} defaultValue={val ?? ""} disabled={!edit} {...extra} />
      {origin[name] && <span className="herkunft">Vorschlag aus {origin[name]} – bitte bestätigen</span>}
    </label>
  );
  return (
    <form action={speichern}>
      <p><Link href="/wps">← WPS-Liste</Link></p>
      <h1>WPS {w.wps_no} · Rev. {r.revision} <span className={`status ${r.status}`}>{r.status}</span></h1>
      <p className="sub">{w.title}{r.released_at ? ` · freigegeben am ${String(r.released_at).slice(0, 10)}` : ""}</p>
      {fehler && <p className="err">{fehler}</p>}{ok && <p className="ok">{ok}</p>}
      <input type="hidden" name="rev_id" value={r.id} /><input type="hidden" name="wps_id" value={w.id} />
      <div className="card"><h2 style={{ marginTop: 0 }}>Verfahren und Naht</h2><div className="grid2">
        {feld("process", "Verfahren (ISO 4063)", r.process)}
        <label className="f" id="joint_type">Nahtart<select name="joint_type" defaultValue={r.joint_type ?? ""} disabled={!edit}><option value="">–</option><option>BW</option><option>FW</option></select></label>
        {feld("material_group", "Werkstoffgruppe", r.material_group)}
        {feld("positions", "Positionen (z. B. PA, PC)", (r.positions ?? []).join(", "))}
        <label className="f" id="product_type">Produktform (optional)<select name="product_type" defaultValue={r.product_type ?? ""} disabled={!edit}><option value="">–</option><option value="P">P Blech</option><option value="T">T Rohr</option></select></label>
      </div></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>Bereiche</h2><div className="grid2">
        {feld("thickness_min", "Dicke min (mm)", r.thickness_min, { type: "number", step: "0.1" })}
        {feld("thickness_max", "Dicke max (mm)", r.thickness_max, { type: "number", step: "0.1" })}
        {feld("diameter_min", "Durchmesser min (mm)", r.diameter_min, { type: "number", step: "0.1" })}
        {feld("heat_input_max", "Wärmeeinbringung max (kJ/mm)", r.heat_input_max, { type: "number", step: "0.01" })}
      </div></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>Weitere Kriterien (optional, nur nötig wenn gefordert)</h2><div className="grid2">
        <label className="f" id="fm_group">FM-Gruppe<select name="fm_group" defaultValue={r.fm_group ?? ""} disabled={!edit}><option value="">–</option>{["FM1", "FM2", "FM3", "FM4", "FM5", "FM6"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f" id="filler_type">Schweißzusatzart<select name="filler_type" defaultValue={r.filler_type ?? ""} disabled={!edit}><option value="">–</option>{["S", "M", "B", "R", "PZ", "V", "W", "Y", "Z", "C"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f" id="weld_detail">Schweißdetail<select name="weld_detail" defaultValue={r.weld_detail ?? ""} disabled={!edit}><option value="">–</option>{["ss_nb", "ss_mb", "bs", "ss_gb", "ci", "ss_fb"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f" id="layer_build">Lagenaufbau<select name="layer_build" defaultValue={r.layer_build ?? ""} disabled={!edit}><option value="">–</option><option value="sl">sl einlagig</option><option value="ml">ml mehrlagig</option></select></label>
      </div></div>
      <div className="card"><h2 style={{ marginTop: 0 }}>Zusatz und Gas</h2><div className="grid2">
        {feld("filler", "Zusatzwerkstoff", r.filler)}
        {feld("shielding_gas", "Schutzgas", r.shielding_gas)}
      </div></div>

      <h2>Revisionen</h2>
      <table><thead><tr><th>Rev.</th><th>Status</th><th>Freigabe</th><th></th></tr></thead><tbody>
        {revs.map((x) => <tr key={x.id}><td>{x.revision}</td><td><span className={`status ${x.status}`}>{x.status}</span></td><td>{x.released_at ? String(x.released_at).slice(0, 10) : "–"}</td><td>{x.id === r.id ? "angezeigt" : <Link href={`/wps/${w.id}?rev=${x.id}`}>anzeigen</Link>}</td></tr>)}
      </tbody></table>

      <div className="leiste">
        <div className="offen">
          {edit ? (fehlt.length === 0 ? "Alle Pflichtangaben vorhanden." : <>Offen ({fehlt.length}): {fehlt.map((f, i) => <span key={f.feld}>{i > 0 && ", "}<a href={`#${f.feld}`}>{f.name}</a></span>)}</>)
                : r.status === "freigegeben" ? "Freigegebene Revision ist unveränderlich." : "Ersetzte Revision (gesperrt)."}
          {edit && !kannFrei && <div style={{ fontSize: 12, opacity: .8 }}>Freigabe nur durch SFI oder Admin.</div>}
          {edit && <div style={{ fontSize: 12, opacity: .8 }}>Die Liste zeigt den gespeicherten Stand.</div>}
        </div>
        {edit && <button className="sek" formAction={speichern}>Speichern</button>}
        {edit && <button className="kupfer" formAction={speichernUndFreigeben} disabled={!kannFrei}>Speichern & freigeben</button>}
        {r.status === "freigegeben" && r.id === revs[0].id && <button formAction={neueRevision}>Kopie als Entwurf (neue Revision)</button>}
      </div>
    </form>
  );
}
