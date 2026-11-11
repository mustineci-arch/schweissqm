import "./globals.css";
import Link from "next/link";
export const metadata = { title: "SchweißQM" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de"><body>
      <nav>
        <Link href="/">Dashboard</Link><Link href="/wps">WPS</Link><Link href="/wpqr">WPQR</Link>
        <Link href="/schweisser">Schweißer</Link><Link href="/deckung">Deckungsprüfung</Link>
      </nav>
      <main>{children}</main>
    </body></html>
  );
}
