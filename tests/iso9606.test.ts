import { describe, it, expect } from "vitest";
import { bwThicknessRange, fwThicknessRange, diameterRange, positionScope, pruefbezeichnung, geltungsbereichAufschluesseln } from "../lib/iso9606";

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

describe("ISO 9606-1: vollständigen Geltungsbereich aufschlüsseln", () => {
  const basis = {
    process: "141", material_group: "1.3", product_type: "T" as const, joint_type: "BW" as const,
    thickness_min: 3, thickness_max: 16, diameter_min: 25, diameter_max: null,
    positions: ["PA", "PC"], fm_group: "FM3", filler_type: "S", weld_detail: "ss_nb", layer_build: "ml",
  };

  it("Verfahren und Werkstoffgruppe zeigen die zusätzlich abgedeckten Werte (Äquivalenz-/Qualifikationsregeln)", () => {
    const g = geltungsbereichAufschluesseln(basis);
    expect(g.verfahren).toEqual({ geprueft: "141", decktAuch: ["141", "143", "145"] });
    expect(g.werkstoffgruppe).toEqual({ geprueft: "1.3", decktAuch: ["1.1", "1.2", "1.3", "2.1"] });
  });

  it("Dicke/Durchmesser/Positionen werden unverändert aus den gespeicherten Bereichen übernommen", () => {
    const g = geltungsbereichAufschluesseln(basis);
    expect(g.dicke).toEqual({ min: 3, max: 16 });
    expect(g.durchmesser).toEqual({ min: 25, max: null });
    expect(g.positionen).toEqual(["PA", "PC"]);
  });

  it("FM-Gruppe/Schweißzusatzart/Schweißdetail/Lagenaufbau zeigen ebenfalls die Qualifikationsmatrix", () => {
    const g = geltungsbereichAufschluesseln(basis);
    expect(g.fmGruppe).toEqual({ geprueft: "FM3", decktAuch: ["FM1", "FM2", "FM3"] });
    expect(g.schweisszusatzart).toEqual({ geprueft: "S", decktAuch: ["S", "M"] });
    expect(g.schweissdetail).toEqual({ geprueft: "ss_nb", decktAuch: ["ss_nb", "ss_mb", "bs", "ss_gb", "ss_fb"] });
    expect(g.lagenaufbau).toEqual({ geprueft: "ml", decktAuch: ["sl", "ml"] });
  });

  it("fehlende optionale Felder (null) ergeben null statt eines Eintrags", () => {
    const g = geltungsbereichAufschluesseln({
      process: "135", material_group: null, product_type: null, joint_type: null,
      thickness_min: null, thickness_max: null, diameter_min: null, diameter_max: null,
      positions: null, fm_group: null, filler_type: null, weld_detail: null, layer_build: null,
    });
    expect(g.werkstoffgruppe).toBeNull();
    expect(g.dicke).toBeNull();
    expect(g.durchmesser).toBeNull();
    expect(g.positionen).toBeNull();
    expect(g.fmGruppe).toBeNull();
  });

  it("unbekannter Wert ohne Eintrag in der Matrix deckt nur sich selbst ab", () => {
    const g = geltungsbereichAufschluesseln({ ...basis, process: "999" });
    expect(g.verfahren).toEqual({ geprueft: "999", decktAuch: ["999"] });
  });
});
