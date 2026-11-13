// Lesbare Bezeichnungen zu den Normkürzeln aus lib/iso9606.ts – reine Beschriftung, keine
// Normlogik (steuert keine Entscheidung). 1:1 aus der Referenz-App (iso9606.html) übernommen,
// damit Schweißer-Geltungsbereiche und der Decoder dieselben, geprüften Texte zeigen.

export const VERFAHREN_NAMEN: Record<string, string> = {
  "111": "Lichtbogenhandschweißen", "121": "UP-Schweißen mit Massivdrahtelektrode",
  "125": "UP-Schweißen mit Fülldrahtelektrode", "131": "MIG-Schweißen", "135": "MAG-Schweißen",
  "136": "MAG-Fülldraht", "138": "MAG-Metallpulverfülldraht", "141": "WIG-Schweißen",
  "142": "WIG ohne Zusatz", "143": "WIG mit Fülldraht", "145": "WIG mit reduzierendem Gas",
  "311": "Gasschweißen",
};

export const POSITION_NAMEN: Record<string, string> = {
  PA: "Wannenposition", PB: "Horizontalposition", PC: "Querposition", PD: "Horizontal-Überkopf",
  PE: "Überkopfposition", PF: "Steigposition", PG: "Fallposition", PH: "Rohr steigend",
  PJ: "Rohr fallend", HL045: "Rohr 45° steigend", JL045: "Rohr 45° fallend",
};

export const FM_NAMEN: Record<string, string> = {
  FM1: "unlegierte/Feinkornstähle", FM2: "hochfeste Stähle", FM3: "warmfeste Stähle Cr < 3,75 %",
  FM4: "warmfeste Stähle 3,75 ≤ Cr ≤ 12 %", FM5: "nichtrostende/hitzebeständige Stähle",
  FM6: "Nickel/Nickellegierungen",
};

export const SCHWEISSZUSATZART_NAMEN: Record<string, string> = {
  S: "Massivdraht/Stab", M: "Metallpulvergefüllt", B: "basisch / Fülldrahtgruppe B",
  R: "Fülldrahtgruppe R", PZ: "Fülldrahtgruppe P", V: "Fülldrahtgruppe V", W: "Fülldrahtgruppe W",
  Y: "Fülldrahtgruppe Y", Z: "Fülldrahtgruppe Z", C: "zellulose / Gruppe C",
};

export const SCHWEISSDETAIL_NAMEN: Record<string, string> = {
  ss_nb: "einseitig, ohne Badsicherung", ss_mb: "einseitig, mit Badsicherung", bs: "beidseitig",
  ss_gb: "einseitig, Gaswurzelschutz", ci: "einseitig, Einlageteil", ss_fb: "einseitig, Schweißpulverabstützung",
};

export const LAGENAUFBAU_NAMEN: Record<string, string> = { sl: "einlagig", ml: "mehrlagig" };

// CEN ISO/TR 15608 – Name und Beispielwerkstoffe je Gruppe (Schlüssel decken sich exakt mit
// WERKSTOFFGRUPPEN_QUALIFIKATION in lib/iso9606.ts).
export const WERKSTOFFGRUPPEN_NAMEN: Record<string, { name: string; beispiele: string }> = {
  "1.1": { name: "unlegierte Stähle ReH ≤ 460 MPa", beispiele: "S235JR bis S275J2+N" },
  "1.2": { name: "unlegierte Stähle / Feinkornstähle", beispiele: "S235JR bis S355K2, S275N bis S355N" },
  "1.3": { name: "unlegierte Stähle erweitert", beispiele: "S235JR bis S355K2, S460N/M" },
  "1.4": { name: "wetterfeste Stähle", beispiele: "S275J0W bis S355J2W" },
  "2.1": { name: "thermomechanisch behandelte Feinkornbaustähle", beispiele: "S420M bis S460M" },
  "2.2": { name: "hochfeste TM-Stähle", beispiele: "S500MC bis S700MC" },
  "3.1": { name: "vergütete Feinkornbaustähle", beispiele: "S460Q bis S690Q" },
  "3.2": { name: "hochfeste vergütete Feinkornbaustähle", beispiele: "S890Q bis S960Q" },
  "7.1": { name: "ferritische/martensitische nichtrostende Stähle", beispiele: "1.4003, 1.4512" },
  "8.1 ohne Mo": { name: "austenitische nichtrostende Stähle ohne Mo", beispiele: "1.4301, 1.4541, 1.4550" },
  "8.1": { name: "austenitische nichtrostende Stähle", beispiele: "1.4301, 1.4401, 1.4571" },
  "11": { name: "unlegierte Stähle C > 0,25 %", beispiele: "E295-E360, C35-C60" },
  "21": { name: "Reinaluminium", beispiele: "EN AW-1050A" },
  "22.2": { name: "AlMg-Legierungen", beispiele: "EN AW-5083" },
  "22.3": { name: "AlMg3", beispiele: "EN AW-5754" },
  "22.4": { name: "AlMg hochlegiert", beispiele: "EN AW-5083" },
  "23.1": { name: "AlMgSi", beispiele: "EN AW-6082" },
  "23.2": { name: "AlZnMg", beispiele: "EN AW-7020" },
  "24.1": { name: "AlSi-Guss", beispiele: "AlSi-Gusslegierungen" },
  "24.2": { name: "AlSiMg-Guss", beispiele: "AlSiMg-Gusslegierungen" },
  "71": { name: "Gusseisen Lamellengraphit", beispiele: "EN-GJL" },
  "72": { name: "Gusseisen Kugelgraphit", beispiele: "EN-GJS" },
  "73": { name: "Temperguss", beispiele: "EN-GJMW" },
};
