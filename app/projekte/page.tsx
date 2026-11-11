import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  await sb.from("projects").insert({ tenant_id: tenantId, project_no: String(fd.get("no")), customer: String(fd.get("kunde")) || null, title: String(fd.get("titel")) });
  revalidatePath("/projekte");
}

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("projects").select("id,project_no,customer,title,status").order("project_no");
  return (
    <>
      <h1>Projekte</h1>
      <form className="card" action={neu}>
        <input name="no" placeholder="Projekt-Nr" required /><input name="kunde" placeholder="Kunde" />
        <input name="titel" placeholder="Titel" required /><button>Anlegen</button>
      </form>
      <table><thead><tr><th>Nr</th><th>Kunde</th><th>Titel</th><th>Status</th></tr></thead><tbody>
        {(data ?? []).map((p) => <tr key={p.id}><td>{p.project_no}</td><td>{p.customer}</td><td>{p.title}</td><td>{p.status}</td></tr>)}
      </tbody></table>
    </>
  );
}
