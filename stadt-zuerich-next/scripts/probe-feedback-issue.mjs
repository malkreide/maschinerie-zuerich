// Probe für den Feedback→Issue-Builder. Läuft über
// `node scripts/probe-feedback-issue.mjs`. Spiegelt lib/feedback-issue.ts.

const CATEGORY_LABEL = {
  zustaendigkeit: 'Zuständigkeit falsch',
  unklar: 'Information unklar',
  umstaendlich: 'Prozess umständlich',
  veraltet: 'Daten veraltet',
  barriere: 'Barriere',
  vorschlag: 'Verbesserungsvorschlag',
};

function isActionable(r) {
  return Boolean(r.category || (r.comment && r.comment.trim()));
}

function buildFeedbackIssue(r) {
  const catLabel = r.category ? CATEGORY_LABEL[r.category] : 'Feedback';
  const ctx = r.contextId ? ` · ${r.contextId}` : '';
  const title = `[Feedback] ${catLabel}${ctx}`;
  const quoted = r.comment ? r.comment.replace(/\r?\n/g, ' ') : null;
  const lines = [
    `**Kategorie:** ${catLabel}`,
    r.helpful !== undefined ? `**Hilfreich:** ${r.helpful ? 'ja' : 'nein'}` : null,
    r.contextId ? `**Kontext:** \`${r.contextId}\`` : null,
    r.locale ? `**Sprache:** ${r.locale}` : null,
    quoted ? `\n**Kommentar (serverseitig bereinigt):**\n> ${quoted}` : null,
    `\n_Automatisch aus App-Feedback erzeugt am ${r.ts}. Personendaten (E-Mails, längere Zahlen) wurden serverseitig geschwärzt. Bitte triagieren._`,
  ].filter(Boolean);
  const labels = ['feedback'];
  if (r.category) labels.push(`feedback:${r.category}`);
  if (r.locale) labels.push(`lang:${r.locale}`);
  return { title, body: lines.join('\n'), labels };
}

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}`); }
}

// 1) Reines 👍 ohne Detail → kein Issue.
check('Reines 👍 ist nicht aktionabel', isActionable({ helpful: true, ts: 't' }) === false);
// 2) Kategorie macht aktionabel.
check('Kategorie ist aktionabel', isActionable({ category: 'barriere', ts: 't' }) === true);
// 3) Kommentar macht aktionabel.
check('Kommentar ist aktionabel', isActionable({ comment: 'Text', ts: 't' }) === true);

// 4) Issue-Format: Titel, Labels (Kategorie + Sprache).
const issue = buildFeedbackIssue({
  helpful: false,
  category: 'zustaendigkeit',
  comment: 'Falsche Stelle\nzweite Zeile',
  contextId: 'FD-st',
  locale: 'de',
  ts: '2026-06-06T00:00:00Z',
});
check('Titel enthält Kategorie-Label + Kontext', issue.title === '[Feedback] Zuständigkeit falsch · FD-st');
check('Labels = feedback + feedback:kategorie + lang', JSON.stringify(issue.labels) === JSON.stringify(['feedback', 'feedback:zustaendigkeit', 'lang:de']));
check('Body enthält Hilfreich nein', issue.body.includes('**Hilfreich:** nein'));
check('Body enthält bereinigten Kommentar (einzeilig)', issue.body.includes('> Falsche Stelle zweite Zeile'));
check('Body weist auf Triage hin', issue.body.includes('Bitte triagieren'));

console.log(`\n${pass}/${pass + fail} Checks bestanden.`);
process.exit(fail ? 1 : 0);
