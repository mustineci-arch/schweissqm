import type { SupabaseClient } from "@supabase/supabase-js";
import { gesamt, nahtGegenWpsUndSchweisser, type Pruefpunkt } from "@/lib/deckung";

// Regel (explizit): Zuordnung nur wenn WPS-Revision "freigegeben" UND mindestens eine Prüfung des Schweißers die Naht GEDECKT hat.
// NICHT_BEWERTBAR blockiert wie NICHT_GEDECKT.
export async function pruefeZuordnung(sb: SupabaseClient, weldId: string, revId: string, welderId: string): Promise<{ ok: boolean; gruende: string[] }> {
  const [{ data: weld }, { data: rev }, { data: welder }] = await Promise.all([
    sb.from("welds").select("material_group,thickness").eq("id", weldId).maybeSingle(),
    sb.from("wps_revisions").select("status,revision,process,material_group,thickness_min,thickness_max,diameter_min,wps(wps_no)").eq("id", revId).maybeSingle(),
    sb.from("welders").select("name,welder_certificates(process,material_group,thickness_min,thickness_max,diameter_min,valid_until)").eq("id", welderId).maybeSingle(),
  ]);
  if (!weld || !rev || !welder) return { ok: false, gruende: ["Naht, WPS oder Schweißer nicht gefunden"] };
  const r = rev as any; const w = welder as any;
  const gruende: string[] = [];
  if (r.status !== "freigegeben") gruende.push(`WPS ${r.wps?.wps_no} Rev. ${r.revision} ist nicht freigegeben (Status: ${r.status})`);
  const certs = (w.welder_certificates ?? []) as any[];
  if (certs.length === 0) gruende.push(`Schweißer ${w.name}: keine Prüfung hinterlegt – Ergebnis „Nicht bewertbar“`);
  let beste: Pruefpunkt[] | null = null;
  for (const c of certs) {
    const p = nahtGegenWpsUndSchweisser(weld as any, r, c);
    if (gesamt(p) === "GEDECKT") return { ok: gruende.length === 0, gruende };
    if (!beste || p.filter((x) => x.status !== "GEDECKT").length < beste.filter((x) => x.status !== "GEDECKT").length) beste = p;
  }
  if (beste) for (const p of beste.filter((x) => x.status !== "GEDECKT"))
    gruende.push(`${p.parameter}: Naht/WPS ${p.soll} ↔ ${p.ist} – ${p.status} (${p.regel})`);
  return { ok: false, gruende };
}
