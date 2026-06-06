// Probe für das Roadmap-Mapping. Läuft über `node scripts/probe-roadmap.mjs`.
// Spiegelt mapIssueToItem aus lib/roadmap.ts.

const STATUS_LABEL_MAP = {
  'status:eingegangen': 'eingegangen',
  'status:geprueft': 'geprueft',
  'status:in-umsetzung': 'in-umsetzung',
  'status:umgesetzt': 'umgesetzt',
};
const INCLUDE_LABEL_RE = /^(feedback|strategie|roadmap)/;

function labelNames(issue) {
  return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
}

function mapIssueToItem(issue) {
  if (issue.pull_request) return null;
  const labels = labelNames(issue);
  if (!labels.some((l) => INCLUDE_LABEL_RE.test(l))) return null;
  let status;
  for (const l of labels) if (STATUS_LABEL_MAP[l]) status = STATUS_LABEL_MAP[l];
  if (!status) status = issue.state === 'closed' ? 'umgesetzt' : 'eingegangen';
  const category = labels.find((l) => l.startsWith('feedback:'))?.slice('feedback:'.length);
  const lang = labels.find((l) => l.startsWith('lang:'))?.slice('lang:'.length);
  return { number: issue.number, title: issue.title, url: issue.html_url, status, category, lang, createdAt: issue.created_at };
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name}`); } }

// PRs werden ausgeschlossen.
check('PR ausgeschlossen', mapIssueToItem({ number: 1, pull_request: {}, labels: ['feedback'] }) === null);
// Nicht-kuratierte Issues (kein feedback/strategie/roadmap-Label) erscheinen nicht.
check('Internes Issue ohne kuratiertes Label ausgeschlossen', mapIssueToItem({ number: 2, labels: ['bug'], state: 'open' }) === null);
// Feedback offen ohne Status → eingegangen.
check('Offen ohne Status → eingegangen', mapIssueToItem({ number: 3, labels: ['feedback', 'feedback:barriere', 'lang:de'], state: 'open' })?.status === 'eingegangen');
// Geschlossen ohne Status → umgesetzt.
check('Geschlossen ohne Status → umgesetzt', mapIssueToItem({ number: 4, labels: ['strategie:a11y'], state: 'closed' })?.status === 'umgesetzt');
// Status-Label gewinnt über state.
check('status:in-umsetzung gewinnt', mapIssueToItem({ number: 5, labels: ['feedback', 'status:in-umsetzung'], state: 'open' })?.status === 'in-umsetzung');
// Kategorie + Sprache werden extrahiert.
const it = mapIssueToItem({ number: 6, labels: ['feedback', 'feedback:unklar', 'lang:fr'], state: 'open', title: 'T', html_url: 'u', created_at: 'c' });
check('Kategorie extrahiert', it?.category === 'unklar');
check('Sprache extrahiert', it?.lang === 'fr');
// Nur unbedenkliche Felder — kein body/author.
check('Keine Personendaten-Felder', it && !('body' in it) && !('user' in it) && !('author' in it));

console.log(`\n${pass}/${pass + fail} Checks bestanden.`);
process.exit(fail ? 1 : 0);
