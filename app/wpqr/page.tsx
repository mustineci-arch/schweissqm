import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  await sb.from("wpqr").insert({
    tenant_id: tenantId, wpqr_no: String(fd.get("no")), process: String(fd.get("process")),
    material_group: String(fd.get("mg")) || null, standard_edition: String(fd.get("ed")) || null,
    thickness_test: fd.get("t") ? Number(fd.get("t")) : null, report_date: String(fd.get("date")) || null,
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

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const { sb } = await ctx();
  const { data } = await sb.from("wpqr").select("*").order("wpqr_no");
  return (
    <>
      <h1>WPQR</h1>
      {fehler && <p className="err">{fehler}</p>}
      <form className="card" action={neu}>
        <input name="no" placeholder="WPQR-Nr" required /><input name="process" placeholder="Verfahren" required />
        <input name="mg" placeholder="Werkstoffgruppe" /><input name="ed" placeholder="Normausgabe" />
        <input name="t" type="number" step="0.1" placeholder="Prüfstückdicke" /><input name="date" type="date" />
        <button>Anlegen</button>
      </form>
      <table><thead><tr><th>WPQR-Nr</th><th>Norm</th><th>Verfahren</th><th>Werkstoff</th><th>Dicke</th><th>Datum</th><th>WPS daraus</th></tr></thead><tbody>
        {(data ?? []).map((q) => (
          <tr key={q.id}><td>{q.wpqr_no}</td><td>{q.standard} {q.standard_edition}</td><td>{q.process}</td><td>{q.material_group}</td><td>{q.thickness_test}</td><td>{q.report_date}</td>
            <td><form action={wpsAusWpqr} style={{ display: "flex", gap: 4 }}><input type="hidden" name="id" value={q.id} /><input name="wps_no" placeholder="neue WPS-Nr" required style={{ width: 110 }} /><button className="sek">Erstellen</button></form></td></tr>
        ))}
      </tbody></table>
    </>
  );
}
