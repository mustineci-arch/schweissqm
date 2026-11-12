import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { parseCsv } from "@/lib/csv";
import { schweisserAusCsvZeilen } from "@/lib/schweisser-import";

async function importieren(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const file = fd.get("file") as File | null;
  if (!file || !file.size) redirect("/schweisser/import?fehler=" + encodeURIComponent("Bitte eine Datei wählen"));
  const text = await file.text();
  const schweisser = schweisserAusCsvZeilen(parseCsv(text));
  if (!schweisser.length) redirect("/schweisser/import?fehler=" + encodeURIComponent("Keine Zeilen mit Name gefunden"));

  let neueSchweisser = 0, neueZertifikate = 0, aktualisierteZertifikate = 0;
  const fehlerListe: string[] = [];
  for (const s of schweisser) {
    const { data: bestehend } = await sb.from("welders").select("id").ilike("name", s.name).maybeSingle();
    let welderId = bestehend?.id as string | undefined;
    if (!welderId) {
      const { data: neu, error } = await sb.from("welders").insert({
        tenant_id: tenantId, name: s.name, stamp: s.stamp, birthdate: s.birthdate, employer: s.employer, active: s.active,
      }).select("id").single();
      if (error) { fehlerListe.push(`${s.name}: ${error.message}`); continue; }
      welderId = neu?.id;
      neueSchweisser++;
    } else {
      const { error } = await sb.from("welders").update({ stamp: s.stamp, birthdate: s.birthdate, employer: s.employer, active: s.active }).eq("id", welderId);
      if (error) fehlerListe.push(`${s.name}: ${error.message}`);
    }
    if (!welderId) continue;

    const { data: vorhandeneCerts } = await sb.from("welder_certificates").select("id,cert_no,bezeichnung").eq("welder_id", welderId);
    for (const c of s.certs) {
      const treffer = (vorhandeneCerts ?? []).find((v) => (c.cert_no && v.cert_no === c.cert_no) || (!c.cert_no && v.bezeichnung === c.bezeichnung));
      const felder = {
        cert_no: c.cert_no, process: c.process, bezeichnung: c.bezeichnung, material_group: c.material_group,
        thickness_min: c.thickness_min, thickness_max: c.thickness_max, diameter_min: c.diameter_min, diameter_max: c.diameter_max,
        positions: c.positions, valid_until: c.valid_until, last_confirmed_on: c.last_confirmed_on,
      };
      if (treffer) {
        const { error } = await sb.from("welder_certificates").update(felder).eq("id", treffer.id);
        if (error) fehlerListe.push(`${s.name} (${c.bezeichnung ?? c.cert_no}): ${error.message}`); else aktualisierteZertifikate++;
      } else {
        const { error } = await sb.from("welder_certificates").insert({ tenant_id: tenantId, welder_id: welderId, ...felder });
        if (error) fehlerListe.push(`${s.name} (${c.bezeichnung ?? c.cert_no}): ${error.message}`); else neueZertifikate++;
      }
    }
  }
  revalidatePath("/schweisser");
  const ergebnis = `${neueSchweisser} neue Schweißer, ${neueZertifikate} neue und ${aktualisierteZertifikate} aktualisierte Zertifikate`;
  if (fehlerListe.length) redirect(`/schweisser/import?ok=${encodeURIComponent(ergebnis)}&fehler=${encodeURIComponent(fehlerListe.slice(0, 5).join(" · "))}`);
  redirect(`/schweisser/import?ok=${encodeURIComponent(ergebnis)}`);
}

export default async function Import({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const { fehler, ok } = await searchParams;
  return (
    <>
      <p className="sub"><Link href="/schweisser">← Zur Liste</Link></p>
      <h1>Excel-Übersicht importieren</h1>
      <p className="sub">
        CSV im Format des Excel-Exports (<Link href="/schweisser/export">📤 Export</Link>). Schweißer werden nach Name
        zugeordnet (vorhandene werden ergänzt, nicht dupliziert), Zertifikate nach Zert.-Nr. bzw. Bezeichnung.
      </p>
      {fehler && <p className="err">{fehler}</p>}
      {ok && <p className="ok">{ok}</p>}
      <form className="card" action={importieren}>
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button>📊 Importieren</button>
      </form>
    </>
  );
}
