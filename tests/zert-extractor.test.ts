import { describe, it, expect } from "vitest";
import { auswerten, zuFormular, type Zertifikat } from "../lib/zert-extractor";

describe("Zertifikat-Extractor: DVS-Format (reine Regex-Auswertung, ohne Wortpositionen)", () => {
  const text = [
    "Schweißer-Prüfungsbescheinigung",
    "Prüf-Nr.: DVS-2024-001",
    "Bezeichnung: ISO 9606-1 135 P BW 1.1",
    "Name des Schweißers: Max Mustermann",
    "Geburtsdatum: 01.02.1990",
    "Geburtsort: Hamburg",
    "Arbeitgeber: IRM Anlagenbau GmbH",
    "WPS-Bezug: WPS-100",
    "Auftrags-Nr.: 12345",
    "Prüfberichts-Nr.: PB-99",
    "Prüfgrundlage: ISO 9606-1",
    "Schweißprozess: 135",
    "Nahtart: BW",
    "Werkstoffgruppe: 1.1",
    "Schweißzusatzgruppe: S",
    "Schweißposition: PA",
    "Rohraußendurchmesser: 60.3",
    "Schweißgutdicke (mm): 5",
    "Werkstoff: S235JR",
    "Zusatz / Filler: G3Si1",
    "Datum des Schweißens: 15.03.2024",
    "Gültig bis: 15.03.2026",
  ].join("\n");

  const d = auswerten([], text, "test.pdf", 1, 1);

  it("erkennt DVS-Format (kein Fehler)", () => expect(d._error).toBe(""));
  it("Zertifikat-Nr.", () => expect(d.zertifikat_nr).toBe("DVS-2024-001"));
  it("Name", () => expect(d.name).toBe("Max Mustermann"));
  it("Geburtsdatum wird ins ISO-Format konvertiert", () => expect(d.geburtsdatum).toBe("1990-02-01"));
  it("Geburtsort", () => expect(d.geburtsort).toBe("Hamburg"));
  it("Arbeitgeber", () => expect(d.arbeitgeber).toBe("IRM Anlagenbau GmbH"));
  it("WPS-Bezug", () => expect(d.wps_bezug).toBe("WPS-100"));
  it("Auftrags-Nr.", () => expect(d.auftrags_nr).toBe("12345"));
  it("Prüfberichts-Nr.", () => expect(d.pruefberichts_nr).toBe("PB-99"));
  it("Schweißprozess", () => expect(d.schweissprozess).toBe("135"));
  it("Nahtart", () => expect(d.nahtart).toBe("BW"));
  it("Werkstoffgruppe", () => expect(d.werkstoffgruppe).toBe("1.1"));
  it("Schweißposition", () => expect(d.schweissposition).toBe("PA"));
  it("Rohraußendurchmesser", () => expect(d.rohraussendurchmesser).toBe("60.3"));
  it("Schweißgutdicke", () => expect(d.schweissgutdicke_s).toBe("5"));
  it("Werkstoff (nicht mit Werkstoffgruppe verwechselt)", () => expect(d.werkstoff).toBe("S235JR"));
  it("Zusatz/Filler", () => expect(d.zusatz_filler).toBe("G3Si1"));
  it("Datum des Schweißens konvertiert", () => expect(d.datum_schweissen).toBe("2024-03-15"));
  it("Gültig bis konvertiert", () => expect(d.gueltig_bis).toBe("2026-03-15"));
});

describe("Zertifikat-Extractor: TÜV Thüringen (Format-Erkennung + einfache Felder)", () => {
  const text = [
    "WelderCert",
    "Certificate No. TH-2024-55",
    "ISO 9606-1 141 T BW FM1 S t5,0 D60,3 PH",
    "Welder's name: John Smith",
    "9 Employer: Acme Corp",
    "Date of welding: 2024-03-15",
    "Validity until: 2026-03-15",
    "Test report no.: TR-77",
  ].join("\n");

  const d = auswerten([], text, "test.pdf", 1, 1);

  it("kein Fehler", () => expect(d._error).toBe(""));
  it("Zertifikat-Nr.", () => expect(d.zertifikat_nr).toBe("TH-2024-55"));
  it("Bezeichnung aus ISO-9606-1-Zeile", () => expect(d.bezeichnung).toContain("ISO 9606-1 141 T BW"));
  it("Datum des Schweißens", () => expect(d.datum_schweissen).toBe("2024-03-15"));
  it("Gültig bis", () => expect(d.gueltig_bis).toBe("2026-03-15"));
  it("Prüfberichts-Nr.", () => expect(d.pruefberichts_nr).toBe("TR-77"));
});

