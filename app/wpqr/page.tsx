import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { apStatus } from "@/lib/wpqr-fristen";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  await sb.from("wpqr").insert({
    tenant_id: tenantId, wpqr_no: String(fd.get("no")), process: String(fd.get("process")),
    material_group: String(fd.get("mg")) || null, standard_edition: String(fd.get("ed")) || null,
    thickness_test: fd.get("t") ? Number(fd.get("t")) : null, report_date: String(fd.get("date")) || null,
    ap_interval_months: fd.get("ap_intervall") ? Number(fd.get("ap_intervall")) : null,
  });
  revalidatePath("/wpqr");
}

async function wpsAusWpqr(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: q } = await sb.from("wpqr").select("*").eq("id", String(fd.get("id"))).maybeSingle();
  const no = String(fd.get("wps_no")).trim();
  if (!q || !no) redirect("/wpqr?fehler=" + encodeURIComponent("WPS-Nr eingeben"));
  const { data: w, error } = await sb.from("wps").insert({ tenant_id: tenantId, wps_no: no, title: `aus ${q.wpqr_no}` }).select("id").single();
  if (error || !w) redirect("/wpqr?fehler=" + encodeURIComponent(error?.code === "23505" ? "WPS-Nr existiert schon" : error?.message ?? "Fehler"));
  const herkunft = `WPQR ${q.wpqr_no}`;
  const origin: Record<string, string> = { process: herkunft };
  if (q.material_group) origin.material_group = herkunft;
  if (q.position) origin.positions = herkunft;
  if (q.filler) origin.filler = herkunft;
  const { error: e2 } = await sb.from("wps_revisions").insert({
    tenant_id: tenantId, wps_id: w.id, revision: 0, process: q.process, material_group: q.material_group,
    positions: q.position ? [q.position] : [], filler: q.filler, joint_type: "BW", origin,
  });
  if (e2) redirect("/wpqr?fehler=" + encodeURIComponent(e2.message));
  redirect(`/wps/${w.id}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string; status?: string }> }) {
  const { fehler, status: statusFilter } = await searchParams;
  const { sb } = await ctx();
  const [{ data }, { data: settings }, { data: aps }] = await Promise.all([
    sb.from("wpqr").select("*").order("wpqr_no"),
    sb.from("tenant_settings").select("*").maybeSingle(),
    sb.from("ap_protokolle").select("wpqr_id,ap_datum").order("ap_datum", { ascending: false }),
  ]);
  const warnTage = settings?.warn_tage ?? 30;
  const standardIntervall = settings?.ap_intervall_monate ?? 6;
  const letzteApJeWpqr = new Map<string, string>();
  for (const a of aps ?? []) if (a.wpqr_id && !letzteApJeWpqr.has(a.wpqr_id)) letzteApJeWpqr.set(a.wpqr_id, a.ap_datum);

  const liste = (data ?? []).map((q) => ({ ...q, ...apStatus(letzteApJeWpqr.get(q.id) ?? null, q.ap_interval_months ?? standardIntervall, warnTage) }));
  const gefiltert = statusFilter ? liste.filter((q) => q.status === statusFilter) : liste;

  return (
    <>
      <h1>WPQR</h1>
      <p>
        <Link className="btn sek" href="/wpqr/ap-protokoll">📝 AP-Protokoll</Link>{" "}
        <a className="btn sek" href="/wpqr/export">📤 Excel-Export</a>{" "}
        <Link className="btn sek" href="/wpqr/import">📥 Excel-Liste importieren</Link>{" "}
        <Link className="btn sek" href="/wpqr/einstellungen">⚙️ Einstellungen</Link>
      </p>
      {fehler && <p className="err">{fehler}</p>}
      <form method="get" style={{ marginBottom: 8 }}>
        <select name="status" defaultValue={statusFilter ?? ""}>
          <option value="">Status: alle</option>
          <option value="überfällig">überfällig</option>
          <option value="bald fällig">bald fällig</option>
          <option value="gültig">gültig</option>
          <option value="unbekannt">unbekannt</option>
        </select>
        <button className="sek">Filtern</button>
      </form>
      <form className="card" action={neu}>
        <input name="no" placeholder="WPQR-Nr" required /><input name="process" placeholder="Verfahren" required />
        <input name="mg" placeholder="Werkstoffgruppe" /><input name="ed" placeholder="Normausgabe" />
        <input name="t" type="number" step="0.1" placeholder="Prüfstückdicke" /><input name="date" type="date" title="Datum" />
        <input name="ap_intervall" type="number" placeholder={`AP-Intervall [Monate], Standard ${standardIntervall}`} />
        <button>Anlegen</button>
      </form>
      <table><thead><tr><th>WPQR-Nr</th><th>Norm</th><th>Verfahren</th><th>Werkstoff</th><th>Dicke</th><th>Letzte AP</th><th>Nächste AP</th><th>Status</th><th>WPS daraus</th></tr></thead><tbody>
        {gefiltert.map((q) => (
          <tr key={q.id}>
            <td><Link href={`/wpqr/${q.id}`}>{q.wpqr_no}</Link></td><td>{q.standard} {q.standard_edition}</td><td>{q.process}</td><td>{q.material_group}</td><td>{q.thickness_test}</td>
            <td>{letzteApJeWpqr.get(q.id) ?? "–"}</td><td>{q.naechste ?? "–"}</td>
            <td><span className="status" style={q.status === "überfällig" ? { background: "#fdecea", color: "#8a1f15" } : q.status === "bald fällig" ? { background: "#fdf1d6", color: "#7a5a00" } : q.status === "gültig" ? { background: "#dff3e6", color: "#14663a" } : undefined}>{q.status}</span></td>
            <td><form action={wpsAusWpqr} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={q.id} /><input name="wps_no" placeholder="neue WPS-Nr" required style={{ width: 110 }} /><button className="sek">Erstellen</button></form></td>
          </tr>
        ))}
      </tbody></table>
    </>
  );
}
