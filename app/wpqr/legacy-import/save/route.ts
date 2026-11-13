import { ctx } from "@/lib/tenant";
import {
  istLegacySchweisserListe, legacySchweisserPlan, legacyProtokollArt, legacyProtokollPlan,
  findeWpqrId, findeWelderId, type LegacySchweisser,
} from "@/lib/legacy-import";

export async function POST(req: Request) {
  const { sb, tenantId } = await ctx();
  if (!tenantId) return Response.json({ fehler: "Nicht angemeldet" }, { status: 401 });

  const fd = await req.formData();
  const dateien = fd.getAll("dateien").filter((f): f is File => f instanceof File);
  if (!dateien.length) return Response.json({ fehler: "Keine Dateien übergeben" }, { status: 400 });

  const geparst: { name: string; daten: any }[] = [];
  const nichtErkannt: string[] = [];
  for (const datei of dateien) {
    try {
      geparst.push({ name: datei.name, daten: JSON.parse(await datei.text()) });
    } catch {
      nichtErkannt.push(datei.name);
    }
  }

  // Erst die Schweißer-Liste(n) verarbeiten, damit Protokolle sie per sw_idx finden (wie in der Referenz-App).
  let schweisserImBatch: LegacySchweisser[] | null = null;
  let neueSchweisser = 0, neueZertifikate = 0, aktualisierteZertifikate = 0;
  for (const { daten } of geparst) {
    if (!istLegacySchweisserListe(daten)) continue;
    schweisserImBatch = daten;
    const plan = legacySchweisserPlan(daten);
    for (const s of plan) {
      const { data: bestehend } = await sb.from("welders").select("id").ilike("name", s.name).maybeSingle();
      let welderId = bestehend?.id as string | undefined;
      if (!welderId) {
        const { data: neu, error } = await sb.from("welders").insert({ tenant_id: tenantId, name: s.name, stamp: s.stamp, birthdate: s.birthdate }).select("id").single();
        if (error) continue;
        welderId = neu?.id;
        neueSchweisser++;
      }
      if (!welderId) continue;
      const { data: vorhandeneCerts } = await sb.from("welder_certificates").select("id,bezeichnung").eq("welder_id", welderId);
      for (const c of s.certs) {
        const treffer = (vorhandeneCerts ?? []).find((v) => v.bezeichnung && v.bezeichnung === c.bezeichnung);
        if (treffer) { await sb.from("welder_certificates").update(c).eq("id", treffer.id); aktualisierteZertifikate++; }
        else { const { error } = await sb.from("welder_certificates").insert({ tenant_id: tenantId, welder_id: welderId, ...c }); if (!error) neueZertifikate++; }
      }
    }
  }

  // Dann die Protokolle/Entwürfe.
  const { data: wpqrListe } = await sb.from("wpqr").select("id,wpqr_no");
  const { data: welderListe } = await sb.from("welders").select("id,name");
  let neueProtokolle = 0;
  const protokollHinweise: string[] = [];
  for (const { name, daten } of geparst) {
    if (istLegacySchweisserListe(daten)) continue;
    if (Array.isArray(daten)) { nichtErkannt.push(name); continue; }
    const art = legacyProtokollArt(daten);
    if (art === "einstellungen") continue;
    if (art === "unbekannt") { nichtErkannt.push(name); continue; }
    const plan = legacyProtokollPlan(daten, schweisserImBatch);
    const wpqrId = findeWpqrId(plan.wpqr_no_gesucht, wpqrListe ?? []);
    const welderId = findeWelderId(plan.welder_name_gesucht, welderListe ?? []);
    const hinweise = [
      plan.wpqr_no_gesucht && !wpqrId ? `WPQR "${plan.wpqr_no_gesucht}" nicht gefunden` : null,
      plan.welder_name_gesucht && !welderId ? `Schweißer "${plan.welder_name_gesucht}" nicht gefunden` : null,
    ].filter(Boolean);
    const { error } = await sb.from("ap_protokolle").insert({
      tenant_id: tenantId, wpqr_id: wpqrId, welder_id: welderId, ap_datum: plan.ap_datum,
      pruefstueck: plan.pruefstueck, weitere_angaben: plan.weitere_angaben,
      bemerkung: hinweise.length ? `Import aus ${name}${art === "entwurf" ? " (Formular-Entwurf)" : ""}: ${hinweise.join(", ")}` : `Import aus ${name}${art === "entwurf" ? " (Formular-Entwurf)" : ""}`,
    });
    if (error) nichtErkannt.push(`${name} (${error.message})`);
    else { neueProtokolle++; if (hinweise.length) protokollHinweise.push(`${name}: ${hinweise.join(", ")}`); }
  }

  let ergebnis = `✅ Importiert: ${neueSchweisser} neue Schweißer, ${neueZertifikate} neue und ${aktualisierteZertifikate} aktualisierte Zertifikate, ${neueProtokolle} Protokoll(e).`;
  if (protokollHinweise.length) ergebnis += ` Bitte prüfen: ${protokollHinweise.slice(0, 5).join(" · ")}`;
  if (nichtErkannt.length) ergebnis += ` Nicht erkannt: ${nichtErkannt.join(", ")}`;
  return Response.json({ ergebnis });
}
