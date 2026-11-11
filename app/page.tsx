import { redirect } from "next/navigation";
import { ctx } from "@/lib/tenant";

async function mandantAnlegen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  await sb.rpc("bootstrap_tenant", { p_name: String(fd.get("name")) });
  redirect("/");
}
async function logout() {
  "use server";
  const { sb } = await ctx();
  await sb.auth.signOut();
  redirect("/login");
}

export default async function Dashboard() {
  const { sb, tenantId, role } = await ctx();
  if (!tenantId) {
    return (
      <>
        <h1>Ersteinrichtung</h1>
        <form className="card" action={mandantAnlegen}>
          <input name="name" placeholder="Firmenname" defaultValue="IRM Anlagenbau GmbH" required />
          <button>Mandant anlegen (du wirst Admin)</button>
        </form>
      </>
    );
  }
  const count = async (t: string) => (await sb.from(t).select("*", { count: "exact", head: true })).count ?? 0;
  const [wps, wpqr, w] = await Promise.all([count("wps"), count("wpqr"), count("welders")]);
  return (
    <>
      <h1>Dashboard</h1>
      <p>Rolle: {role}</p>
      <table><tbody>
        <tr><th>WPS</th><td>{wps}</td></tr><tr><th>WPQR</th><td>{wpqr}</td></tr><tr><th>Schweißer</th><td>{w}</td></tr>
      </tbody></table>
      <form action={logout}><button style={{ marginTop: 12 }}>Abmelden</button></form>
    </>
  );
}
