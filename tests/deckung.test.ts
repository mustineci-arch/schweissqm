import { describe, it, expect } from "vitest";
import { schweisserGegenWps, wpsGegenWpqr, gesamt } from "../lib/deckung";

const wps = { process: "135", material_group: "1.1", thickness_min: 5, thickness_max: 12, diameter_min: null, positions: ["PA", "PC"] };
const cert = { process: "135", material_group: "1.1", thickness_min: 3, thickness_max: 20, diameter_min: null, diameter_max: null, positions: ["PA", "PC", "PF"], valid_until: "2027-01-01" };

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
  it("WPQR bleibt nicht bewertbar ohne validiertes Regelset", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "135", material_group: "1.1" }))).toBe("NICHT_BEWERTBAR");
  });
  it("WPQR Verfahren abweichend -> nicht gedeckt", () => {
    expect(gesamt(wpsGegenWpqr(wps, { process: "141", material_group: "1.1" }))).toBe("NICHT_GEDECKT");
  });
});

import { nahtGegenWpsUndSchweisser } from "../lib/deckung";
describe("Deckungscheck je Naht", () => {
  const heute = new Date("2026-11-12");
  const naht = { material_group: "1.1", thickness: 8 };
  it("gedeckt", () => expect(gesamt(nahtGegenWpsUndSchweisser(naht, wps, cert, heute))).toBe("GEDECKT"));
  it("Dicke außerhalb WPS", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, thickness: 14 }, wps, cert, heute))).toBe("NICHT_GEDECKT"));
  it("Nahtdicke fehlt -> nicht bewertbar", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, thickness: null }, wps, cert, heute))).toBe("NICHT_BEWERTBAR"));
  it("andere Werkstoffgruppe", () => expect(gesamt(nahtGegenWpsUndSchweisser({ ...naht, material_group: "8.1" }, wps, cert, heute))).toBe("NICHT_GEDECKT"));
});
