import type { SupabaseClient } from "@supabase/supabase-js";
import { gesamt, auftragGegenPruefung, type Pruefpunkt } from "@/lib/deckung";

const CERT_FELDER = "id,process,material_group,joint_type,product_type,fm_group,filler_type,weld_detail,layer_build,thickness_min,thickness_max,diameter_min,diameter_max,positions,has_fillet_test,combined_joint_test,test_thickness,test_diameter,fixed_pipe,rotating_pipe,valid_until";

export async function ladeAuftragPruefung(sb: SupabaseClient, p: { auftrag?: string; cert?: string }) {
  const [{ data: auftraege }, { data: welders }] = await Promise.all([
    sb.from("auftraege").select("*").order("created_at", { ascending: false }),
    sb.from("welders").select(`id,name,welder_certificates(${CERT_FELDER})`).order("name"),
  ]);
  const A = (auftraege ?? []) as any[];
  const W = (welders ?? []) as any[];
  const pruefungen = W.flatMap((w) => (w.welder_certificates as any[]).map((c) => ({ ...c, welderName: w.name })));
  const auftrag = A.find((x) => x.id === p.auftrag);
  const cert = pruefungen.find((x) => x.id === p.cert);
  const punkte: Pruefpunkt[] = auftrag && cert ? auftragGegenPruefung(auftrag, cert) : [];
  return { A, pruefungen, auftrag, cert, punkte, gesamt: punkte.length ? gesamt(punkte) : null };
}
