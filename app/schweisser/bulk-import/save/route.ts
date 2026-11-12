import { ctx } from "@/lib/tenant";
import { zertifikatFelder, type ZertifikatEingabe } from "@/lib/cert-save";
import type { Nahtart, Produktform } from "@/lib/iso9606";

type Zeile = {
  name?: string; process?: string; mg?: string; nahtart?: Nahtart; produkt?: Produktform;
  bezeichnung?: string; s_oder_t?: number; durchmesser?: number; position_roh?: string; bis?: string;
  thickness_min?: number; thickness_max?: number; diameter_min?: number; diameter_max?: number; positions?: string[];
};

export async function POST(req: Request) {
  const { sb, tenantId } = await ctx();
  if (!tenantId) return Response.json({ fehler: "Nicht angemeldet" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const zeilen: Zeile[] = Array.isArray(body?.zeilen) ? body.zeilen : [];
  if (!zeilen.length) return Response.json({ fehler: "Keine Zeilen übergeben" }, { status: 400 });

  let neueSchweisser = 0, neueZertifikate = 0, aktualisierteZertifikate = 0;
  const fehlerListe: string[] = [];

  for (const z of zeilen) {
    const name = (z.name ?? "").trim();
    if (!name || !z.process) { fehlerListe.push(`${name || "(ohne Name)"}: Name und Verfahren sind Pflicht`); continue; }

    const { data: bestehend } = await sb.from("welders").select("id").ilike("name", name).maybeSingle();
    let welderId = bestehend?.id as string | undefined;
    if (!welderId) {
      const { data: neu, error } = await sb.from("welders").insert({ tenant_id: tenantId, name }).select("id").single();
      if (error) { fehlerListe.push(`${name}: ${error.message}`); continue; }
      welderId = neu?.id;
      neueSchweisser++;
    }
    if (!welderId) continue;

    const eingabe: ZertifikatEingabe = {
      process: z.process, bezeichnung: z.bezeichnung, mg: z.mg, nahtart: z.nahtart, produkt: z.produkt,
      sOderT: z.s_oder_t, durchmesser: z.durchmesser, positionRoh: z.position_roh,
      tmin: z.thickness_min, tmax: z.thickness_max, dmin: z.diameter_min, dmax: z.diameter_max, positions: z.positions,
      bis: z.bis,
    };
    const felder = zertifikatFelder(eingabe);

    const { data: vorhandeneCerts } = await sb.from("welder_certificates").select("id,bezeichnung").eq("welder_id", welderId);
    const treffer = (vorhandeneCerts ?? []).find((v) => v.bezeichnung && v.bezeichnung === felder.bezeichnung);
    if (treffer) {
      const { error } = await sb.from("welder_certificates").update(felder).eq("id", treffer.id);
      if (error) fehlerListe.push(`${name}: ${error.message}`); else aktualisierteZertifikate++;
    } else {
      const { error } = await sb.from("welder_certificates").insert({ tenant_id: tenantId, welder_id: welderId, ...felder });
      if (error) fehlerListe.push(`${name}: ${error.message}`); else neueZertifikate++;
    }
  }

  const ergebnis = `${neueSchweisser} neue Schweißer, ${neueZertifikate} neue und ${aktualisierteZertifikate} aktualisierte Zertifikate` +
    (fehlerListe.length ? ` · ${fehlerListe.length} Fehler: ${fehlerListe.slice(0, 5).join(" · ")}` : "");
  return Response.json({ ergebnis });
}