describe("zuFormular(): Zertifikat-Rohfelder auf Formularfelder abbilden", () => {
  const basis: Zertifikat = {
    _datei: "x", _seite: 1, _pages: 1, _ocr_used: false, _error: "",
    zertifikat_nr: "", bezeichnung: "", name: "", geburtsdatum: "", geburtsort: "", arbeitgeber: "",
    wps_bezug: "", auftrags_nr: "", pruefberichts_nr: "", pruefgrundlage: "",
    schweissprozess: "135", geltungsbereich_prozess: "", nahtart: "BW", nahtart_geltung: "",
    werkstoffgruppe: "1.1", werkstoffgruppe_geltung: "", schweisszusatzgruppe: "",
    schweissposition: "PA", schweissposition_geltung: "", rohraussendurchmesser: "", rohraussendurchmesser_g: "",
    schweissgutdicke_s: "5", schweissgutdicke_s_g: "", werkstoffdicke_t: "", werkstoffdicke_t_g: "",
    werkstoff: "", zusatz_filler: "", datum_schweissen: "", gueltig_bis: "2026-03-15",
    verlaengerung_nach: "", fachkunde: "", ergaenzende_kehlnaht: "",
  };

  it("BW-Blech: Verfahren, Werkstoffgruppe, Nahtart, Dicke aus schweissgutdicke_s, Produktform P (kein Durchmesser)", () => {
    const f = zuFormular(basis);
    expect(f).toMatchObject({ process: "135", mg: "1.1", nahtart: "BW", produkt: "P", s_oder_t: 5, position_roh: "PA", bis: "2026-03-15" });
  });

  it("FW-Rohr: Dicke aus werkstoffdicke_t, Produktform T (Durchmesser vorhanden)", () => {
    const f = zuFormular({ ...basis, nahtart: "FW", schweissgutdicke_s: "", werkstoffdicke_t: "8,0", rohraussendurchmesser: "60,3" });
    expect(f.nahtart).toBe("FW");
    expect(f.s_oder_t).toBe(8);
    expect(f.durchmesser).toBe(60.3);
    expect(f.produkt).toBe("T");
  });

  it("Name wird übernommen, wenn vorhanden", () => {
    expect(zuFormular({ ...basis, name: "Erika Musterfrau" }).name).toBe("Erika Musterfrau");
  });

  it("Position erkennt HL045/JL045", () => {
    expect(zuFormular({ ...basis, schweissposition: "HL045" }).position_roh).toBe("HL045");
  });

  it("ungültiges/leeres Gültigkeitsdatum wird nicht übernommen", () => {
    expect(zuFormular({ ...basis, gueltig_bis: "" }).bis).toBeUndefined();
  });

  it("übernimmt die eigene Bezeichnung des Zertifikats, wenn vorhanden", () => {
    expect(zuFormular({ ...basis, bezeichnung: "ISO 9606-1 141 T BW FM1 S s3,6 D60,3 PH" }).bezeichnung)
      .toBe("ISO 9606-1 141 T BW FM1 S s3,6 D60,3 PH");
  });
});

describe("zuFormular(): vom Zertifikat selbst ausgewiesener Geltungsbereich hat Vorrang vor Neuberechnung aus dem Prüfstück", () => {
  const basis: Zertifikat = {
    _datei: "x", _seite: 1, _pages: 1, _ocr_used: false, _error: "",
    zertifikat_nr: "", bezeichnung: "", name: "", geburtsdatum: "", geburtsort: "", arbeitgeber: "",
    wps_bezug: "", auftrags_nr: "", pruefberichts_nr: "", pruefgrundlage: "",
    schweissprozess: "141", geltungsbereich_prozess: "", nahtart: "BW", nahtart_geltung: "",
    werkstoffgruppe: "1.1", werkstoffgruppe_geltung: "", schweisszusatzgruppe: "",
    schweissposition: "PH", schweissposition_geltung: "", rohraussendurchmesser: "60,3", rohraussendurchmesser_g: "",
    schweissgutdicke_s: "3,6", schweissgutdicke_s_g: "", werkstoffdicke_t: "", werkstoffdicke_t_g: "",
    werkstoff: "", zusatz_filler: "", datum_schweissen: "", gueltig_bis: "2026-03-15",
    verlaengerung_nach: "", fachkunde: "", ergaenzende_kehlnaht: "",
  };

  it("kombiniertes Zertifikat (zwei Prüfstücke): Geltungsbereich aus den _g-Feldern statt Neuberechnung aus nur einem Prüfstück", () => {
    const f = zuFormular({
      ...basis,
      schweissgutdicke_s_g: "1,50 - 12,00",
      rohraussendurchmesser_g: "≥ 13,50",
      schweissposition_geltung: "Alle außer / All except PG (F)",
    });
    expect(f.thickness_min).toBe(1.5);
    expect(f.thickness_max).toBe(12);
    expect(f.diameter_min).toBe(13.5);
    expect(f.diameter_max).toBeUndefined();
    expect(f.positions).toEqual(["PA", "PB", "PC", "PD", "PE", "PF", "PH", "PJ", "HL045", "JL045"]);
  });

  it("einzelne Positionsliste im Geltungsbereich wird übernommen", () => {
    const f = zuFormular({ ...basis, schweissposition_geltung: "PA, PC, PF" });
    expect(f.positions).toEqual(["PA", "PC", "PF"]);
  });

  it("ohne ausgewiesenen Geltungsbereich bleibt thickness_min/max/positions leer (Normrechner im UI übernimmt)", () => {
    const f = zuFormular(basis);
    expect(f.thickness_min).toBeUndefined();
    expect(f.diameter_min).toBeUndefined();
    expect(f.positions).toBeUndefined();
  });

  it("'-' als Geltungsbereich-Wert gilt als nicht ausgewiesen", () => {
    const f = zuFormular({ ...basis, schweissgutdicke_s_g: "-", schweissposition_geltung: "-" });
    expect(f.thickness_min).toBeUndefined();
    expect(f.positions).toBeUndefined();
  });

  it("einzelner Zahlenwert im Geltungsbereich (min === max)", () => {
    const f = zuFormular({ ...basis, rohraussendurchmesser_g: "60,3" });
    expect(f.diameter_min).toBe(60.3);
    expect(f.diameter_max).toBe(60.3);
  });
});
