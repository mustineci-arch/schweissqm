import Link from "next/link";
import { redirect } from "next/navigation";
import { ctx } from "@/lib/tenant";
import { ampel } from "@/lib/fristen";

async function mandantAnlegen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  await sb.rpc("bootstrap_tenant", { p_name: String(fd.get("name")).trim() });
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
  const [{ data: revs }, { data: certs }, { data: welds }, { data: projects }] = await Promise.all([
    sb.from("wps_revisions").select("status"),
    sb.from("welder_certificates").select("valid_until"),
    sb.from("welds").select("status"),
    sb.from("projects").select("id"),
  ]);
  const R = (revs ?? []) as any[]; const C = (certs ?? []) as any[]; const N = (welds ?? []) as any[];
  const wps = { frei: R.filter((r) => r.status === "freigegeben").length, entwurf: R.filter((r) => r.status === "entwurf").length };
  const fr = { rot: 0, gelb: 0, gruen: 0, grau: 0 } as Record<string, number>;
  C.forEach((c) => fr[ampel(c.valid_until).farbe]++);
  const nahtN = (s: string) => N.filter((n) => n.status === s).length;

  return (
    <>
      <h1>Ablauf-Übersicht</h1>
      <p className="sub">Angemeldet als {role} · {(projects ?? []).length} Projekte</p>
      <div className="zustand">
        <span className="chip"><b>{wps.frei}</b>WPS freigegeben</span>
        <span className="chip"><b>{wps.entwurf}</b>WPS-Entwürfe offen</span>
        <span className="chip"><b>{N.length}</b>Nähte gesamt</span>
      </div>
      <h2>Schweißer-Qualifikationen</h2>
      <div className="kacheln">
        <Link href="/fristen" className="kachel rot"><div className="zahl">{fr.rot}</div><div className="label">abgelaufen</div></Link>
        <Link href="/fristen" className="kachel gelb"><div className="zahl">{fr.gelb}</div><div className="label">laufen in 60 Tagen ab</div></Link>
        <Link href="/fristen" className="kachel gruen"><div className="zahl">{fr.gruen}</div><div className="label">gültig</div></Link>
        <Link href="/fristen" className="kachel grau"><div className="zahl">{fr.grau}</div><div className="label">ohne Datum</div></Link>
      </div>
      <h2>Nähte nach Status</h2>
      <div className="kacheln">
        <Link href="/naehte" className="kachel grau"><div className="zahl">{nahtN("offen")}</div><div className="label">offen</div></Link>
        <Link href="/naehte" className="kachel gelb"><div className="zahl">{nahtN("geschweisst")}</div><div className="label">geschweißt</div></Link>
        <Link href="/naehte" className="kachel gelb"><div className="zahl">{nahtN("geprueft")}</div><div className="label">geprüft</div></Link>
        <Link href="/naehte" className="kachel gruen"><div className="zahl">{nahtN("freigegeben")}</div><div className="label">freigegeben</div></Link>
      </div>
      <form action={logout}><button className="sek">Abmelden</button></form>
    </>
  );
}
