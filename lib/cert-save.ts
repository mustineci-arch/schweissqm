import { bwThicknessRange, fwThicknessRange, diameterRange, positionScope, type Nahtart, type Produktform } from "./iso9606";

// Unendlich (kein Maximum, z. B. Tabelle 7 Fall D > 25) lässt sich nicht speichern -> null.
const speicherbar = (v: number) => (v === Infinity ? null : v);

export type ZertifikatEingabe = {
  process: string | null; bezeichnung?: string | null; mg?: string | null; nahtart?: Nahtart | null; produkt?: Produktform | null;
  sOderT?: number | null; durchmesser?: number | null; positionRoh?: string | null;
  hatPC?: boolean; mehrfachlage?: boolean; richtung?: "steigend" | "fallend";
  tmin?: number | null; tmax?: number | null; dmin?: number | null; dmax?: number | null; positions?: string[] | null;
  fmGroup?: string | null; fillerType?: string | null; weldDetail?: string | null; layerBuild?: string | null;
  hasFilletTest?: boolean; combinedJointTest?: boolean; fixedPipe?: boolean; rotatingPipe?: boolean;
  bis?: string | null; cert_no?: string | null; issued_on?: string | null; verlaengerung_nach?: string | null;
};

// Baut die welder_certificates-Felder. Manuell eingetragene Werte (z. B. der vom Prüfer selbst
// ausgewiesene Geltungsbereich, den das Zertifikat-Einlesen vorbefüllt) haben Vorrang vor dem
// Normrechner – der greift nur ergänzend, wenn das jeweilige Feld leer ist.
export function zertifikatFelder(e: ZertifikatEingabe) {
  const { process, nahtart, produkt, sOderT, durchmesser: D, positionRoh } = e;

  let tmin = e.tmin ?? null, tmax = e.tmax ?? null;
  if (tmin === null && nahtart && sOderT && process) {
    const b = nahtart === "FW" ? fwThicknessRange(sOderT) : bwThicknessRange(sOderT, [process]);
    tmin = b.min; tmax = b.max !== null ? speicherbar(b.max) : null;
  }
  let dmin = e.dmin ?? null, dmax = e.dmax ?? null;
  if (dmin === null && produkt && D) {
    const b = diameterRange(D, produkt);
    dmin = b.min; dmax = b.max !== null ? speicherbar(b.max) : null;
  }
  let positions = e.positions ?? null;
  if (positions === null && nahtart && positionRoh) {
    positions = positionScope({
      nahtart, produkt: produkt ?? "P", position: positionRoh, durchmesser: D ?? null,
      hatPC: e.hatPC ?? false, mehrfachlage: e.mehrfachlage ?? false, richtung: e.richtung ?? "steigend",
    });
  }

  return {
    process, bezeichnung: e.bezeichnung ?? null, material_group: e.mg ?? null, joint_type: nahtart ?? null, product_type: produkt ?? null,
    fm_group: e.fmGroup ?? null, filler_type: e.fillerType ?? null, weld_detail: e.weldDetail ?? null, layer_build: e.layerBuild ?? null,
    thickness_min: tmin, thickness_max: tmax, diameter_min: dmin, diameter_max: dmax, positions,
    has_fillet_test: e.hasFilletTest ?? false, combined_joint_test: e.combinedJointTest ?? false, test_thickness: sOderT ?? null,
    test_diameter: D ?? null, test_position: positionRoh ?? null, fixed_pipe: e.fixedPipe ?? false, rotating_pipe: e.rotatingPipe ?? false,
    valid_until: e.bis ?? null, cert_no: e.cert_no ?? null, issued_on: e.issued_on ?? null, verlaengerung_nach: e.verlaengerung_nach ?? null,
  };
}

// Formular-Variante (Server Actions mit <form action={...}>): liest dieselben Felder aus FormData.
export function zertifikatFelderAusFormular(fd: FormData) {
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const positionsRoh = String(fd.get("positions") ?? "").trim();
  return zertifikatFelder({
    process: t("process"), bezeichnung: t("bezeichnung"), mg: t("mg"),
    nahtart: t("nahtart") as Nahtart | null, produkt: t("produkt") as Produktform | null,
    sOderT: n("s_oder_t"), durchmesser: n("durchmesser"), positionRoh: t("position_roh")?.toUpperCase() ?? null,
    hatPC: fd.get("hatPC") === "on", mehrfachlage: fd.get("mehrfachlage") === "on",
    richtung: fd.get("richtung") === "fallend" ? "fallend" : "steigend",
    tmin: n("tmin"), tmax: n("tmax"), dmin: n("dmin"), dmax: n("dmax"),
    positions: positionsRoh ? positionsRoh.toUpperCase().split(/[\s,;]+/).filter(Boolean) : null,
    fmGroup: t("fmGroup"), fillerType: t("fillerType"), weldDetail: t("weldDetail"), layerBuild: t("layerBuild"),
    hasFilletTest: fd.get("hasFilletTest") === "on", combinedJointTest: fd.get("combinedJointTest") === "on",
    fixedPipe: fd.get("fixedPipe") === "on", rotatingPipe: fd.get("rotatingPipe") === "on",
    bis: t("bis"), cert_no: t("cert_no"), issued_on: t("issued_on"), verlaengerung_nach: t("verlaengerung_nach"),
  });
}
