import { bwThicknessRange, fwThicknessRange, diameterRange, positionScope, type Nahtart, type Produktform } from "@/lib/iso9606";

// Unendlich (kein Maximum, z. B. Tabelle 7 Fall D > 25) lässt sich nicht speichern -> null.
const speicherbar = (v: number) => (v === Infinity ? null : v);

// Baut die welder_certificates-Felder aus dem Formular. Manuell eingetragene Werte (z. B. der
// vom Prüfer selbst ausgewiesene Geltungsbereich, den das Zertifikat-Einlesen vorbefüllt) haben
// Vorrang vor dem Normrechner – der greift nur ergänzend, wenn das jeweilige Feld leer ist.
export function zertifikatFelderAusFormular(fd: FormData) {
  const n = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  const t = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const process = t("process");
  const nahtart = t("nahtart") as Nahtart | null;
  const produkt = t("produkt") as Produktform | null;
  const sOderT = n("s_oder_t");
  const positionRoh = t("position_roh")?.toUpperCase() ?? null;

  let tmin = n("tmin"), tmax = n("tmax");
  if (tmin === null && nahtart && sOderT && process) {
    const b = nahtart === "FW" ? fwThicknessRange(sOderT) : bwThicknessRange(sOderT, [process]);
    tmin = b.min; tmax = b.max !== null ? speicherbar(b.max) : null;
  }
  let dmin = n("dmin"), dmax = n("dmax");
  const D = n("durchmesser");
  if (dmin === null && produkt && D) {
    const b = diameterRange(D, produkt);
    dmin = b.min; dmax = b.max !== null ? speicherbar(b.max) : null;
  }
  let positions: string[] | null = String(fd.get("positions") ?? "").trim()
    ? String(fd.get("positions")).toUpperCase().split(/[\s,;]+/).filter(Boolean) : null;
  if (positions === null && nahtart && positionRoh) {
    positions = positionScope({
      nahtart, produkt: produkt ?? "P", position: positionRoh, durchmesser: D,
      hatPC: fd.get("hatPC") === "on", mehrfachlage: fd.get("mehrfachlage") === "on",
      richtung: fd.get("richtung") === "fallend" ? "fallend" : "steigend",
    });
  }

  return {
    process, bezeichnung: t("bezeichnung"), material_group: t("mg"), joint_type: nahtart, product_type: produkt,
    fm_group: t("fmGroup"), filler_type: t("fillerType"), weld_detail: t("weldDetail"), layer_build: t("layerBuild"),
    thickness_min: tmin, thickness_max: tmax, diameter_min: dmin, diameter_max: dmax, positions,
    has_fillet_test: fd.get("hasFilletTest") === "on", combined_joint_test: fd.get("combinedJointTest") === "on", test_thickness: sOderT,
    test_diameter: D, test_position: positionRoh, fixed_pipe: fd.get("fixedPipe") === "on", rotating_pipe: fd.get("rotatingPipe") === "on",
    valid_until: t("bis"), cert_no: t("cert_no"), issued_on: t("issued_on"), verlaengerung_nach: t("verlaengerung_nach"),
  };
}
