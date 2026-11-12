import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";
import { parseCsv } from "@/lib/csv";
import { wpqrAusCsvZeilen } from "@/lib/wpqr-import";

async function importieren(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const file = fd.get("file") as File | null;
  if (!file || !file.size) redirect("/wpqr/import?fehler=" + encodeURIComponent("Bitte eine Datei wählen"));
  const text = await file.text();
  const liste = wpqrAusCsvZeilen(parseCsv(text));
  if (!liste.length) redirect("/wpqr/import?fehler=" + encodeURIComponent("Keine Zeilen mit WPQR-Nr gefunden"));

  let neu = 0, aktualisiert = 0;
  const fehlerListe: string[] = [];
  for (const w of liste) {
    const { data: bestehend } = await sb.from("wpqr").select("id").eq("wpqr_no", w.wpqr_no).maybeSingle();
    if (bestehend) {
      const { error } = await sb.from("wpqr").update(w).eq("id", bestehend.id);
      if (error) fehlerListe.push(`${w.wpqr_no}: ${error.message}`); else aktualisiert++;
    } else {
      const { error } = await sb.from("wpqr").insert({ tenant_id: tenantId, ...w });
      if (error) fehlerListe.push(`${w.wpqr_no}: ${error.message}`); else neu++;
    }
  }
  revalidatePath("/wpqr");
  const ergebnis = `${neu} neue und ${aktualisiert} aktualisierte WPQR`;
  if (fehlerListe.length) redirect(`/wpqr/import?ok=${encodeURIComponent(ergebnis)}&fehler=${encodeURIComponent(fehlerListe.slice(0, 5).join(" · "))}`);
  redirect(`/wpqr/import?ok=${encodeURIComponent(ergebnis)}`);
}

export default async function Import({ searchParams }: { searchParams: Promise<{ fehler?: string; ok?: string }> }) {
  const { fehler, ok } = await searchParams;
  return (
    <>
      <p className="sub"><Link href="/wpqr">← Zur WPQR-Liste</Link></p>
      <h1>WPQR-Liste importieren (Excel)</h1>
      <p className="sub">CSV im Format des Exports (<Link href="/wpqr/export">📤 Export</Link>). Vorhandene WPQR werden anhand der WPQR-Nr aktualisiert, neue angelegt.</p>
      {fehler && <p className="err">{fehler}</p>}
      {ok && <p className="ok">{ok}</p>}
      <form className="card" action={importieren}>
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button>📥 Importieren</button>
      </form>
    </>
  );
}
