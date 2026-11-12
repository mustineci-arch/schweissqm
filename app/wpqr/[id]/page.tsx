import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

type Dokument = { pfad: string; name: string; hochgeladen_am: string };

async function hochladen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  const wpqrId = String(fd.get("wpqr_id"));
  const file = fd.get("file") as File | null;
  if (!tenantId || !file || !file.size) { revalidatePath(`/wpqr/${wpqrId}`); return; }
  const pfad = `${tenantId}/wpqr/${wpqrId}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from("dokumente").upload(pfad, file, { contentType: file.type || undefined });
  if (!error) {
    const { data: w } = await sb.from("wpqr").select("dokumente").eq("id", wpqrId).maybeSingle();
    const dokumente: Dokument[] = Array.isArray(w?.dokumente) ? w!.dokumente : [];
    dokumente.push({ pfad, name: file.name, hochgeladen_am: new Date().toISOString().slice(0, 10) });
    await sb.from("wpqr").update({ dokumente }).eq("id", wpqrId);
  }
  revalidatePath(`/wpqr/${wpqrId}`);
}

async function dokumentLoeschen(fd: FormData) {
  "use server";
  const { sb } = await ctx();
  const wpqrId = String(fd.get("wpqr_id"));
  const pfad = String(fd.get("pfad"));
  await sb.storage.from("dokumente").remove([pfad]);
  const { data: w } = await sb.from("wpqr").select("dokumente").eq("id", wpqrId).maybeSingle();
  const dokumente: Dokument[] = (Array.isArray(w?.dokumente) ? w!.dokumente : []).filter((d: Dokument) => d.pfad !== pfad);
  await sb.from("wpqr").update({ dokumente }).eq("id", wpqrId);
  revalidatePath(`/wpqr/${wpqrId}`);
}

export default async function WpqrDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await ctx();
  const { data: q } = await sb.from("wpqr").select("*").eq("id", id).maybeSingle();
  if (!q) notFound();
  const dokumente: Dokument[] = Array.isArray(q.dokumente) ? q.dokumente : [];
  const links = await Promise.all(dokumente.map(async (d) => {
    const { data } = await sb.storage.from("dokumente").createSignedUrl(d.pfad, 3600);
    return { ...d, url: data?.signedUrl ?? null };
  }));

  return (
    <>
      <p className="sub"><Link href="/wpqr">← Zur WPQR-Liste</Link></p>
      <h1>WPQR {q.wpqr_no}</h1>
      <p className="sub">{q.standard} {q.standard_edition} · Verfahren {q.process} · {q.material_group ?? "–"}</p>

      <h2>Dokumentenmappe</h2>
      <p className="sub">Ersetzt die Ordnerstruktur der Desktop-App (01_WPQR … 07_Fertige_Dokumentation). PDFs bis 10 MB.</p>
      <form className="card" action={hochladen}>
        <input type="hidden" name="wpqr_id" value={q.id} />
        <input type="file" name="file" required />
        <button>📁 Hochladen</button>
      </form>
      <table><thead><tr><th>Datei</th><th>Hochgeladen am</th><th></th></tr></thead><tbody>
        {links.map((d) => (
          <tr key={d.pfad}>
            <td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</td>
            <td>{d.hochgeladen_am}</td>
            <td>
              <form action={dokumentLoeschen}>
                <input type="hidden" name="wpqr_id" value={q.id} />
                <input type="hidden" name="pfad" value={d.pfad} />
                <button className="sek" style={{ color: "#8a1f15", borderColor: "#8a1f15" }}>Löschen</button>
              </form>
            </td>
          </tr>
        ))}
        {!dokumente.length && <tr><td colSpan={3} className="sub">Noch keine Dokumente abgelegt.</td></tr>}
      </tbody></table>
    </>
  );
}
