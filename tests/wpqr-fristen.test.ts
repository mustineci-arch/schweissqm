import { describe, it, expect } from "vitest";
import { naechsteAp, apStatus } from "../lib/wpqr-fristen";

describe("naechsteAp()", () => {
  it("addiert die Intervallmonate auf das letzte AP-Datum", () => {
    expect(naechsteAp("2026-01-15", 6)).toBe("2026-07-15");
  });
  it("ohne letzte AP: null", () => {
    expect(naechsteAp(null, 6)).toBeNull();
  });
});

describe("apStatus()", () => {
  const heute = new Date("2026-06-01T12:00:00Z");

  it("nie geprüft -> unbekannt", () => {
    expect(apStatus(null, 6, 30, heute).status).toBe("unbekannt");
  });
  it("nächste AP in der Vergangenheit -> überfällig", () => {
    expect(apStatus("2025-10-01", 6, 30, heute).status).toBe("überfällig");
  });
  it("nächste AP innerhalb der Warnfrist -> bald fällig", () => {
    expect(apStatus("2026-01-01", 6, 30, heute).status).toBe("bald fällig");
  });
  it("nächste AP weit in der Zukunft -> gültig", () => {
    expect(apStatus("2026-05-01", 6, 30, heute).status).toBe("gültig");
  });
});
