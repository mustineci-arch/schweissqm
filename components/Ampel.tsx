import { ampel } from "@/lib/fristen";
export function FristAmpel({ datum }: { datum: string | null | undefined }) {
  const a = ampel(datum);
  return <span className={`ampel ${a.farbe}`}>{datum ?? "–"} · {a.text}</span>;
}
