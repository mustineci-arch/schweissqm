import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { FristAmpel } from "@/components/Ampel";

async function neu(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const { data: w } = await sb.from("welders").insert({ tenant_id: tenantId, name: String(fd.get("name")), stamp: String(fd.get("stamp")) || null }).select("id").single();
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  if (w && fd.get("process")) {
    await sb.from("welder_certificates").insert({
      tenant_id: tenantId, welder_id: w.id, process: String(fd.get("process")),
      material_group: String(fd.get("mg")) || null, thickness_min: n("tmin"), thickness_max: n("tmax"),
      valid_until: String(fd.get("bis")) || null,
    });
  }
  revalidatePath("/schweisser");
}

export default async function Page() {
  const { sb } = await ctx();
  const { data } = await sb.from("welders").select("id,name,stamp,welder_certificates(process,material_group,thickness_min,thickness_max,valid_until)").order("name");
  return (
    <>
      <h1>Schweißer</h1>
      <form className="card" action={neu}>
        <input name="name" placeholder="Name" required /><input name="stamp" placeholder="Stempel" />
        <input name="process" placeholder="Verfahren (z. B. 135)" /><input name="mg" placeholder="Werkstoffgruppe" />
        <input name="tmin" type="number" step="0.1" placeholder="Dicke min" /><input name="tmax" type="number" step="0.1" placeholder="Dicke max" />
        <input name="bis" type="date" title="gültig bis" /><button>Anlegen</button>
      </form>
      <table><thead><tr><th>Name</th><th>Stempel</th><th>Prüfungen</th></tr></thead><tbody>
        {(data ?? []).map((w) => (
          <tr key={w.id}><td>{w.name}</td><td>{w.stamp}</td>
            <td>{(w.welder_certificates as any[]).map((c, i) => <div key={i}>{c.process} / {c.material_group ?? "–"} / {c.thickness_min ?? "–"}–{c.thickness_max ?? "–"} mm · <FristAmpel datum={c.valid_until} /></div>)}</td></tr>
        ))}
      </tbody></table>
    </>
  );
}
