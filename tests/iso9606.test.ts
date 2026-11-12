import { describe, it, expect } from "vitest";
import { bwThicknessRange, fwThicknessRange, diameterRange, positionScope, pruefbezeichnung } from "../lib/iso9606";

describe("ISO 9606-1 Normrechner: Dicke", () => {
  it("BW s < 3mm: Bereich s bis max(3, 2s)", () => expect(bwThicknessRange(2, ["135"])).toEqual({ min: 2, max: 4 }));
  it("BW s < 12mm: Bereich 3 bis 2s", () => expect(bwThicknessRange(8, ["135"])).toEqual({ min: 3, max: 16 }));
  it("BW s >= 12mm: Bereich 3 bis unendlich", () => expect(bwThicknessRange(15, ["135"])).toEqual({ min: 3, max: Infinity }));
  it("BW Prozess 311: Faktor 1,5 statt 2", () => expect(bwThicknessRange(8, ["311"])).toEqual({ min: 3, max: 12 }));
  it("FW t < 3mm", () => expect(fwThicknessRange(2)).toEqual({ min: 2, max: 4 }));
  it("FW t >= 3mm: ab 3 unendlich", () => expect(fwThicknessRange(5)).toEqual({ min: 3, max: Infinity }));
  it("ohne Wert nicht bestimmbar", () => expect(bwThicknessRange(null, ["135"])).toEqual({ min: null, max: null }));
});

describe("ISO 9606-1 Normrechner: Durchmesser", () => {
  it("D <= 25: Bereich D bis 2D", () => expect(diameterRange(20, "T")).toEqual({ min: 20, max: 40 }));
  it("D > 25: ab max(0,5D; 25) unendlich", () => expect(diameterRange(100, "T")).toEqual({ min: 50, max: Infinity }));
  it("D > 25 aber 0,5D < 25: ab 25 unendlich", () => expect(diameterRange(40, "T")).toEqual({ min: 25, max: Infinity }));
  it("Blech (P): nicht relevant", () => expect(diameterRange(100, "P")).toEqual({ min: null, max: null }));
});

describe("ISO 9606-1 Normrechner: Position (Tabelle 9/10 + Abschnitt 5.8)", () => {
  it("BW PH qualifiziert PA, PE, PF", () => expect(positionScope({
    nahtart: "BW", produkt: "P", position: "PH", durchmesser: null, hatPC: false, mehrfachlage: false, richtung: "steigend",
  }).sort()).toEqual(["PA", "PE", "PF"].sort()));
  it("FW PD qualifiziert PA-PE", () => expect(positionScope({
    nahtart: "FW", produkt: "P", position: "PD", durchmesser: null, hatPC: false, mehrfachlage: false, richtung: "steigend",
  }).sort()).toEqual(["PA", "PB", "PC", "PD", "PE"].sort()));
  it("Rohr PH + PC (5.8) qualifiziert zusätzlich HL045", () => expect(positionScope({
    nahtart: "BW", produkt: "T", position: "PH", durchmesser: null, hatPC: true, mehrfachlage: false, richtung: "steigend",
  })).toContain("HL045"));
  it("D>=150 2/3+1/3-Umfang steigend qualifiziert alle Positionen der Richtung", () => {
    const s = positionScope({ nahtart: "BW", produkt: "T", position: "PH", durchmesser: 200, hatPC: true, mehrfachlage: true, richtung: "steigend" });
    expect(s.sort()).toEqual(["PA", "PB", "PC", "PD", "PE", "PF", "PH", "HL045"].sort());
  });
  it("ohne 5.8-Zusatzbedingungen keine Erweiterung bei Blech", () => expect(positionScope({
    nahtart: "BW", produkt: "P", position: "PH", durchmesser: 200, hatPC: true, mehrfachlage: true, richtung: "steigend",
  }).sort()).toEqual(["PA", "PE", "PF"].sort()));
});

describe("ISO 9606-1: genormte Prüfungsbezeichnung", () => {
  it("Rohr BW mit FM-Gruppe, Zusatzart, Dicke, Durchmesser, Position, Detail, Lagenaufbau", () => {
    expect(pruefbezeichnung({
      process: "141", product_type: "T", joint_type: "BW", fm_group: "FM3", filler_type: "S",
      test_thickness: 3.6, test_diameter: 60.3, test_position: "PH", weld_detail: "ss_nb", layer_build: "ml",
    })).toBe("141 T BW FM3 S s3,6 D60,3 PH ss nb ml");
  });
  it("Kehlnaht nutzt t- statt s-Präfix für die Dicke", () => {
    expect(pruefbezeichnung({
      process: "135", product_type: "P", joint_type: "FW", fm_group: null, filler_type: null,
      test_thickness: 8, test_diameter: null, test_position: null, weld_detail: null, layer_build: null,
    })).toBe("135 P FW t8");
  });
  it("Blech: Durchmesser wird nicht angehängt, auch wenn vorhanden", () => {
    expect(pruefbezeichnung({
      process: "135", product_type: "P", joint_type: "BW", fm_group: null, filler_type: null,
      test_thickness: 5, test_diameter: 100, test_position: null, weld_detail: null, layer_build: null,
    })).toBe("135 P BW s5");
  });
  it("nur Pflichtfeld Verfahren vorhanden", () => {
    expect(pruefbezeichnung({
      process: "111", product_type: null, joint_type: null, fm_group: null, filler_type: null,
      test_thickness: null, test_diameter: null, test_position: null, weld_detail: null, layer_build: null,
    })).toBe("111");
  });
});
