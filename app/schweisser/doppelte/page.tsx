import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

async function zusammenfuehren(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const zielId = String(fd.get("ziel_id"));
  const quelleId = String(fd.get("quelle_id"));
  if (zielId === quelleId) return;
  const { data: quelle } = await sb.from("welders").select("*").eq("id", quelleId).maybeSingle();
  const { data: ziel } = await sb.from("welders").select("*").eq("id", zielId).maybeSingle();
  if (!quelle || !ziel) return;

  await sb.from("welder_certificates").update({ welder_id: zielId }).eq("welder_id", quelleId);

  const varianten = new Set([...(ziel.name_variants ?? []), quelle.name]);
  (quelle.name_variants ?? []).forEach((v: string) => varianten.add(v));
  const ergaenzt: Record<string, unknown> = { name_variants: [...varianten] };
  if (!ziel.stamp && quelle.stamp) ergaenzt.stamp = quelle.stamp;
  if (!ziel.birthdate && quelle.birthdate) ergaenzt.birthdate = quelle.birthdate;
  if (!ziel.employer && quelle.employer) ergaenzt.employer = quelle.employer;
  await sb.from("welders").update(ergaenzt).eq("id", zielId);

  await sb.from("welders").delete().eq("id", quelleId);
  revalidatePath("/schweisser");
  revalidatePath("/schweisser/doppelte");
  redirect(`/schweisser/${zielId}`);
}

export default async function MoeglicheDoppelte() {
  const { sb } = await ctx();
  const { data } = await sb.from("welders").select("id,name,stamp,employer,name_variants,welder_certificates(id)").order("name");
  const alle = data ?? [];

  const gruppen = new Map<string, typeof alle>();
  for (const w of alle) {
    const schluessel = new Set([normName(w.name), ...(w.name_variants ?? []).map(normName)]);
    let gefunden = false;
    for (const k of schluessel) {
      if (gruppen.has(k)) { gruppen.get(k)!.push(w); gefunden = true; break; }
    }
    if (!gefunden) gruppen.set(normName(w.name), [w]);
  }
  // Einträge, die unter mehreren Schlüsseln gelandet sind, dedupen
  const gesehen = new Set<string>();
  const kandidaten = [...gruppen.values()].filter((g) => {
    if (g.length < 2) return false;
    const id = g.map((w) => w.id).sort().join(",");
    if (gesehen.has(id)) return false;
    gesehen.add(id);
    return true;
  });

  return (
    <>
      <p className="sub"><Link href="/schweisser">← Zur Liste</Link></p>
      <h1>Mögliche Doppelte</h1>
      <p className="sub">Erkannt über gleichen Namen oder Namensvarianten. Zusammenführen überträgt alle Zertifikate der Quelle in das Ziel und löscht die Quelle.</p>
      {kandidaten.map((g, i) => (
        <div key={i} className="card">
          <b>{g.map((w) => w.name).join(" · ")}</b>
          <table style={{ marginTop: 8 }}><thead><tr><th>Name</th><th>Zeichen</th><th>Arbeitgeber</th><th>Zertifikate</th><th>Ziel wählen</th></tr></thead><tbody>
            {g.map((w) => (
              <tr key={w.id}>
                <td><Link href={`/schweisser/${w.id}`}>{w.name}</Link></td>
                <td>{w.stamp ?? "–"}</td>
                <td>{w.employer ?? "–"}</td>
                <td>{(w.welder_certificates as any[]).length}</td>
                <td>
                  {g.filter((x) => x.id !== w.id).map((quelle) => (
                    <form key={quelle.id} action={zusammenfuehren} style={{ display: "inline-block", marginRight: 6 }}>
                      <input type="hidden" name="ziel_id" value={w.id} />
                      <input type="hidden" name="quelle_id" value={quelle.id} />
                      <button className="sek">🔗 „{quelle.name}" hier einfügen</button>
                    </form>
                  ))}
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      ))}
      {!kandidaten.length && <p className="sub">Keine möglichen Doppelten gefunden.</p>}
    </>
  );
}
