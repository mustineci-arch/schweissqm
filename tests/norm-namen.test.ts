import { describe, it, expect } from "vitest";
import { WERKSTOFFGRUPPEN_QUALIFIKATION, FM_SCOPE, ZUSATZART_SCOPE, DETAIL_SCOPE, LAGENAUFBAU_SCOPE } from "../lib/iso9606";
import { WERKSTOFFGRUPPEN_NAMEN, FM_NAMEN, SCHWEISSZUSATZART_NAMEN, SCHWEISSDETAIL_NAMEN, LAGENAUFBAU_NAMEN } from "../lib/norm-namen";

describe("Namens-Wörterbücher decken exakt dieselben Schlüssel ab wie die Qualifikationstabellen", () => {
  it("Werkstoffgruppen", () => {
    expect(Object.keys(WERKSTOFFGRUPPEN_NAMEN).sort()).toEqual(Object.keys(WERKSTOFFGRUPPEN_QUALIFIKATION).sort());
  });
  it("FM-Gruppen", () => {
    expect(Object.keys(FM_NAMEN).sort()).toEqual(Object.keys(FM_SCOPE).sort());
  });
  it("Schweißzusatzarten", () => {
    expect(Object.keys(SCHWEISSZUSATZART_NAMEN).sort()).toEqual(Object.keys(ZUSATZART_SCOPE).sort());
  });
  it("Schweißdetails", () => {
    expect(Object.keys(SCHWEISSDETAIL_NAMEN).sort()).toEqual(Object.keys(DETAIL_SCOPE).sort());
  });
  it("Lagenaufbau", () => {
    expect(Object.keys(LAGENAUFBAU_NAMEN).sort()).toEqual(Object.keys(LAGENAUFBAU_SCOPE).sort());
  });
});
