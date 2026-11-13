import { describe, it, expect } from "vitest";
import {
  istLegacySchweisserListe, legacySchweisserZertifikate, prozessAusBezeichnung, legacySchweisserPlan,
  legacyProtokollArt, legacyProtokollPlan, findeWpqrId, findeWelderId,
} from "../lib/legacy-import";

describe("istLegacySchweisserListe()", () => {
  it("erkennt ein Array von Personen mit name", () => {
    expect(istLegacySchweisserListe([{ name: "Max" }, { name: "Erika" }])).toBe(true);
  });
  it("lehnt ein Array ohne durchgängiges name-Feld ab", () => {
    expect(istLegacySchweisserListe([{ name: "Max" }, { foo: 1 }])).toBe(false);
  });
  it("lehnt ein leeres Array und Nicht-Arrays ab", () => {
    expect(istLegacySchweisserListe([])).toBe(false);
    expect(istLegacySchweisserListe({ name: "Max" })).toBe(false);
  });
});

describe("legacySchweisserZertifikate()", () => {
  it("gibt das zertifikate-Array zurück, wenn vorhanden", () => {
    const certs = [{ zertifikat_nr: "Z-1" }];
    expect(legacySchweisserZertifikate({ name: "Max", zertifikate: certs })).toBe(certs);
  });
  it("baut aus der flachen Form ein einzelnes Zertifikat", () => {
    expect(legacySchweisserZertifikate({ name: "Max", zertifikat_nr: "Z-1", zertifikat_bezeichnung: "141 T BW" }))
      .toEqual([{ zertifikat_nr: "Z-1", zertifikat_bezeichnung: "141 T BW", gueltig_bis: undefined, verlaengerung: undefined }]);
  });
  it("ohne jegliches Zertifikatfeld: leeres Array", () => {
    expect(legacySchweisserZertifikate({ name: "Max" })).toEqual([]);
  });
});

describe("prozessAusBezeichnung()", () => {
  it("liest das Verfahren aus einer Standard-Bezeichnung", () => {
    expect(prozessAusBezeichnung("ISO 9606-1 141 T BW FM1 S s3,6 D60,3 PH")).toBe("141");
  });
  it("ohne erkennbares Muster: null", () => {
    expect(prozessAusBezeichnung("irgendein Text")).toBeNull();
    expect(prozessAusBezeichnung(undefined)).toBeNull();
  });
});

describe("legacySchweisserPlan()", () => {
  it("baut den Einfüge-Plan und überspringt Zertifikate ohne erkennbares Verfahren", () => {
    const plan = legacySchweisserPlan([
      { name: "Max Mustermann", zeichen: "MM1", geburtsdatum: "01.02.1990", zertifikate: [
        { zertifikat_nr: "Z-1", zertifikat_bezeichnung: "ISO 9606-1 141 T BW FM1 S s3,6 D60,3 PH", gueltig_bis: "15.03.2027" },
        { zertifikat_nr: "Z-2", zertifikat_bezeichnung: "kein erkennbares Muster" },
      ] },
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ name: "Max Mustermann", stamp: "MM1", birthdate: "1990-02-01" });
    expect(plan[0].certs).toHaveLength(1);
    expect(plan[0].certs[0]).toMatchObject({ cert_no: "Z-1", process: "141", valid_until: "2027-03-15" });
  });

  it("Personen ohne Namen werden übersprungen", () => {
    expect(legacySchweisserPlan([{ name: "" }, { name: "  " }])).toHaveLength(0);
  });
});

describe("legacyProtokollArt()", () => {
  it("erkennt ein gespeichertes Protokoll (_name)", () => {
    expect(legacyProtokollArt({ _name: "Protokoll 1" })).toBe("protokoll");
  });
  it("erkennt einen Formular-Entwurf (autosave)", () => {
    expect(legacyProtokollArt({ _gespeichert_um: "2026-01-01" })).toBe("entwurf");
    expect(legacyProtokollArt({ kennzeichnung: "Rohr 1" })).toBe("entwurf");
  });
  it("erkennt einstellungen.json (nur lokale Pfade) und ignoriert es", () => {
    expect(legacyProtokollArt({ excel_pfad: "C:\\x.xlsx" })).toBe("einstellungen");
  });
  it("alles andere ist unbekannt", () => {
    expect(legacyProtokollArt({ foo: 1 })).toBe("unbekannt");
  });
});

describe("legacyProtokollPlan()", () => {
  const schweisserBatch = [{ name: "Max Mustermann" }, { name: "Erika Musterfrau" }];

  it("löst sw_idx gegen die mitgelieferte Schweißer-Liste auf", () => {
    const plan = legacyProtokollPlan({ m_wpqr_nr: "WPQR-1", sw_idx: 1, datum_schweissung: "01.06.2026", kennzeichnung: "Rohr A" }, schweisserBatch);
    expect(plan.welder_name_gesucht).toBe("Erika Musterfrau");
    expect(plan.wpqr_no_gesucht).toBe("WPQR-1");
    expect(plan.ap_datum).toBe("2026-06-01");
    expect(plan.pruefstueck).toBe("Rohr A");
  });

  it("ohne mitgelieferte Schweißer-Liste bleibt der Name unaufgelöst", () => {
    const plan = legacyProtokollPlan({ sw_idx: 0 }, null);
    expect(plan.welder_name_gesucht).toBeNull();
  });

  it("ohne Datum wird das heutige Datum als Fallback verwendet", () => {
    const plan = legacyProtokollPlan({}, null);
    expect(plan.ap_datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sammelt die Freitextfelder in weitere_angaben", () => {
    const plan = legacyProtokollPlan({ wps_nr: "WPS-1", schutzgas: "Ar" }, null);
    expect(plan.weitere_angaben).toContain("wps_nr: WPS-1");
    expect(plan.weitere_angaben).toContain("schutzgas: Ar");
  });
});

describe("findeWpqrId() / findeWelderId()", () => {
  it("findet per normalisierter WPQR-Nr (Groß-/Kleinschreibung, Leerzeichen egal)", () => {
    expect(findeWpqrId("WPQR 1", [{ id: "a", wpqr_no: "wpqr1" }])).toBe("a");
    expect(findeWpqrId("WPQR-1", [{ id: "a", wpqr_no: "wpqr-2" }])).toBeNull();
  });
  it("findet Schweißer per Name (case-insensitiv)", () => {
    expect(findeWelderId("max mustermann", [{ id: "a", name: "Max Mustermann" }])).toBe("a");
  });
  it("ohne Treffer: null", () => {
    expect(findeWpqrId("X", [])).toBeNull();
    expect(findeWelderId(null, [{ id: "a", name: "Max" }])).toBeNull();
  });
});
