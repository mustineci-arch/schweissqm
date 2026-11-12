import { describe, it, expect } from "vitest";
import { wpqrAusCsvZeilen } from "../lib/wpqr-import";

describe("wpqrAusCsvZeilen()", () => {
  it("wandelt eine CSV-Zeile in einen WPQR-Datensatz", () => {
    const rows = [{ "WPQR-Nr": "WPQR-1", Normausgabe: "2021", Verfahren: "141", Werkstoffgruppe: "1.1", "Prüfstückdicke": "10,5", "Prüfstückdurchmesser": "60,3", Position: "PA", Zusatzwerkstoff: "G3Si1", Berichtsdatum: "2026-01-01", "Prüfer": "Mustermann", "AP-Intervall [Monate]": "6" }];
    expect(wpqrAusCsvZeilen(rows)).toEqual([{
      wpqr_no: "WPQR-1", standard_edition: "2021", process: "141", material_group: "1.1",
      thickness_test: 10.5, diameter_test: 60.3, position: "PA", filler: "G3Si1",
      report_date: "2026-01-01", examiner: "Mustermann", ap_interval_months: 6,
    }]);
  });

  it("Zeilen ohne WPQR-Nr werden übersprungen", () => {
    expect(wpqrAusCsvZeilen([{ "WPQR-Nr": "" } as any])).toEqual([]);
  });

  it("leere optionale Felder werden null", () => {
    const [w] = wpqrAusCsvZeilen([{ "WPQR-Nr": "WPQR-2" } as any]);
    expect(w.standard_edition).toBeNull();
    expect(w.thickness_test).toBeNull();
    expect(w.ap_interval_months).toBeNull();
  });
});
