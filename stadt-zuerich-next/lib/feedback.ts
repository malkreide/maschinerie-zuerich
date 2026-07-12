// Privacy-by-design-Helfer für Micro-Feedback.
//
// Analog zu lib/search-miss.ts: reine, testbare Funktionen, die alles
// herausfiltern, was nach Personendaten aussieht, bevor Feedback gespeichert
// oder an einen Webhook geschickt wird. Siehe scripts/probe-feedback.mjs.

export const FEEDBACK_CATEGORIES = [
  'zustaendigkeit', // Zuständigkeit falsch
  'unklar',         // Information unklar
  'umstaendlich',   // Prozess ist umständlich
  'veraltet',       // Daten wirken veraltet
  'barriere',       // Barriere
  'vorschlag',      // Verbesserungsvorschlag
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_COMMENT_MAX = 280;

// E-Mail-Adressen und längere Ziffernfolgen (Telefon, AHV, Fall-/Aktennummern)
// werden im Kommentar geschwärzt — Jahreszahlen ("2024") und kleine Zahlen
// ("Tempo 30", "Kreis 12") bleiben erhalten.
const EMAIL_RE = /\S+@\S+\.\S+/g;
const DIGIT_RUN_RE = /\d[\d\s.\-/]{3,}\d/g;
const REDACTED = '[entfernt]';

export function isFeedbackCategory(v: unknown): v is FeedbackCategory {
  return typeof v === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(v);
}

/**
 * Bereinigt einen freien Feedback-Kommentar: schwärzt vermutliche
 * Personendaten und kappt die Länge. Gibt `null` zurück, wenn nach der
 * Bereinigung nichts Sinnvolles übrig bleibt.
 */
export function sanitizeFeedbackComment(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  s = s.replace(EMAIL_RE, REDACTED).replace(DIGIT_RUN_RE, REDACTED);
  if (s.length > FEEDBACK_COMMENT_MAX) {
    s = s.slice(0, FEEDBACK_COMMENT_MAX).trimEnd() + '…';
  }
  return s.trim() || null;
}
