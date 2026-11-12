import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { ladeAuftragPruefung } from "@/lib/auftrag-load";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  const { error } = await sb.from("auftraege").insert({
    tenant_id: tenantId, bezeichnung: t("bezeichnung"), process: String(fd.get("process")).trim(),
    product_type: t("product_type"), joint_type: t("joint_type"), material_group: t("material_group"),
    thickness: n("thickness"), diameter: n("diameter"), position: t("position"),
    fm_group: t("fm_group"), filler_type: t("filler_type"), weld_detail: t("weld_detail"), layer_build: t("layer_build"),
  });
  if (error) redirect("/auftrag?fehler=" + encodeURIComponent(error.message));
  revalidatePath("/auftrag");
}

async function wpsErzeugen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const auftragId = String(fd.get("auftrag_id"));
  const certId = String(fd.get("cert_id"));
  const welderName = String(fd.get("welder_name"));
  const no = String(fd.get("wps_no")).trim();
  const { data: a } = await sb.from("auftraege").select("*").eq("id", auftragId).maybeSingle();
  if (!a || !no) redirect(`/auftrag?auftrag=${auftragId}&cert=${certId}&fehler=` + encodeURIComponent("WPS-Nr eingeben"));
  const { data: w, error } = await sb.from("wps").insert({ tenant_id: tenantId, wps_no: no, title: a.bezeichnung ?? `aus Auftrag` }).select("id").single();
  if (error || !w) redirect(`/auftrag?auftrag=${auftragId}&cert=${certId}&fehler=` + encodeURIComponent(error?.code === "23505" ? "WPS-Nr existiert schon" : error?.message ?? "Fehler"));
  const herkunft = `Auftrag${a.bezeichnung ? " " + a.bezeichnung : ""} · geprüft gegen Prüfung von ${welderName}`;
  const felder = ["process", "material_group", "joint_type", "product_type", "fm_group", "filler_type", "weld_detail", "layer_build"] as const;
  const origin = Object.fromEntries(felder.filter((f) => a[f]).map((f) => [f, herkunft]));
  const { error: e2 } = await sb.from("wps_revisions").insert({
    tenant_id: tenantId, wps_id: w.id, revision: 0,
    process: a.process, material_group: a.material_group, joint_type: a.joint_type,
    product_type: a.product_type, fm_group: a.fm_group, filler_type: a.filler_type,
    weld_detail: a.weld_detail, layer_build: a.layer_build,
    thickness_min: a.thickness, thickness_max: a.thickness, diameter_min: a.diameter,
    positions: a.position ? [a.position] : [], origin,
  });
  if (e2) redirect(`/auftrag?auftrag=${auftragId}&cert=${certId}&fehler=` + encodeURIComponent(e2.message));
  redirect(`/wps/${w.id}`);
}

