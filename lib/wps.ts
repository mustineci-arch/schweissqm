// Pflichtangaben für die Freigabe einer WPS-Revision (gleiche Regel wie in der Datenbank).
export const OHNE_SCHUTZGAS = ["111", "114"];

export type WpsFelder = {
  process?: string | null; material_group?: string | null; joint_type?: string | null;
  thickness_min?: number | null; thickness_max?: number | null; positions?: string[] | null;
  filler?: string | null; shielding_gas?: string | null;
};

export function fehlendeAngaben(r: WpsFelder): { feld: string; name: string }[] {
  const leer = (v?: string | null) => !v || v.trim() === "";
  const f: { feld: string; name: string }[] = [];
  if (leer(r.process)) f.push({ feld: "process", name: "Verfahren" });
  if (leer(r.material_group)) f.push({ feld: "material_group", name: "Werkstoffgruppe" });
  if (leer(r.joint_type)) f.push({ feld: "joint_type", name: "Nahtart" });
  if (r.thickness_min == null || r.thickness_max == null) f.push({ feld: "thickness_min", name: "Dickenbereich" });
  if (!r.positions || r.positions.length === 0) f.push({ feld: "positions", name: "Positionen" });
  if (leer(r.filler)) f.push({ feld: "filler", name: "Zusatzwerkstoff" });
  if (leer(r.shielding_gas) && !OHNE_SCHUTZGAS.includes((r.process ?? "").trim())) f.push({ feld: "shielding_gas", name: "Schutzgas" });
  return f;
}
