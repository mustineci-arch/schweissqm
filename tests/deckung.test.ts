import { describe, it, expect } from "vitest";
import { schweisserGegenWps, wpsGegenWpqr, gesamt } from "../lib/deckung";

const wps = {
  process: "135", material_group: "1.1", joint_type: "BW", product_type: null, fm_group: null, filler_type: null, weld_detail: null, layer_build: null,
  thickness_min: 5, thickness_max: 12, diameter_min: null, positions: ["PA", "PC"],
};
const cert = {
  process: "135", material_group: "1.1", joint_type: "BW", product_type: null, fm_group: null, filler_type: null, weld_detail: null, layer_build: null,
  thickness_min: 3, thickness_max: 20, diameter_min: null, diameter_max: null,
  positions: ["PA", "PC", "PF"], has_fillet_test: false, combined_joint_test: false, test_thickness: null,
  test_diameter: null, fixed_pipe: false, rotating_pipe: false, valid_until: "2027-01-01",
};

describe("Deckungsprüfung", () => {
  it("Schweißer gedeckt", () => {
    expect(gesamt(schweisserGegenWps(wps, cert, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("abgelaufen -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps(wps, cert, new Date("2027-02-01")))).toBe("NICHT_GEDECKT");
  });
  it("Dicke außerhalb -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps(wps, { ...cert, thickness_max: 10 }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("fehlende Daten -> nicht bewertbar", () => {
    expect(gesamt(schweisserGegenWps(wps, { ...cert, thickness_min: null }, new Date("2026-11-11")))).toBe("NICHT_BEWERTBAR");
  });
  it("Position fehlt bei WPS -> nicht bewertbar", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, positions: null }, cert, new Date("2026-11-11")))).toBe("NICHT_BEWERTBAR");
  });
  it("Position nicht abgedeckt -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, positions: ["PA", "PG"] }, cert, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("Durchmesser außerhalb -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, diameter_min: 100 }, { ...cert, diameter_min: 20, diameter_max: 40 }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("Durchmesser ohne Obergrenze deckt alles ab diameter_min -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, diameter_min: 500 }, { ...cert, diameter_min: 25, diameter_max: null }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Nahtart fehlt bei Prüfung -> nicht bewertbar", () => {
    expect(gesamt(schweisserGegenWps(wps, { ...cert, joint_type: null }, new Date("2026-11-11")))).toBe("NICHT_BEWERTBAR");
  });
  it("FW qualifiziert BW nie -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "BW" }, { ...cert, joint_type: "FW" }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("BW qualifiziert FW nicht ohne Zusatzprüfung -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "FW" }, { ...cert, joint_type: "BW" }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("BW qualifiziert FW mit Zusatzprüfung Kehlnaht -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "FW" }, { ...cert, joint_type: "BW", has_fillet_test: true }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("BW qualifiziert FW mit kombinierter Prüfung und Prüfstückdicke >= 10mm -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "FW" }, { ...cert, joint_type: "BW", combined_joint_test: true, test_thickness: 10 }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("BW qualifiziert FW mit kombinierter Prüfung aber Prüfstückdicke < 10mm -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "FW" }, { ...cert, joint_type: "BW", combined_joint_test: true, test_thickness: 5 }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("BW qualifiziert FW mit kombinierter Prüfung aber ohne Prüfstückdicke -> nicht bewertbar", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, joint_type: "FW" }, { ...cert, joint_type: "BW", combined_joint_test: true, test_thickness: null }, new Date("2026-11-11")))).toBe("NICHT_BEWERTBAR");
  });
  it("Produktform nicht gefordert -> ignoriert, bleibt gedeckt", () => {
    expect(gesamt(schweisserGegenWps(wps, cert, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Produktform Rohr-Prüfung D>25 qualifiziert auch Blech -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, product_type: "P" }, { ...cert, product_type: "T", test_diameter: 100 }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Produktform Rohr-Prüfung D<=25 qualifiziert Blech nicht -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, product_type: "P" }, { ...cert, product_type: "T", test_diameter: 20 }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("Produktform Blech qualifiziert fest eingespanntes Rohr D>=500 -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, product_type: "T", diameter_min: 500 }, { ...cert, product_type: "P", fixed_pipe: true, diameter_min: 25 }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Produktform Blech qualifiziert Rohr D<500 ohne rotierend nicht -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, product_type: "T", diameter_min: 300 }, { ...cert, product_type: "P", diameter_min: 25 }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("FM-Gruppe nicht gefordert -> ignoriert", () => {
    expect(gesamt(schweisserGegenWps(wps, { ...cert, fm_group: "FM1" }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("FM-Gruppe FM3 deckt FM1 ab -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, fm_group: "FM1" }, { ...cert, fm_group: "FM3" }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("FM-Gruppe FM1 deckt FM3 nicht ab -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, fm_group: "FM3" }, { ...cert, fm_group: "FM1" }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("Schweißzusatzart B deckt R ab -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, filler_type: "R" }, { ...cert, filler_type: "B" }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Schweißdetail ss_nb deckt bs ab -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, weld_detail: "bs" }, { ...cert, weld_detail: "ss_nb" }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Lagenaufbau sl deckt ml nicht ab -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, layer_build: "ml" }, { ...cert, layer_build: "sl" }, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("Lagenaufbau ml deckt sl ab -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, layer_build: "sl" }, { ...cert, layer_build: "ml" }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Dicke mit nach oben offenem Prüfungsbereich (ab 12mm) deckt endliche WPS-Obergrenze ab -> gedeckt", () => {
    expect(gesamt(schweisserGegenWps(wps, { ...cert, thickness_min: 3, thickness_max: null }, new Date("2026-11-11")))).toBe("GEDECKT");
  });
  it("Dicke: WPS selbst nach oben offen, Prüfung endlich -> nicht gedeckt", () => {
    expect(gesamt(schweisserGegenWps({ ...wps, thickness_max: null }, cert, new Date("2026-11-11")))).toBe("NICHT_GEDECKT");
  });
  it("WPQR bleibt nicht bewertbar ohne validiertes Regelset", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "135", material_group: "1.1" }))).toBe("NICHT_BEWERTBAR");
  });
  it("WPQR Verfahren abweichend -> nicht gedeckt", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "141", material_group: "1.1" }))).toBe("NICHT_GEDECKT");
  });
});

