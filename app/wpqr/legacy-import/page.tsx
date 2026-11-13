import Link from "next/link";
import { LegacyImportUpload } from "@/components/LegacyImportUpload";

export default function LegacyImport() {
  return (
    <>
      <p className="sub"><Link href="/wpqr">← Zur WPQR-Liste</Link></p>
      <h1>Daten der Desktop-App importieren (JSON)</h1>
      <p className="sub">
        schweisser.json, gespeicherte_protokolle/*.json, autosave.json – mehrere auf einmal möglich.
        Schweißer werden per Name zugeordnet (vorhandene ergänzt, nicht dupliziert), Zertifikate per
        Bezeichnung aktualisiert statt dupliziert. Protokolle werden, wenn möglich, per WPQR-Nr. und
        Schweißer-Name zugeordnet – nicht gefundene Zuordnungen werden in der Bemerkung vermerkt.
      </p>
      <LegacyImportUpload />
    </>
  );
}
