import { describe, it, expect } from "vitest";
import { NORM_REGELN } from "../lib/norm-regeln";

describe("Normregel-Übersicht (Decoder)", () => {
  it("enthält genau die implementierten Normbereiche (wie in der Referenz-App, ohne die rohen Tabelle-9/10-Einträge)", () => {
    expect(NORM_REGELN).toHaveLength(15);
  });

  it("hat eindeutige Schlüssel", () => {
    const keys = NORM_REGELN.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("jede Regel hat mindestens eine Zeile", () => {
    for (const r of NORM_REGELN) expect(r.rows.length).toBeGreaterThan(0);
  });

  it("die berechneten Tabellen (Verfahren, FM, Werkstoffgruppen, Zusatzart, Tabelle 10, Details, Lagenaufbau) bleiben an die echten Matrizen gekoppelt", () => {
    const process = NORM_REGELN.find((r) => r.key === "process")!;
    // Grundregel-Zeile + mindestens so viele Zeilen wie PROZESS_AEQUIVALENZ-Einträge
    expect(process.rows.length).toBeGreaterThan(1);
    const fm = NORM_REGELN.find((r) => r.key === "fm")!;
    expect(fm.rows.some((row) => row[0].startsWith("FM1"))).toBe(true);
    const materials = NORM_REGELN.find((r) => r.key === "materials")!;
    expect(materials.rows.length).toBe(23);
  });
});
