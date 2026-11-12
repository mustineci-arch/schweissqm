import { ctx } from "@/lib/tenant";
import { pruefbezeichnung } from "@/lib/iso9606";

const csvZelle = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const { sb, tenantId } = await ctx();
  if (!tenantId) return new Response("Nicht angemeldet", { status: 401 });
  const { data } = await sb.from("welders").select("name,stamp,birthdate,employer,active,welder_certificates(bezeichnung,process,material_group,joint_type,thickness_min,thickness_max,diameter_min,diameter_max,positions,cert_no,valid_until,last_confirmed_on)").order("name");

  const kopf = ["Name", "Zeichen", "Geburtsdatum", "Arbeitgeber", "Aktiv", "Zert.-Nr.", "Verfahren", "Bezeichnung", "Werkstoffgruppe", "Dicke min", "Dicke max", "Durchmesser min", "Durchmesser max", "Positionen", "Gültig bis", "Zuletzt bestätigt"];
  const zeilen = [kopf.map(csvZelle).join(";")];
  for (const w of data ?? []) {
    const certs = (w.welder_certificates as any[]) ?? [];
    if (!certs.length) {
      zeilen.push([w.name, w.stamp, w.birthdate, w.employer, w.active === false ? "nein" : "ja", "", "", "", "", "", "", "", "", "", "", ""].map(csvZelle).join(";"));
      continue;
    }
    for (const c of certs) {
      zeilen.push([
        w.name, w.stamp, w.birthdate, w.employer, w.active === false ? "nein" : "ja",
        c.cert_no, c.process, c.bezeichnung || pruefbezeichnung(c), c.material_group, c.thickness_min, c.thickness_max,
        c.diameter_min, c.diameter_max, (c.positions ?? []).join(", "), c.valid_until, c.last_confirmed_on,
      ].map(csvZelle).join(";"));
    }
  }
  const csv = "﻿" + zeilen.join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="schweisser-export.csv"' } });
}
