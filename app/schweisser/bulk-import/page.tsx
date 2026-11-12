import Link from "next/link";
import { BulkZertifikatImport } from "@/components/BulkZertifikatImport";

export default function BulkImport() {
  return (
    <>
      <p className="sub"><Link href="/schweisser">← Zur Liste</Link></p>
      <h1>Zertifikate einlesen (Ordner / mehrere PDFs)</h1>
      <p className="sub">
        Ordner oder einzelne PDFs wählen. Jede Seite wird ausgelesen, der passende Name wird vorgeschlagen
        und alles vor dem Speichern zur Prüfung angezeigt. Schweißer werden per Name zugeordnet (vorhandene
        ergänzt, nicht dupliziert), Zertifikate per Bezeichnung aktualisiert statt dupliziert.
      </p>
      <BulkZertifikatImport />
    </>
  );
}