export default async function Page({ searchParams }: { searchParams: Promise<{ auftrag?: string; cert?: string; fehler?: string }> }) {
  const sp = await searchParams;
  const { sb } = await ctx();
  const { A, pruefungen, auftrag, cert, punkte, gesamt: erg } = await ladeAuftragPruefung(sb, sp);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "fehler") as [string, string][]).toString();

  return (
    <>
      <h1>Auftrag</h1>
      <p className="sub">Konkrete Auftragswerte (keine Bereiche) direkt gegen die berechnete Prüfbescheinigung eines Schweißers prüfen. Erst wenn das gedeckt ist, daraus eine WPS schreiben.</p>
      {sp.fehler && <p className="err">{sp.fehler}</p>}

      <form className="card" action={neu}>
        <input name="bezeichnung" placeholder="Bezeichnung (optional)" />
        <input name="process" placeholder="Verfahren (z. B. 141)" required />
        <input name="material_group" placeholder="Werkstoffgruppe" />
        <select name="joint_type" defaultValue=""><option value="">Nahtart –</option><option value="BW">BW Stumpfnaht</option><option value="FW">FW Kehlnaht</option></select>
        <select name="product_type" defaultValue=""><option value="">Produktform –</option><option value="P">P Blech</option><option value="T">T Rohr</option></select>
        <input name="thickness" type="number" step="0.1" placeholder="Dicke (mm)" />
        <input name="diameter" type="number" step="0.1" placeholder="Rohr-Ø (mm)" />
        <input name="position" placeholder="Position (z. B. PF)" />
        <select name="fm_group" defaultValue=""><option value="">FM-Gruppe –</option>{["FM1", "FM2", "FM3", "FM4", "FM5", "FM6"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="filler_type" defaultValue=""><option value="">Schweißzusatzart –</option>{["S", "M", "B", "R", "PZ", "V", "W", "Y", "Z", "C"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="weld_detail" defaultValue=""><option value="">Schweißdetail –</option>{["ss_nb", "ss_mb", "bs", "ss_gb", "ci", "ss_fb"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="layer_build" defaultValue=""><option value="">Lagenaufbau –</option><option value="sl">sl einlagig</option><option value="ml">ml mehrlagig</option></select>
        <button>Auftrag anlegen</button>
      </form>

      <h2>Aufträge</h2>
      <table><thead><tr><th>Bezeichnung</th><th>Verfahren</th><th>Nahtart</th><th>Werkstoff</th><th>Dicke</th><th>Ø</th><th>Position</th><th>Prüfen</th></tr></thead><tbody>
        {A.map((a) => (
          <tr key={a.id}><td>{a.bezeichnung ?? "–"}</td><td>{a.process}</td><td>{a.joint_type ?? "–"}</td><td>{a.material_group ?? "–"}</td><td>{a.thickness ?? "–"}</td><td>{a.diameter ?? "–"}</td><td>{a.position ?? "–"}</td>
            <td><Link href={`/auftrag?auftrag=${a.id}${sp.cert ? `&cert=${sp.cert}` : ""}`}>auswählen</Link></td></tr>
        ))}
        {A.length === 0 && <tr><td colSpan={8}>Noch keine Aufträge.</td></tr>}
      </tbody></table>

      <h2>Gegen Prüfung prüfen</h2>
      <form className="card" method="get">
        <input type="hidden" name="auftrag" value={sp.auftrag ?? ""} />
        <select name="cert" defaultValue={sp.cert ?? ""}><option value="">Prüfung wählen</option>
          {pruefungen.map((p) => <option key={p.id} value={p.id}>{p.welderName} · {p.process} {p.joint_type ?? ""} {p.material_group ?? ""} {p.valid_until ? `· bis ${p.valid_until}` : ""}</option>)}
        </select>
        <button>Prüfen</button>
      </form>

      {!sp.auftrag && <p className="sub">Erst oben einen Auftrag auswählen.</p>}

      {auftrag && cert && (
        <>
          <h3>{auftrag.bezeichnung ?? auftrag.process} gegen Prüfung von {(cert as any).welderName}: <span className={erg ?? ""}>{erg}</span></h3>
          <table><thead><tr><th>Parameter</th><th>Auftrag (Soll)</th><th>Prüfung (Ist)</th><th>Regel</th><th>Ergebnis</th></tr></thead><tbody>
            {punkte.map((p, i) => <tr key={i}><td>{p.parameter}</td><td>{p.soll}</td><td>{p.ist}</td><td>{p.regel}</td><td className={p.status}>{p.status}</td></tr>)}
          </tbody></table>

          {erg === "GEDECKT" && (
            <form className="card" action={wpsErzeugen}>
              <input type="hidden" name="auftrag_id" value={auftrag.id} />
              <input type="hidden" name="cert_id" value={cert.id} />
              <input type="hidden" name="welder_name" value={(cert as any).welderName} />
              <input name="wps_no" placeholder="neue WPS-Nr" required />
              <button className="kupfer">WPS aus diesem Auftrag erzeugen</button>
            </form>
          )}
          {erg !== "GEDECKT" && <p className="sub">Erst wenn alle Kriterien GEDECKT sind, kann daraus eine WPS geschrieben werden.</p>}
        </>
      )}
    </>
  );
}
