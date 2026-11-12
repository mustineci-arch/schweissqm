import { describe, it, expect } from "vitest";
import { schweisserAusCsvZeilen } from "../lib/schweisser-import";

describe("schweisserAusCsvZeilen()", () => {
  it("gruppiert mehrere Zertifikat-Zeilen zu einem Schweißer", () => {
    const rows = [
      { Name: "Max Mustermann", Zeichen: "MM1", Geburtsdatum: "1990-01-01", Arbeitgeber: "ACME", Aktiv: "ja", "Zert.-Nr.": "Z-1", Verfahren: "141", Bezeichnung: "141 T BW", Werkstoffgruppe: "1.1", "Dicke min": "3", "Dicke max": "10,2", "Durchmesser min": "25", "Durchmesser max": "", Positionen: "PA, PC", "Gültig bis": "2027-01-01", "Zuletzt bestätigt": "2026-01-01" },
      { Name: "Max Mustermann", Zeichen: "MM1", Geburtsdatum: "1990-01-01", Arbeitgeber: "ACME", Aktiv: "ja", "Zert.-Nr.": "Z-2", Verfahren: "135", Bezeichnung: "135 P FW", Werkstoffgruppe: "8.1", "Dicke min": "2", "Dicke max": "6", "Durchmesser min": "", "Durchmesser max": "", Positionen: "PB", "Gültig bis": "2026-06-01", "Zuletzt bestätigt": "" },
    ];
    const out = schweisserAusCsvZeilen(rows);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Max Mustermann");
    expect(out[0].certs).toHaveLength(2);
    expect(out[0].certs[0]).toMatchObject({ cert_no: "Z-1", process: "141", thickness_max: 10.2, diameter_min: 25, positions: ["PA", "PC"] });
    expect(out[0].certs[1].cert_no).toBe("Z-2");
  });

  it("Zertifikat-Zeile ohne Verfahren wird übersprungen (process ist in der DB Pflichtfeld)", () => {
    const rows = [{ Name: "Ohne Verfahren", "Zert.-Nr.": "Z-9", Bezeichnung: "141 T BW" } as any];
    const out = schweisserAusCsvZeilen(rows);
    expect(out).toHaveLength(1);
    expect(out[0].certs).toHaveLength(0);
  });

  it("Zeile ohne Zert.-Nr./Bezeichnung erzeugt Schweißer ohne Zertifikat", () => {
    const rows = [{ Name: "Erika Musterfrau", Zeichen: "", Geburtsdatum: "", Arbeitgeber: "", Aktiv: "ja", "Zert.-Nr.": "", Bezeichnung: "", Werkstoffgruppe: "", "Dicke min": "", "Dicke max": "", "Durchmesser min": "", "Durchmesser max": "", Positionen: "", "Gültig bis": "", "Zuletzt bestätigt": "" }];
    const out = schweisserAusCsvZeilen(rows);
    expect(out).toHaveLength(1);
    expect(out[0].certs).toHaveLength(0);
  });

  it("Aktiv=nein wird übernommen", () => {
    const rows = [{ Name: "X", Aktiv: "nein" } as any];
    expect(schweisserAusCsvZeilen(rows)[0].active).toBe(false);
  });

  it("Name-Gruppierung ist case-insensitiv", () => {
    const rows = [{ Name: "Max Mustermann" } as any, { Name: "max mustermann", "Zert.-Nr.": "Z-1", Verfahren: "141" } as any];
    const out = schweisserAusCsvZeilen(rows);
    expect(out).toHaveLength(1);
    expect(out[0].certs).toHaveLength(1);
  });

  it("Zeilen ohne Name werden übersprungen", () => {
    expect(schweisserAusCsvZeilen([{ Name: "" } as any])).toHaveLength(0);
  });
});
