// Überführt ein (bereits bereinigtes) Feedback in einen GitHub-Issue-Entwurf:
// Titel, Body und Auto-Labels (Kategorie, Sprache). Reine Funktionen, damit
// die Formatierung unabhängig testbar ist (siehe scripts/probe-feedback-issue.mjs).
//
// Der eigentliche API-Call lebt in app/api/feedback/route.ts und ist opt-in
// (nur wenn FEEDBACK_GITHUB_TOKEN + FEEDBACK_GITHUB_REPO gesetzt sind).

import type { FeedbackCategory } from './feedback';

export interface FeedbackRecord {
  helpful?: boolean;
  category?: FeedbackCategory;
  comment?: string | null;
  contextId?: string;
  locale?: string;
  ts: string;
}

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  zustaendigkeit: 'Zuständigkeit falsch',
  unklar: 'Information unklar',
  umstaendlich: 'Prozess umständlich',
  veraltet: 'Daten veraltet',
  barriere: 'Barriere',
  vorschlag: 'Verbesserungsvorschlag',
};

// Nur inhaltlich verwertbares Feedback wird zu einem Issue. Reines 👍/👎 ohne
// Kategorie und ohne Kommentar erzeugt KEIN Issue (sonst verrauscht der Backlog).
export function isActionable(r: FeedbackRecord): boolean {
  return Boolean(r.category || (r.comment && r.comment.trim()));
}

export function buildFeedbackIssue(r: FeedbackRecord): {
  title: string;
  body: string;
  labels: string[];
} {
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
  ].filter((l): l is string => Boolean(l));

  const labels = ['feedback'];
  if (r.category) labels.push(`feedback:${r.category}`);
  if (r.locale) labels.push(`lang:${r.locale}`);

  return { title, body: lines.join('\n'), labels };
}
