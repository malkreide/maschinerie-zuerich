// Datum aus einer externen Quelle (z. B. Geschäfte des Gemeinderats) so
// anzeigen, wie die Quelle es nennt: je Sprache formatiert, ohne Umrechnung.
//
// - ISO-Datum («2026-11-10», auch mit Uhrzeit dahinter): Es zählt nur der
//   Kalendertag. `new Date('2026-11-10')` wäre Mitternacht UTC und zeigte
//   westlich von Greenwich den Vortag; eine Uhrzeit ohne Zone hinge von der
//   Zeitzone des Browsers ab. Deshalb den Tag herauslösen und in UTC
//   formatieren — das Ergebnis ist überall gleich.
// - Anderes Format: unverändert zurückgeben statt zu parsen.
//   `new Date('10.11.2026')` liest V8 als 11. Oktober.
// - Leer oder fehlend: null — die Oberfläche zeigt dann kein Datum.
//
// Monat ausgeschrieben («10. November 2026»): In allen fünf Sprachen
// eindeutig (en wäre numerisch M/T/J), und Leichte Sprache schreibt Daten
// mit Monatsnamen.

const ISO_TAG = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/;

export function formatQuellDatum(raw: unknown, intlLocale: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  const m = ISO_TAG.exec(s);
  if (!m) return s;

  const jahr = Number(m[1]);
  const monat = Number(m[2]);
  const tag = Number(m[3]);
  const datum = new Date(Date.UTC(jahr, monat - 1, tag));
  // Ungültige Kalendertage (2026-02-30) nicht stillschweigend verschieben.
  if (datum.getUTCFullYear() !== jahr || datum.getUTCMonth() !== monat - 1 || datum.getUTCDate() !== tag) {
    return s;
  }

  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(datum);
}
