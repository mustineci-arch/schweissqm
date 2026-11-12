import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { FristAmpel } from "@/components/Ampel";
import { bwThicknessRange, fwThicknessRange, diameterRange, positionScope, type Nahtart, type Produktform } from "@/lib/iso9606";

// Unendlich (kein Maximum, z. B. Tabelle 7 Fall D > 25) lässt sich nicht speichern -> null.
const speicherbar = (v: number) => (v === Infinity ? null : v);

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: w } = await sb.from("welders").insert({ tenant_id: tenantId, name: String(fd.get("name")), stamp: String(fd.get("stamp")) || null }).select("id").single();
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  if (w && fd.get("process")) {
    const process = String(fd.get("process"));
    const nahtart = (String(fd.get("nahtart")) || null) as Nahtart | null;
    const produkt = (String(fd.get("produkt")) || null) as Produktform | null;
    const sOderT = n("s_oder_t");
    const positionRoh = String(fd.get("position_roh") ?? "").trim().toUpperCase() || null;

    let tmin = n("tmin"), tmax = n("tmax");
    if (nahtart && sOderT) {
      const b = nahtart === "FW" ? fwThicknessRange(sOderT) : bwThicknessRange(sOderT, [process]);
      tmin = b.min; tmax = b.max !== null ? speicherbar(b.max) : null;
    }
    let dmin = n("dmin"), dmax = n("dmax");
    const D = n("durchmesser");
    if (produkt && D) {
      const b = diameterRange(D, produkt);
      dmin = b.min; dmax = b.max !== null ? speicherbar(b.max) : null;
    }
    let positions: string[] | null = String(fd.get("positions") ?? "").trim()
      ? String(fd.get("positions")).toUpperCase().split(/[\s,;]+/).filter(Boolean) : null;
    if (nahtart && positionRoh) {
      positions = positionScope({
        nahtart, produkt: produkt ?? "P", position: positionRoh, durchmesser: D,
        hatPC: fd.get("hatPC") === "on", mehrfachlage: fd.get("mehrfachlage") === "on",
        richtung: fd.get("richtung") === "fallend" ? "fallend" : "steigend",
      });
    }

    await sb.from("welder_certificates").insert({
      tenant_id: tenantId, welder_id: w.id, process,
      material_group: String(fd.get("mg")) || null, joint_type: nahtart,
      thickness_min: tmin, thickness_max: tmax, diameter_min: dmin, diameter_max: dmax, positions,
      valid_until: String(fd.get("bis")) || null,
    });
  }
  revalidatePath("/schweisser");
}

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("welders").select("id,name,stamp,welder_certificates(process,material_group,thickness_min,thickness_max,diameter_min,diameter_max,positions,valid_until)").order("name");
  return (
    <>
      <h1>Schweißer</h1>
      <form className="card" action={neu}>
        <input name="name" placeholder="Name" required /><input name="stamp" placeholder="Stempel" />
        <input name="process" placeholder="Verfahren (z. B. 135)" /><input name="mg" placeholder="Werkstoffgruppe" />
        <input name="bis" type="date" title="gültig bis" />
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
        <button>Anlegen</button>
      </form>
      <table><thead><tr><th>Name</th><th>Stempel</th><th>Prüfungen</th></tr></thead><tbody>
        {(data ?? []).map((w) => (
          <tr key={w.id}><td>{w.name}</td><td>{w.stamp}</td>
            <td>{(w.welder_certificates as any[]).map((c, i) => (
              <div key={i}>{c.process} / {c.material_group ?? "–"} / {c.thickness_min ?? "–"}–{c.thickness_max ?? "–"} mm
                {" / Ø "}{c.diameter_min ?? "–"}–{c.diameter_max ?? "∞"} mm
                {" / "}{(c.positions ?? []).join(", ") || "–"} · <FristAmpel datum={c.valid_until} /></div>
            ))}</td></tr>
        ))}
      </tbody></table>
    </>
  );
}
