// Probe für die Privacy-Sanitisierung von Feedback-Kommentaren.
// Läuft über `node scripts/probe-feedback.mjs`. Spiegelt lib/feedback.ts
// (wie probe-search-miss.mjs lib/search-miss.ts spiegelt) — weicht es ab,
// schlägt die Probe an.

const FEEDBACK_COMMENT_MAX = 280;
const EMAIL_RE = /\S+@\S+\.\S+/g;
const DIGIT_RUN_RE = /\d[\d\s.\-/]{3,}\d/g;
const REDACTED = '[entfernt]';

function sanitizeFeedbackComment(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  s = s.replace(EMAIL_RE, REDACTED).replace(DIGIT_RUN_RE, REDACTED);
  if (s.length > FEEDBACK_COMMENT_MAX) s = s.slice(0, FEEDBACK_COMMENT_MAX).trimEnd() + '…';
  return s.trim() || null;
}

const cases = [
  // [input, expected]
  ['Die Zuständigkeit stimmt nicht.', 'Die Zuständigkeit stimmt nicht.'],
  ['Tempo 30 fehlt im Kreis 12', 'Tempo 30 fehlt im Kreis 12'], // kleine Zahlen bleiben
  ['Stand 2024 ist veraltet', 'Stand 2024 ist veraltet'],       // Jahreszahl bleibt
  // PII wird geschwärzt
  ['Bitte anrufen: 079 123 45 67', 'Bitte anrufen: [entfernt]'],
  ['Meine AHV 756.1234.5678.97', 'Meine AHV [entfernt]'],
  ['Kontakt hans.muster@example.com bitte', 'Kontakt [entfernt] bitte'],
  ['Fallnummer 1234567 prüfen', 'Fallnummer [entfernt] prüfen'],
  // leer / nicht-String
  ['   ', null],
  [42, null],
];

let pass = 0;
let fail = 0;
console.log('Eingabe                                  │ Ergebnis');
console.log('─────────────────────────────────────────┼──────────────────────────');
for (const [input, expected] of cases) {
  const got = sanitizeFeedbackComment(input);
  const ok = got === expected;
  if (ok) pass++;
  else fail++;
  const shown = typeof input === 'string' ? input.slice(0, 38) : String(input);
  console.log(`${ok ? '✓' : '✗'} ${shown.padEnd(38)} │ ${got === null ? '(null)' : got}${ok ? '' : `  ERWARTET: ${expected === null ? '(null)' : expected}`}`);
}
console.log('─────────────────────────────────────────┴──────────────────────────');
console.log(`${pass}/${pass + fail} Probes bestanden.`);
process.exit(fail ? 1 : 0);
