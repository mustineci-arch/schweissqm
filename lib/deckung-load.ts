import type { SupabaseClient } from "@supabase/supabase-js";
import { gesamt, schweisserGegenWps, wpsGegenWpqr, type Pruefpunkt } from "@/lib/deckung";

export type Block = { titel: string; punkte: Pruefpunkt[] };

export async function ladeDeckung(sb: SupabaseClient, p: { rev?: string; welder?: string; wpqr?: string }) {
  const [{ data: revs }, { data: welders }, { data: qs }] = await Promise.all([
    sb.from("wps_revisions").select("id,revision,status,process,material_group,thickness_min,thickness_max,diameter_min,wps(wps_no)").order("created_at"),
    sb.from("welders").select("id,name,welder_certificates(process,material_group,thickness_min,thickness_max,diameter_min,valid_until)").order("name"),
    sb.from("wpqr").select("id,wpqr_no,process,material_group").order("wpqr_no"),
  ]);
  const R = (revs ?? []) as any[]; const W = (welders ?? []) as any[]; const Q = (qs ?? []) as any[];
  const r = R.find((x) => x.id === p.rev);
  const w = W.find((x) => x.id === p.welder);
  const q = Q.find((x) => x.id === p.wpqr);
  const blocks: Block[] = [];
  if (r && w) {
    const certs = w.welder_certificates as any[];
    for (const c of certs) blocks.push({ titel: `Schweißer ${w.name} gegen WPS`, punkte: schweisserGegenWps(r, c) });
    if (certs.length === 0) blocks.push({ titel: `Schweißer ${w.name}: keine Prüfung hinterlegt`, punkte: [] });
  }
  if (r && q) blocks.push({ titel: `WPS gegen WPQR ${q.wpqr_no}`, punkte: wpsGegenWpqr(r, q) });
  return { R, W, Q, r, w, q, blocks, gesamt };
}
