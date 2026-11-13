import { describe, it, expect } from "vitest";
import { parsePruefbezeichnung } from "../lib/bezeichnung-parser";
import { pruefbezeichnung } from "../lib/iso9606";

describe("parsePruefbezeichnung()", () => {
  it("parst eine vollständige Bezeichnung mit allen Teilen", () => {
    const out = parsePruefbezeichnung("141 T BW FM3 S s3,6 D60,3 PH ss nb ml");
    expect(out).toMatchObject({
      process: "141", produkt: "T", nahtart: "BW", fmGroup: "FM3", fillerType: "S",
      dicke: 3.6, durchmesser: 60.3, position: "PH", weldDetail: "ss_nb", layerBuild: "ml",
    });
    expect(out.unerkannt).toEqual([]);
  });

  it("ignoriert ein optionales 'ISO 9606-1 '-Präfix", () => {
    expect(parsePruefbezeichnung("ISO 9606-1 135 P FW S t6 PB").process).toBe("135");
  });

  it("Rohr-Position mit Zusatz (z. B. PH-L045) wird als Ganzes erkannt", () => {
    expect(parsePruefbezeichnung("141 T BW FM5 S s5,1 D48,3 PH-L045 ss gb").position).toBe("PH-L045");
  });

  it("Blech ohne Durchmesser bleibt durchmesser null", () => {
    const out = parsePruefbezeichnung("135 P FW FM1 S s6 PB");
    expect(out.produkt).toBe("P");
    expect(out.durchmesser).toBeNull();
  });

  it("Round-Trip über pruefbezeichnung(): formatieren und wieder parsen ergibt dieselben Felder", () => {
    const cert = {
      process: "141", product_type: "T", joint_type: "BW" as const, fm_group: "FM3",
      filler_type: "S", test_thickness: 3.6, test_diameter: 60.3, test_position: "PH",
      weld_detail: "ss_nb", layer_build: "ml",
    };
    const bezeichnung = pruefbezeichnung(cert);
    const geparst = parsePruefbezeichnung(bezeichnung);
    expect(geparst).toMatchObject({
      process: "141", produkt: "T", nahtart: "BW", fmGroup: "FM3", fillerType: "S",
      dicke: 3.6, durchmesser: 60.3, position: "PH", weldDetail: "ss_nb", layerBuild: "ml",
    });
  });

  it("unbekannte Tokens landen in unerkannt", () => {
    expect(parsePruefbezeichnung("141 T BW xyz123").unerkannt).toContain("xyz123");
  });
});
