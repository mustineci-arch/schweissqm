import { describe, it, expect } from "vitest";
import { parseCsv } from "../lib/csv";

describe("parseCsv()", () => {
  it("parst Kopfzeile und Datenzeilen (Semikolon-getrennt, Anführungszeichen)", () => {
    const csv = '"Name";"Zeichen"\r\n"Max Mustermann";"MM1"\r\n"Erika Musterfrau";"EM2"\r\n';
    expect(parseCsv(csv)).toEqual([
      { Name: "Max Mustermann", Zeichen: "MM1" },
      { Name: "Erika Musterfrau", Zeichen: "EM2" },
    ]);
  });

  it("entfernt BOM am Anfang", () => {
    const csv = '﻿"A";"B"\r\n"1";"2"\r\n';
    expect(parseCsv(csv)).toEqual([{ A: "1", B: "2" }]);
  });

  it("verarbeitet escapte Anführungszeichen innerhalb eines Feldes", () => {
    const csv = '"Name"\r\n"Max ""Maxl"" Mustermann"\r\n';
    expect(parseCsv(csv)).toEqual([{ Name: 'Max "Maxl" Mustermann' }]);
  });

  it("verarbeitet ein Semikolon innerhalb eines gequoteten Feldes", () => {
    const csv = '"Name";"Notiz"\r\n"Max";"a;b;c"\r\n';
    expect(parseCsv(csv)).toEqual([{ Name: "Max", Notiz: "a;b;c" }]);
  });

  it("überspringt komplett leere Zeilen", () => {
    const csv = '"Name"\r\n"Max"\r\n""\r\n"Erika"\r\n';
    expect(parseCsv(csv)).toEqual([{ Name: "Max" }, { Name: "Erika" }]);
  });

  it("funktioniert ohne abschließenden Zeilenumbruch", () => {
    const csv = '"Name"\r\n"Max"';
    expect(parseCsv(csv)).toEqual([{ Name: "Max" }]);
  });

  it("leerer Text ergibt leere Liste", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
