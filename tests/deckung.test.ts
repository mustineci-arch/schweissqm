import { describe, it, expect } from "vitest";
import { schweisserGegenWps, wpsGegenWpqr, gesamt } from "../lib/deckung";

const wps = { process: "135", material_group: "1.1", thickness_min: 5, thickness_max: 12, diameter_min: null };
const cert = { process: "135", material_group: "1.1", thickness_min: 3, thickness_max: 20, diameter_min: null, valid_until: "2027-01-01" };

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
  it("WPQR bleibt nicht bewertbar ohne validiertes Regelset", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "135", material_group: "1.1" }))).toBe("NICHT_BEWERTBAR");
  });
  it("WPQR Verfahren abweichend -> nicht gedeckt", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "141", material_group: "1.1" }))).toBe("NICHT_GEDECKT");
  });
});