import { auftragGegenPruefung } from "../lib/deckung";
describe("Auftrag gegen Prüfung (konkrete Einzelwerte statt Bereich)", () => {
  const heute = new Date("2026-11-11");
  const auftrag = {
    process: "135", material_group: "1.1", joint_type: "BW", product_type: null,
    fm_group: null, filler_type: null, weld_detail: null, layer_build: null,
    thickness: 8, diameter: null, position: "PA",
  };
  it("gedeckt", () => expect(gesamt(auftragGegenPruefung(auftrag, cert, heute))).toBe("GEDECKT"));
  it("Dicke außerhalb der Prüfung -> nicht gedeckt", () => expect(gesamt(auftragGegenPruefung({ ...auftrag, thickness: 25 }, cert, heute))).toBe("NICHT_GEDECKT"));
  it("Dicke fehlt -> nicht bewertbar", () => expect(gesamt(auftragGegenPruefung({ ...auftrag, thickness: null }, cert, heute))).toBe("NICHT_BEWERTBAR"));
  it("Position nicht in der Prüfung enthalten -> nicht gedeckt", () => expect(gesamt(auftragGegenPruefung({ ...auftrag, position: "PG" }, cert, heute))).toBe("NICHT_GEDECKT"));
  it("Durchmesser gefordert, Prüfung nach oben offen deckt ab -> gedeckt", () =>
    expect(gesamt(auftragGegenPruefung({ ...auftrag, diameter: 1000 }, { ...cert, diameter_min: 25, diameter_max: null }, heute))).toBe("GEDECKT"));
  it("Durchmesser gefordert, außerhalb des Prüfungsbereichs -> nicht gedeckt", () =>
    expect(gesamt(auftragGegenPruefung({ ...auftrag, diameter: 10 }, { ...cert, diameter_min: 25, diameter_max: null }, heute))).toBe("NICHT_GEDECKT"));
  it("andere Werkstoffgruppe als die Prüfung qualifiziert -> nicht gedeckt", () =>
    expect(gesamt(auftragGegenPruefung({ ...auftrag, material_group: "8.1" }, cert, heute))).toBe("NICHT_GEDECKT"));
});

import { nahtGegenWpsUndSchweisser } from "../lib/deckung";
describe("Deckungscheck je Naht", () => {
  const heute = new Date("2026-11-12");
  const naht = { material_group: "1.1", thickness: 8 };
  it("gedeckt", () => expect(gesamt(nahtGegenWpsUndSchweisser(naht, wps, cert, heute))).toBe("GEDECKT"));
  it("Dicke außerhalb WPS", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, thickness: 14 }, wps, cert, heute))).toBe("NICHT_GEDECKT"));
  it("Nahtdicke fehlt -> nicht bewertbar", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, thickness: null }, wps, cert, heute))).toBe("NICHT_BEWERTBAR"));
  it("andere Werkstoffgruppe", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, material_group: "8.1" }, wps, cert, heute))).toBe("NICHT_GEDECKT"));
  it("FW-WPS mit nur BW-geprüftem Schweißer -> nicht gedeckt", () =>
    expect(gesamt(nahtGegenWpsUndSchweisser(naht, { ...wps, joint_type: "FW" }, cert, heute))).toBe("NICHT_GEDECKT"));
});
