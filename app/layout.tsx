import "./globals.css";
import Link from "next/link";
export const metadata = { title: "SchweißQM" };

const gruppen: { titel: string; links: [string, string][] }[] = [
  { titel: "Übersicht", links: [["/", "Ablauf-Übersicht"]] },
  { titel: "I · Erfassen", links: [["/projekte", "Projekte"]] },
  { titel: "II · Schweißen", links: [["/auftrag", "Auftrag"], ["/wps", "WPS"], ["/wpqr", "WPQR"], ["/schweisser", "Schweißer"], ["/naehte", "Nähte"]] },
  { titel: "III · Nachweisen", links: [["/deckung", "Deckungsprüfung"], ["/fristen", "Fristen"]] },
  { titel: "Verwaltung", links: [["/admin", "Benutzer & Rollen"]] },
];

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de"><body>
      <div className="shell">
        <aside>
          <div className="brand">Schweiß<span>QM</span></div>
          {gruppen.map((g) => (
            <div key={g.titel}><h4>{g.titel}</h4>{g.links.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}</div>
          ))}
        </aside>
        <main>{children}</main>
      </div>
    </body></html>
  );
}
