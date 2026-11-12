import { describe, it, expect } from "vitest";
import { ampel } from "../lib/fristen";
import { fehlendeAngaben } from "../lib/wps";

const heute = new Date("2026-11-12T10:00:00");

describe("Fristen-Ampel", () => {
  it("abgelaufen = rot", () => expect(ampel("2026-11-01", heute).farbe).toBe("rot"));
  it("heute gültig = gelb", () => expect(ampel("2026-11-12", heute).farbe).toBe("gelb"));
  it("60 Tage = gelb", () => expect(ampel("2027-01-10", heute).farbe).toBe("gelb"));
  it("mehr als 60 Tage = grün", () => expect(ampel("2027-03-01", heute).farbe).toBe("gruen"));
  it("kein Datum = grau", () => expect(ampel(null, heute).farbe).toBe("grau"));
});

describe("WPS Pflichtangaben", () => {
  const voll = { process: "135", material_group: "1.1", joint_type: "BW", thickness_min: 3, thickness_max: 12, positions: ["PA"], filler: "G3Si1", shielding_gas: "M21" };
  it("vollständig", () => expect(fehlendeAngaben(voll)).toEqual([]));
  it("Schutzgas fehlt bei 135", () => expect(fehlendeAngaben({ ...voll, shielding_gas: "" }).map((x) => x.name)).toEqual(["Schutzgas"]));
  it("Schutzgas nicht nötig bei 111", () => expect(fehlendeAngaben({ ...voll, process: "111", shielding_gas: "" })).toEqual([]));
  it("leere Positionen", () => expect(fehlendeAngaben({ ...voll, positions: [] }).map((x) => x.name)).toEqual(["Positionen"]));
  it("Dicke 0 ist gültig", () => expect(fehlendeAngaben({ ...voll, thickness_min: 0 })).toEqual([]));
});
