import { supabaseServer } from "@/lib/supabase/server";
export async function ctx() {
  const sb = await supabaseServer();
  const { data: m } = await sb.from("memberships").select("tenant_id, role").limit(1).maybeSingle();
  return { sb, tenantId: (m?.tenant_id as string | undefined) ?? null, role: (m?.role as string | undefined) ?? null };
}
