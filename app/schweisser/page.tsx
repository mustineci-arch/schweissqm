import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { FristAmpel } from "@/components/Ampel";
import { ZertifikatUpload } from "@/components/ZertifikatUpload";
import { ampel, bestaetigungFaellig } from "@/lib/fristen";
import { zertifikatFelderAusFormular } from "@/lib/cert-save";
import { pruefbezeichnung } from "@/lib/iso9606";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: w } = await sb.from("welders").insert({ tenant_id: tenantId, name: String(fd.get("name")), stamp: String(fd.get("stamp")) || null, birthdate: String(fd.get("birthdate")) || null }).select("id").single();
  if (w && fd.get("process")) {
    await sb.from("welder_certificates").insert({ tenant_id: tenantId, welder_id: w.id, ...zertifikatFelderAusFormular(fd) });
  }
  revalidatePath("/schweisser");
}

type Farbe = "rot" | "gelb" | "gruen" | "grau";

function status(certs: { valid_until: string | null; last_confirmed_on?: string | null }[]): { label: string; farbe: Farbe; naechsterAblauf: string | null; ablaufFarbe: Farbe; bestaetigungFaellig: boolean } {
  const mitFarbe = certs.map((c) => ({ ...c, farbe: ampel(c.valid_until).farbe }));
  const gueltig = mitFarbe.filter((c) => c.farbe === "gruen" || c.farbe === "gelb");
  const faellig = gueltig.some((c) => bestaetigungFaellig(c.last_confirmed_on));
  if (gueltig.length) {
    gueltig.sort((a, b) => String(a.valid_until).localeCompare(String(b.valid_until)));
    const naechster = gueltig[0];
    return { label: "gültig", farbe: "gruen", naechsterAblauf: naechster.valid_until, ablaufFarbe: naechster.farbe, bestaetigungFaellig: faellig };
  }
  if (mitFarbe.some((c) => c.farbe === "rot")) return { label: "abgelaufen", farbe: "rot", naechsterAblauf: null, ablaufFarbe: "rot", bestaetigungFaellig: false };
  if (!certs.length) return { label: "ohne Zertifikat", farbe: "grau", naechsterAblauf: null, ablaufFarbe: "grau", bestaetigungFaellig: false };
  return { label: "unbekannt", farbe: "grau", naechsterAblauf: null, ablaufFarbe: "grau", bestaetigungFaellig: false };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; aktiv?: string }> }) {
  const sp = await searchParams;
  const { sb } = await ctx();
  const { data } = await sb.from("welders").select("id,name,stamp,birthdate,active,welder_certificates(process,bezeichnung,material_group,joint_type,product_type,fm_group,filler_type,weld_detail,layer_build,thickness_min,thickness_max,diameter_min,diameter_max,positions,has_fillet_test,combined_joint_test,test_thickness,test_diameter,test_position,fixed_pipe,rotating_pipe,valid_until,last_confirmed_on)").order("name");

  const schweisser = (data ?? []).map((w) => {
    const certs = (w.welder_certificates ?? []) as any[];
    return { ...w, certs, ...status(certs) };
  });

  const aktivFilter = sp.aktiv ?? "aktiv";
  const nachAktiv = schweisser.filter((s) => aktivFilter === "alle" || (aktivFilter === "aktiv" ? s.active !== false : s.active === false));

  const stats = {
    gesamt: nachAktiv.length,
    gueltig: nachAktiv.filter((s) => s.label === "gültig").length,
    laeuftAb: nachAktiv.filter((s) => s.label === "gültig" && s.ablaufFarbe === "gelb").length,
    bestaetigung: nachAktiv.filter((s) => s.bestaetigungFaellig).length,
  };

  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "";
  const gefiltert = nachAktiv.filter((s) => {
    if (statusFilter === "Bestätigung fällig") { if (!s.bestaetigungFaellig) return false; }
    else if (statusFilter && s.label !== statusFilter) return false;
    if (!q) return true;
    const heuhaufen = [s.name, s.stamp, ...s.certs.map((c) => c.bezeichnung ?? pruefbezeichnung(c)), ...s.certs.map((c) => c.process)].join(" ").toLowerCase();
    return heuhaufen.includes(q);
  });

  return (
    <>
      <h1>Schweißer</h1>
      <p className="sub">Qualifikationen je Schweißer · Zertifikate einordnen · 6-Monats-Bestätigung</p>
      <div className="kacheln">
        <div className="kachel grau"><div className="zahl">{stats.gesamt}</div><div className="label">Schweißer aktiv</div></div>
        <div className="kachel gruen"><div className="zahl">{stats.gueltig}</div><div className="label">mit gültigem Zertifikat</div></div>
        <div className="kachel gelb"><div className="zahl">{stats.laeuftAb}</div><div className="label">Zertifikat läuft in 60 Tg. ab</div></div>
        <div className="kachel rot"><div className="zahl">{stats.bestaetigung}</div><div className="label">Bestätigung fällig</div></div>
      </div>
      <form className="card" method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, Zeichen oder Bezeichnung (z. B. 141, FM3, PH) …" style={{ flex: 1, minWidth: 220 }} />
        <select name="status" defaultValue={statusFilter}>
          <option value="">Status: alle</option>
          <option value="gültig">gültig</option>
          <option value="abgelaufen">abgelaufen</option>
          <option value="ohne Zertifikat">ohne Zertifikat</option>
          <option value="unbekannt">unbekannt</option>
          <option value="Bestätigung fällig">Bestätigung fällig</option>
        </select>
        <select name="aktiv" defaultValue={aktivFilter}>
          <option value="aktiv">nur aktive</option>
          <option value="alle">alle</option>
          <option value="ausgeschieden">nur ausgeschiedene</option>
        </select>
        <button className="sek">Filtern</button>
        {(sp.q || statusFilter || sp.aktiv) && <a className="btn sek" href="/schweisser">Zurücksetzen</a>}
      </form>
      <table><thead><tr><th>Name</th><th>Zeichen</th><th>Geburtsdatum</th><th>Zertifikate</th><th>Qualifikationen (gültig)</th><th>Status</th><th>Nächster Ablauf</th><th>Bestätigung</th></tr></thead><tbody>
        {gefiltert.map((s) => {
          const gueltig = s.certs.filter((c) => ampel(c.valid_until).farbe === "gruen" || ampel(c.valid_until).farbe === "gelb");
          const sichtbar = gueltig.slice(0, 4);
          return (
            <tr key={s.id}>
              <td><Link href={`/schweisser/${s.id}`}>{s.name}</Link></td>
              <td>{s.stamp ?? "–"}</td>
              <td>{s.birthdate ?? "–"}</td>
              <td>{gueltig.length} gültig / {s.certs.length}</td>
              <td>
                {sichtbar.map((c, i) => <div key={i} style={{ fontSize: 13 }}><code>{c.bezeichnung || pruefbezeichnung(c)}</code></div>)}
                {gueltig.length > sichtbar.length && <div className="sub" style={{ margin: 0 }}>+ {gueltig.length - sichtbar.length} weitere</div>}
                {!gueltig.length && "–"}
              </td>
              <td><span className={`status ${s.label === "gültig" ? "freigegeben" : s.label === "abgelaufen" ? "" : "entwurf"}`} style={s.label === "abgelaufen" ? { background: "#fdecea", color: "#8a1f15" } : undefined}>{s.label}</span></td>
              <td>{s.naechsterAblauf ? <FristAmpel datum={s.naechsterAblauf} /> : "–"}</td>
              <td>{s.bestaetigungFaellig ? <span className="status" style={{ background: "#fdecea", color: "#8a1f15" }}>fällig</span> : "–"}</td>
            </tr>
          );
        })}
        {!gefiltert.length && <tr><td colSpan={8} className="sub">Keine Schweißer gefunden.</td></tr>}
      </tbody></table>

      <h2>Neuen Schweißer anlegen</h2>
      <ZertifikatUpload />
      <form className="card" action={neu}>
        <input name="name" placeholder="Name" required /><input name="stamp" placeholder="Stempel (Zeichen)" />
        <input name="birthdate" type="date" title="Geburtsdatum" />
        <input name="process" placeholder="Verfahren (z. B. 135)" /><input name="mg" placeholder="Werkstoffgruppe" />
        <input name="bis" type="date" title="gültig bis" />
        <input name="bezeichnung" placeholder="Genormte Bezeichnung (vom Zertifikat, optional)" style={{ width: "100%" }} />
        <p className="sub" style={{ margin: "8px 0 4px" }}>Manuell (überschreibt den Normrechner unten, falls dort nichts ausgefüllt ist):</p>
        <input name="tmin" type="number" step="0.1" placeholder="Dicke min" /><input name="tmax" type="number" step="0.1" placeholder="Dicke max" />
        <input name="dmin" type="number" step="0.1" placeholder="Durchmesser min" /><input name="dmax" type="number" step="0.1" placeholder="Durchmesser max" />
        <input name="positions" placeholder="Positionen (z. B. PA, PC)" />
        <p className="sub" style={{ margin: "8px 0 4px" }}>Normrechner nach DIN EN ISO 9606-1 (berechnet Dicke/Durchmesser/Position aus der Prüfbezeichnung):</p>
        <select name="nahtart" defaultValue=""><option value="">Nahtart –</option><option value="BW">BW Stumpfnaht</option><option value="FW">FW Kehlnaht</option></select>
        <select name="produkt" defaultValue=""><option value="">Produktform –</option><option value="P">P Blech</option><option value="T">T Rohr</option></select>
        <input name="s_oder_t" type="number" step="0.1" placeholder="Prüfstückdicke s/t (mm)" />
        <input name="durchmesser" type="number" step="0.1" placeholder="Rohr-Ø D der Prüfung (mm)" />
        <input name="position_roh" placeholder="Prüfposition (z. B. PH)" />
        <label style={{ fontSize: 13 }}><input type="checkbox" name="hatPC" /> Zusatzprüfung PC vorhanden</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="mehrfachlage" /> 2/3+1/3-Umfangsprüfung</label>
        <select name="richtung" defaultValue="steigend"><option value="steigend">steigend</option><option value="fallend">fallend</option></select>
        <p className="sub" style={{ margin: "8px 0 4px" }}>Nahtart-Erweiterung (nur bei BW-Prüfung, für Freigabe auf Kehlnaht-WPS, Abschnitt 5.4):</p>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="hasFilletTest" /> Zusatzprüfung Kehlnaht vorhanden</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="combinedJointTest" /> kombinierte BW/FW-Prüfung (zusätzlich Dicke ≥ 10 mm nötig)</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="fixedPipe" /> Blechprüfung: qualifiziert fest eingespanntes Rohr</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" name="rotatingPipe" /> Blechprüfung: qualifiziert rotierendes Rohr</label>
        <p className="sub" style={{ margin: "8px 0 4px" }}>Weitere Kriterien (optional, nur nötig wenn die WPS sie fordert):</p>
        <select name="fmGroup" defaultValue=""><option value="">FM-Gruppe –</option>{["FM1", "FM2", "FM3", "FM4", "FM5", "FM6"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="fillerType" defaultValue=""><option value="">Schweißzusatzart –</option>{["S", "M", "B", "R", "PZ", "V", "W", "Y", "Z", "C"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="weldDetail" defaultValue=""><option value="">Schweißdetail –</option>{["ss_nb", "ss_mb", "bs", "ss_gb", "ci", "ss_fb"].map((x) => <option key={x}>{x}</option>)}</select>
        <select name="layerBuild" defaultValue=""><option value="">Lagenaufbau –</option><option value="sl">sl einlagig</option><option value="ml">ml mehrlagig</option></select>
        <button>Anlegen</button>
      </form>
    </>
  );
}
