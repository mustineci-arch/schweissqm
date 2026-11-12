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

export default async function Einstellungen() {
  const { sb } = await ctx();
  const { data: s } = await sb.from("tenant_settings").select("*").maybeSingle();
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
      <p className="hinweis">Digitale Unterschrift (Bild-Upload) ist noch nicht umgesetzt – folgt in einer späteren Runde.</p>
    </>
  );
}
