// Probe für die Privacy-Normalisierung von Nulltreffer-Suchbegriffen.
// Läuft über `node scripts/probe-search-miss.mjs` und prüft, dass
// potenziell personenbezogene Eingaben verworfen werden.
//
// Die Logik spiegelt lib/search-miss.ts (wie probe-search.mjs die Suchlogik
// spiegelt). Weicht etwas voneinander ab, schlägt diese Probe an und erinnert
// daran, beide synchron zu halten.

const MISS_MIN_LEN = 3;
const MISS_MAX_LEN = 60;
const MAX_DIGITS = 5;

function normalizeMissQuery(raw) {
  if (typeof raw !== 'string') return null;
  let q = raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  q = q.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  if (q.length < MISS_MIN_LEN || q.length > MISS_MAX_LEN) return null;
  if (q.includes('@')) return null;
  if ((q.match(/\d/g)?.length ?? 0) >= MAX_DIGITS) return null;
  return q;
}

const cases = [
  // [input, expected]
  ['Velounterstand', 'velounterstand'],
  ['  Hund   anmelden ', 'hund anmelden'],
  ['«Pass»', 'pass'],
  ['ELTERNZEIT', 'elternzeit'],
  // wenige Ziffern bleiben erhalten (Alltagsbegriffe)
  ['Tempo 30', 'tempo 30'],
  // verworfen: zu kurz
  ['ab', null],
  // verworfen: E-Mail
  ['hans@example.com', null],
  // verworfen: Telefonnummer
  ['0791234567', null],
  // verworfen: AHV-Nummer
  ['756.1234.5678.97', null],
  // verworfen: zu lang (vermutlich eingefügte PII)
  ['x'.repeat(61), null],
  // Nicht-String
  [42, null],
];

let pass = 0;
let fail = 0;
console.log('Eingabe                          │ Ergebnis');
console.log('─────────────────────────────────┼─────────────────────────');
for (const [input, expected] of cases) {
  const got = normalizeMissQuery(input);
  const ok = got === expected;
  if (ok) pass++;
  else fail++;
  const shown = typeof input === 'string' ? input.slice(0, 30) : String(input);
  console.log(`${ok ? '✓' : '✗'} ${shown.padEnd(30)} │ ${got === null ? '(verworfen)' : got}${ok ? '' : `  ERWARTET: ${expected === null ? '(verworfen)' : expected}`}`);
}
console.log('─────────────────────────────────┴─────────────────────────');
console.log(`${pass}/${pass + fail} Probes bestanden.`);
process.exit(fail ? 1 : 0);
