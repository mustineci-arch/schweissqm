import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { FristAmpel } from "@/components/Ampel";
import { ZertifikatUpload } from "@/components/ZertifikatUpload";
import { ampel, bestaetigungFaellig } from "@/lib/fristen";
import { zertifikatFelderAusFormular } from "@/lib/cert-save";
import { pruefbezeichnung } from "@/lib/iso9606";

async function stammdatenSpeichern(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("welder_id"));
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const varianten = t("name_variants")?.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) ?? null;
  await sb.from("welders").update({
    name: String(fd.get("name")), stamp: t("stamp"), birthdate: t("birthdate"),
    employer: t("employer"), notiz: t("notiz"), active: fd.get("active") === "on", name_variants: varianten,
  }).eq("id", id);
  revalidatePath(`/schweisser/${id}`);
  revalidatePath("/schweisser");
}

async function welderLoeschen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const id = String(fd.get("welder_id"));
  await sb.from("welders").delete().eq("id", id);
  revalidatePath("/schweisser");
  redirect("/schweisser");
}

async function zertifikatHinzufuegen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  const id = String(fd.get("welder_id"));
  if (tenantId) await sb.from("welder_certificates").insert({ tenant_id: tenantId, welder_id: id, ...zertifikatFelderAusFormular(fd) });
  revalidatePath(`/schweisser/${id}`);
}

async function zertifikatLoeschen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const welderId = String(fd.get("welder_id"));
  await sb.from("welder_certificates").delete().eq("id", String(fd.get("cert_id")));
  revalidatePath(`/schweisser/${welderId}`);
}

async function bestaetigen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const welderId = String(fd.get("welder_id"));
  await sb.from("welder_certificates").update({ last_confirmed_on: new Date().toISOString().slice(0, 10) }).eq("id", String(fd.get("cert_id")));
  revalidatePath(`/schweisser/${welderId}`);
}

async function alleGueltigenBestaetigen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const welderId = String(fd.get("welder_id"));
  const { data: certs } = await sb.from("welder_certificates").select("id,valid_until").eq("welder_id", welderId);
  const heute = new Date().toISOString().slice(0, 10);
  const gueltigeIds = (certs ?? []).filter((c) => ["gruen", "gelb"].includes(ampel(c.valid_until).farbe)).map((c) => c.id);
  if (gueltigeIds.length) await sb.from("welder_certificates").update({ last_confirmed_on: heute }).in("id", gueltigeIds);
  revalidatePath(`/schweisser/${welderId}`);
}

