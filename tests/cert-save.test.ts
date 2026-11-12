import { describe, it, expect } from "vitest";
import { zertifikatFelder } from "../lib/cert-save";

describe("zertifikatFelder()", () => {
  it("manuelle Werte (tmin/tmax/dmin/dmax/positions) haben Vorrang vor dem Normrechner", () => {
    const f = zertifikatFelder({
      process: "141", nahtart: "BW", produkt: "T", sOderT: 5, durchmesser: 60, positionRoh: "PH",
      tmin: 1, tmax: 20, dmin: 10, dmax: null, positions: ["PA"],
    });
    expect(f.thickness_min).toBe(1);
    expect(f.thickness_max).toBe(20);
    expect(f.diameter_min).toBe(10);
    expect(f.positions).toEqual(["PA"]);
  });

  it("ohne manuelle Werte berechnet der Normrechner aus Prüfstückdicke/-durchmesser/-position", () => {
    const f = zertifikatFelder({ process: "141", nahtart: "BW", produkt: "T", sOderT: 5, durchmesser: 60, positionRoh: "PA" });
    expect(f.thickness_min).not.toBeNull();
    expect(f.diameter_min).not.toBeNull();
    expect(f.positions).not.toBeNull();
  });

  it("ohne Nahtart/Prüfstückdaten bleiben Dicke/Durchmesser/Position null", () => {
    const f = zertifikatFelder({ process: "141" });
    expect(f.thickness_min).toBeNull();
    expect(f.diameter_min).toBeNull();
    expect(f.positions).toBeNull();
  });

  it("übernimmt Zertifikat-Metadaten (cert_no, bezeichnung, valid_until)", () => {
    const f = zertifikatFelder({ process: "141", cert_no: "Z-1", bezeichnung: "141 T BW", bis: "2027-01-01" });
    expect(f.cert_no).toBe("Z-1");
    expect(f.bezeichnung).toBe("141 T BW");
    expect(f.valid_until).toBe("2027-01-01");
  });
});
