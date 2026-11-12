import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

async function erstellen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  await sb.from("ap_protokolle").insert({
    tenant_id: tenantId, wpqr_id: t("wpqr_id"), welder_id: t("welder_id"),
    ap_datum: t("ap_datum") ?? new Date().toISOString().slice(0, 10),
    pruefstueck: t("pruefstueck"), weitere_angaben: t("weitere_angaben"), bemerkung: t("bemerkung"),
  });
  revalidatePath("/wpqr/ap-protokoll");
  revalidatePath("/wpqr");
}

async function loeschen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  await sb.from("ap_protokolle").delete().eq("id", String(fd.get("id")));
  revalidatePath("/wpqr/ap-protokoll");
  revalidatePath("/wpqr");
}

export default async function ApProtokoll() {
  const { sb } = await ctx();
  const [{ data: wpqrListe }, { data: welder }, { data: protokolle }] = await Promise.all([
    sb.from("wpqr").select("id,wpqr_no,process").order("wpqr_no"),
    sb.from("welders").select("id,name,welder_certificates(bezeichnung,process,valid_until)").order("name"),
    sb.from("ap_protokolle").select("*,wpqr(wpqr_no),welders(name)").order("ap_datum", { ascending: false }),
  ]);

  return (
    <>
      <p className="sub"><Link href="/wpqr">← Zur WPQR-Liste</Link></p>
      <h1>AP-Protokoll erstellen</h1>
      <p className="sub">Arbeitsprüfung nach AD 2000 – Merkblatt HP 5/2.</p>
      <form className="card" action={erstellen}>
        <select name="wpqr_id" defaultValue="" required>
          <option value="" disabled>WPQR aus Liste –</option>
          {(wpqrListe ?? []).map((q) => <option key={q.id} value={q.id}>{q.wpqr_no} ({q.process})</option>)}
        </select>
        <select name="welder_id" defaultValue="" required>
          <option value="" disabled>Schweißer –</option>
          {(welder ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input name="ap_datum" type="date" title="AP-Datum" defaultValue={new Date().toISOString().slice(0, 10)} />
        <input name="pruefstueck" placeholder="Arbeitsprüfstück" />
        <input name="weitere_angaben" placeholder="Druckgerät, Pulver, Wurzelschutz, Temperaturen, Wärmenachbehandlung" style={{ width: "100%" }} />
        <input name="bemerkung" placeholder="Bemerkung" style={{ width: "100%" }} />
        <button>💾 Protokoll speichern</button>
      </form>

      <h2>Gespeicherte Protokolle</h2>
      <table><thead><tr><th>Datum</th><th>WPQR</th><th>Schweißer</th><th>Prüfstück</th><th></th></tr></thead><tbody>
        {(protokolle ?? []).map((p: any) => (
          <tr key={p.id}>
            <td>{p.ap_datum}</td><td>{p.wpqr?.wpqr_no ?? "–"}</td><td>{p.welders?.name ?? "–"}</td><td>{p.pruefstueck ?? "–"}</td>
            <td style={{ display: "flex", gap: 6 }}>
              <a className="sek btn" href={`/wpqr/ap-protokoll/${p.id}/pdf`}>⬇ Deckblatt-PDF</a>
              <form action={loeschen}><input type="hidden" name="id" value={p.id} /><button className="sek" style={{ color: "#8a1f15", borderColor: "#8a1f15" }}>Löschen</button></form>
            </td>
          </tr>
        ))}
        {!protokolle?.length && <tr><td colSpan={5} className="sub">Noch keine Protokolle.</td></tr>}
      </tbody></table>
    </>
  );
}
