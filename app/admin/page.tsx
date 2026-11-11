import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

const ROLLEN = ["admin", "sfi", "qm", "projektleitung", "av", "fertigung", "schweisser", "zfp", "pruefstelle", "kunde"];

async function hinzufuegen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const { error } = await sb.rpc("add_member", { p_email: String(fd.get("email")), p_role: String(fd.get("role")) });
  if (error) redirect("/admin?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/admin");
}
async function entfernen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const { error } = await sb.rpc("remove_member", { p_user: String(fd.get("user")) });
  if (error) redirect("/admin?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/admin");
}

export default async function Page({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const { sb, role } = await ctx();
  if (role !== "admin") return <><h1>Administration</h1><p>Nur für Admins.</p></>;
  const { data } = await sb.rpc("list_members");
  const members = (data ?? []) as { user_id: string; email: string; role: string }[];
  return (
    <>
      <h1>Benutzer und Rollen</h1>
      {fehler && <p className="err">{fehler}</p>}
      <p>Der Benutzer muss sich vorher in der App registrieren und die E-Mail bestätigen.</p>
      <form className="card" action={hinzufuegen}>
        <input name="email" type="email" placeholder="E-Mail" required />
        <select name="role" defaultValue="fertigung">{ROLLEN.map((r) => <option key={r}>{r}</option>)}</select>
        <button>Hinzufügen / Rolle ändern</button>
      </form>
      <table><thead><tr><th>E-Mail</th><th>Rolle</th><th></th></tr></thead><tbody>
        {members.map((m) => (
          <tr key={m.user_id}><td>{m.email}</td><td>{m.role}</td>
            <td><form action={entfernen}><input type="hidden" name="user" value={m.user_id} /><button>Entfernen</button></form></td></tr>
        ))}
      </tbody></table>
    </>
  );
}