export default async function SchweisserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await ctx();
  const { data: w } = await sb.from("welders").select("*").eq("id", id).maybeSingle();
  if (!w) notFound();
  const { data: certsData } = await sb.from("welder_certificates").select("*").eq("welder_id", id).order("valid_until", { ascending: false, nullsFirst: false });
  const certs = certsData ?? [];

  return (
    <>
      <p className="sub"><Link href="/schweisser">← Zur Liste</Link></p>
      <h1>{w.name}</h1>
      <p className="sub">{w.stamp ? `Zeichen ${w.stamp} · ` : ""}{w.employer ?? "–"}{w.active === false ? " · ausgeschieden" : ""}</p>

      <h2>Stammdaten</h2>
      <form className="card" action={stammdatenSpeichern}>
        <input type="hidden" name="welder_id" value={w.id} />
        <input name="name" defaultValue={w.name} placeholder="Name" required />
        <input name="stamp" defaultValue={w.stamp ?? ""} placeholder="Schweißerzeichen" />
        <input name="birthdate" type="date" defaultValue={w.birthdate ?? ""} title="Geburtsdatum" />
        <input name="employer" defaultValue={w.employer ?? ""} placeholder="Arbeitgeber / Firma" />
        <input name="notiz" defaultValue={w.notiz ?? ""} placeholder="Notiz" style={{ width: "100%" }} />
        <label style={{ fontSize: 13 }}><input type="checkbox" name="active" defaultChecked={w.active !== false} /> aktiv (nicht ausgeschieden)</label>
        <textarea name="name_variants" defaultValue={(w.name_variants ?? []).join("\n")} placeholder="Namensvarianten (eine je Zeile, werden beim Einlesen automatisch zugeordnet)" style={{ width: "100%", minHeight: 50 }} />
        <button>Speichern</button>
      </form>
      <form action={welderLoeschen} onSubmit={undefined}>
        <input type="hidden" name="welder_id" value={w.id} />
        <button className="sek" style={{ color: "#8a1f15", borderColor: "#8a1f15" }}>Schweißer löschen</button>
      </form>

      <h2>Qualifikationen (Geltungsbereich)</h2>
      <table><thead><tr><th>Bezeichnung</th><th>Werkstoffgruppe</th><th>Dicke</th><th>Durchmesser</th><th>Positionen</th></tr></thead><tbody>
        {certs.filter((c) => ["gruen", "gelb"].includes(ampel(c.valid_until).farbe)).map((c) => (
          <tr key={c.id}>
            <td><code>{c.bezeichnung || pruefbezeichnung(c)}</code></td>
            <td>{c.material_group ?? "–"}</td>
            <td>{c.thickness_min ?? "–"}–{c.thickness_max ?? "–"} mm</td>
            <td>{c.diameter_min != null ? `Ø ${c.diameter_min}–${c.diameter_max ?? "∞"} mm` : "–"}</td>
            <td>{(c.positions ?? []).join(", ") || "–"}</td>
          </tr>
        ))}
        {!certs.some((c) => ["gruen", "gelb"].includes(ampel(c.valid_until).farbe)) && <tr><td colSpan={5} className="sub">Keine gültigen Qualifikationen.</td></tr>}
      </tbody></table>

      <h2>Zertifikate</h2>
      <form action={alleGueltigenBestaetigen} style={{ marginBottom: 8 }}>
        <input type="hidden" name="welder_id" value={w.id} />
        <button className="sek">✔ Alle gültigen bestätigen</button>
      </form>
      <table><thead><tr><th>Bezeichnung</th><th>Zert.-Nr.</th><th>Gültig bis</th><th>Zuletzt bestätigt</th><th></th></tr></thead><tbody>
        {certs.map((c) => (
          <tr key={c.id}>
            <td><code>{c.bezeichnung || pruefbezeichnung(c)}</code></td>
            <td>{c.cert_no ?? "–"}</td>
            <td><FristAmpel datum={c.valid_until} /></td>
            <td>
              {c.last_confirmed_on ?? "nie"}
              {["gruen", "gelb"].includes(ampel(c.valid_until).farbe) && bestaetigungFaellig(c.last_confirmed_on) && <span className="status" style={{ background: "#fdecea", color: "#8a1f15", marginLeft: 6 }}>fällig</span>}
            </td>
            <td style={{ display: "flex", gap: 6 }}>
              <form action={bestaetigen}><input type="hidden" name="welder_id" value={w.id} /><input type="hidden" name="cert_id" value={c.id} /><button className="sek">Bestätigen</button></form>
              <form action={zertifikatLoeschen}><input type="hidden" name="welder_id" value={w.id} /><input type="hidden" name="cert_id" value={c.id} /><button className="sek" style={{ color: "#8a1f15", borderColor: "#8a1f15" }}>Löschen</button></form>
            </td>
          </tr>
        ))}
        {!certs.length && <tr><td colSpan={5} className="sub">Noch keine Zertifikate.</td></tr>}
      </tbody></table>

      <h3>PDF für diesen Schweißer einlesen</h3>
      <ZertifikatUpload formSelector="form.zert-neu" />
      <h3>Zertifikat ohne PDF hinzufügen</h3>
      <form className="card zert-neu" action={zertifikatHinzufuegen}>
        <input type="hidden" name="welder_id" value={w.id} />
        <input name="cert_no" placeholder="Zertifikat-Nr." /><input name="bis" type="date" title="gültig bis" />
        <input name="bezeichnung" placeholder="Bezeichnung (ISO 9606-1 …)" style={{ width: "100%" }} />
        <input name="issued_on" type="date" title="Datum der Prüfung" />
        <input name="verlaengerung_nach" placeholder="Verlängerung nach (z. B. 9.3 a)" />
        <p className="sub" style={{ margin: "8px 0 4px" }}>Manuell (überschreibt den Normrechner unten, falls dort nichts ausgefüllt ist):</p>
        <input name="tmin" type="number" step="0.1" placeholder="Dicke min" /><input name="tmax" type="number" step="0.1" placeholder="Dicke max" />
        <input name="dmin" type="number" step="0.1" placeholder="Durchmesser min" /><input name="dmax" type="number" step="0.1" placeholder="Durchmesser max" />
        <input name="positions" placeholder="Positionen (z. B. PA, PC)" />
        <p className="sub" style={{ margin: "8px 0 4px" }}>Normrechner nach DIN EN ISO 9606-1 (berechnet Dicke/Durchmesser/Position aus der Prüfbezeichnung):</p>
        <input name="process" placeholder="Verfahren (z. B. 135)" /><input name="mg" placeholder="Werkstoffgruppe" />
        <select name="nahtart" defaultValue=""><option value="">Nahtart –</option><option value="BW">BW Stumpfnaht</option><option value="FW">FW Kehlnaht</option></select>
        <select name="produkt" defaultValue=""><option value="">Produktform –</option><option value="P">P Blech</option><option value="T">T Rohr</option></select>
        <input name="s_oder_t" type="number" step="0.1" placeholder="Prüfstückdicke s/t (mm)" />
        <input name="durchmesser" type="number" step="0.1" placeholder="Rohr-Ø D der Prüfung (mm)" />
        <input name="position_roh" placeholder="Prüfposition (z. B. PH)" />
        <label style={{ fontSize: 13 }}><input type="checkbox" name="hatPC" /> Zusatzprüfung PC vorhanden</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="mehrfachlage" /> 2/3+1/3-Umfangsprüfung</label>
        <select name="richtung" defaultValue="steigend"><option value="steigend">steigend</option><option value="fallend">fallend</option></select>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="hasFilletTest" /> Zusatzprüfung Kehlnaht vorhanden</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="combinedJointTest" /> kombinierte BW/FW-Prüfung</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="fixedPipe" /> Blechprüfung: qualifiziert fest eingespanntes Rohr</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="rotatingPipe" /> Blechprüfung: qualifiziert rotierendes Rohr</label>
        <select name="fmGroup" defaultValue=""><option value="">FM-Gruppe –</option>{["FM1", "FM2", "FM3", "FM4", "FM5", "FM6"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="fillerType" defaultValue=""><option value="">Schweißzusatzart –</option>{["S", "M", "B", "R", "PZ", "V", "W", "Y", "Z", "C"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="weldDetail" defaultValue=""><option value="">Schweißdetail –</option>{["ss_nb", "ss_mb", "bs", "ss_gb", "ci", "ss_fb"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="layerBuild" defaultValue=""><option value="">Lagenaufbau –</option><option value="sl">sl einlagig</option><option value="ml">ml mehrlagig</option></select>
        <button>Zertifikat speichern</button>
      </form>
    </>
  );
}
