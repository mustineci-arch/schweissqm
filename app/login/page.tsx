import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function login(fd: FormData) {
  "use server";
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("password")) });
  if (error) redirect("/login?fehler=" + encodeURIComponent("Anmeldung fehlgeschlagen"));
  redirect("/");
}
async function registrieren(fd: FormData) {
  "use server";
  const sb = await supabaseServer();
  const { error } = await sb.auth.signUp({ email: String(fd.get("email")), password: String(fd.get("password")) });
  if (error) redirect("/login?fehler=" + encodeURIComponent(error.message));
  redirect("/login?fehler=" + encodeURIComponent("Bitte E-Mail bestätigen, dann anmelden"));
}

export default async function Login({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  return (
    <>
      <h1>SchweißQM – Anmeldung</h1>
      {fehler && <p className="err">{fehler}</p>}
      <form className="card" action={login}>
        <input name="email" type="email" placeholder="E-Mail" required />
        <input name="password" type="password" placeholder="Passwort" required minLength={10} />
        <button>Anmelden</button>
        <button formAction={registrieren} type="submit">Registrieren</button>
      </form>
    </>
  );
}
