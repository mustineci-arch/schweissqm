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

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("wpqr").select("*").order("wpqr_no");
  return (
    <>
      <h1>WPQR</h1>
      <form className="card" action={neu}>
        <input name="no" placeholder="WPQR-Nr" required /><input name="process" placeholder="Verfahren" required />
        <input name="mg" placeholder="Werkstoffgruppe" /><input name="ed" placeholder="Normausgabe" />
        <input name="t" type="number" step="0.1" placeholder="Prüfstückdicke" /><input name="date" type="date" />
        <button>Anlegen</button>
      </form>
      <table><thead><tr><th>WPQR-Nr</th><th>Norm</th><th>Verfahren</th><th>Werkstoff</th><th>Dicke</th><th>Datum</th></tr></thead><tbody>
        {(data ?? []).map((q) => (
          <tr key={q.id}><td>{q.wpqr_no}</td><td>{q.standard} {q.standard_edition}</td><td>{q.process}</td><td>{q.material_group}</td><td>{q.thickness_test}</td><td>{q.report_date}</td></tr>
        ))}
      </tbody></table>
    </>
  );
}
