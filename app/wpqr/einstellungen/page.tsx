import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ctx } from "@/lib/tenant";

async function speichern(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const n = (k: string, fallback: number) => { const v = Number(fd.get(k)); return Number.isFinite(v) && v > 0 ? v : fallback; };
  await sb.from("tenant_settings").upsert({
    tenant_id: tenantId, firma: t("firma"), adresse: t("adresse"), ort_unterschrift: t("ort_unterschrift"),
    warn_tage: n("warn_tage", 30), ap_intervall_monate: n("ap_intervall_monate", 6),
  });
  revalidatePath("/wpqr");
  revalidatePath("/wpqr/einstellungen");
}

async function unterschriftHochladen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const file = fd.get("file") as File | null;
  if (!file || !file.size) return;
  const { data: alt } = await sb.from("tenant_settings").select("unterschrift_pfad").eq("tenant_id", tenantId).maybeSingle();
  if (alt?.unterschrift_pfad) await sb.storage.from("dokumente").remove([alt.unterschrift_pfad]);
  const pfad = `${tenantId}/unterschrift/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from("dokumente").upload(pfad, file, { contentType: file.type || undefined });
  if (!error) await sb.from("tenant_settings").upsert({ tenant_id: tenantId, unterschrift_pfad: pfad });
  revalidatePath("/wpqr/einstellungen");
}

async function unterschriftEntfernen(fd: FormData) {
  "use server";
  const { sb, tenantId } = await ctx();
  if (!tenantId) return;
  const pfad = String(fd.get("pfad"));
  await sb.storage.from("dokumente").remove([pfad]);
  await sb.from("tenant_settings").update({ unterschrift_pfad: null }).eq("tenant_id", tenantId);
  revalidatePath("/wpqr/einstellungen");
}

export default async function Einstellungen() {
  const { sb } = await ctx();
  const { data: s } = await sb.from("tenant_settings").select("*").maybeSingle();
  let unterschriftUrl: string | null = null;
  if (s?.unterschrift_pfad) {
    const { data } = await sb.storage.from("dokumente").createSignedUrl(s.unterschrift_pfad, 3600);
    unterschriftUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <p className="sub"><Link href="/wpqr">← Zur WPQR-Liste</Link></p>
      <h1>Einstellungen · Modul 2</h1>
      <form className="card" action={speichern}>
        <input name="firma" defaultValue={s?.firma ?? ""} placeholder="Firma (Hersteller)" />
        <input name="adresse" defaultValue={s?.adresse ?? ""} placeholder="Adresse (Ort der Schweißung, Fußzeile)" />
        <input name="ort_unterschrift" defaultValue={s?.ort_unterschrift ?? ""} placeholder="Ort für die Unterschriftszeile" />
        <input name="warn_tage" type="number" defaultValue={s?.warn_tage ?? 30} placeholder="Vorwarnzeit „bald fällig” [Tage]" />
        <input name="ap_intervall_monate" type="number" defaultValue={s?.ap_intervall_monate ?? 6} placeholder="Intervall Arbeitsprüfung [Monate]" />
        <button>Einstellungen speichern</button>
      </form>

      <h2>Digitale Unterschrift</h2>
      <p className="sub">Bild der Unterschrift der Schweißaufsichtsperson (PNG/JPG). Wird auf allen Geräten verwendet.</p>
      {unterschriftUrl && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={unterschriftUrl} alt="Unterschrift" style={{ maxHeight: 60 }} />
          <form action={unterschriftEntfernen}><input type="hidden" name="pfad" value={s!.unterschrift_pfad} /><button className="sek">Entfernen</button></form>
        </div>
      )}
      <form className="card" action={unterschriftHochladen}>
        <input type="file" name="file" accept="image/png,image/jpeg" required />
        <button>🖊 Unterschrift-Bild wählen</button>
      </form>
    </>
  );
}
