// Strategie-Anker der Bewertungs-Indikatoren: belegt, WARUM ein Indikator ein
// Indikator ist — durch Rückbindung an die übergeordneten Digitalisierungs- und
// Nutzendenorientierungs-Strategien von Bund und Stadt Zürich.
//
// Siehe docs/bewertung-strategiebezug.md (kanonische Fassung mit allen Quellen
// und Zitaten). Diese Tabelle ist reine Daten — keine Logik, keine Mutation,
// nur type-only Imports (testbar, serialisierbar).
//
// Ehrlichkeit: 'staerke' macht transparent, wie gut ein Indikator offiziell
// abgestützt ist. 'kein' = selbst gesetzter Nutzwert-Indikator ohne
// Strategie-Zitat (z.B. statusverfolgung). 'url' ist optional und wird — wie
// bei References — von Hand als verifizierter Deep-Link nachgetragen; bis dahin
// belegt der Anker über Dokument + Seite + wörtliches Zitat.

export type AnkerStaerke = 'direkt' | 'schwach' | 'kein';

export interface StrategieAnker {
  /** Quell-Tag, siehe docs/bewertung-strategiebezug.md (z.B. 'digistrat'). */
  dokument: string;
  /** Lesbarer Dokumenttitel fürs UI. */
  dokumentTitel: string;
  /** Seite im Dokument (für die Belegprüfung). */
  seite?: number;
  /** Wörtliches Zitat aus der Strategie (deutsch, wie source_quote). */
  zitat: string;
  /** Wie gut der Indikator offiziell abgestützt ist. */
  staerke: AnkerStaerke;
  /** Optionaler, von Hand verifizierter Deep-Link. */
  url?: string;
}

/** Indikator-Key (aus lib/bewertung.ts) → Strategie-Anker. Keys ohne Eintrag
 *  haben (noch) keinen hinterlegten Anker und werden im UI ohne Bezug
 *  gerendert. */
export const STRATEGIE_ANKER: Record<string, StrategieAnker> = {
  // --- DIGITALISIERUNG ---
  'online-antrag': {
    dokument: 'ds2040',
    dokumentTitel: 'Strategien Zürich 2040',
    seite: 31,
    zitat:
      'Städtische Angebote und Leistungen stehen der Bevölkerung und den Unternehmen online zur Verfügung.',
    staerke: 'direkt',
  },
  'digital-abschliessbar': {
    dokument: 'dch2026',
    dokumentTitel: 'Strategie «Digitale Schweiz 2026»',
    seite: 3,
    zitat:
      'Die Behörden bieten ihre Leistungen standardmässig digital (digital first), nutzerzentriert und barrierefrei an.',
    staerke: 'direkt',
  },
  medienbruchfrei: {
    dokument: 'digistrat',
    dokumentTitel: 'Digitalisierungsstrategie der Stadt Zürich',
    seite: 8,
    zitat:
      'Standards fördern die durchgängige Gestaltung von Prozessen und Datenflüssen.',
    staerke: 'direkt',
  },
  'online-bezahlung': {
    dokument: 'dch2026',
    dokumentTitel: 'Strategie «Digitale Schweiz 2026»',
    seite: 2,
    zitat:
      'Die Schweiz priorisiert digitale Angebote konsequent zum Nutzen aller Menschen (digital first).',
    staerke: 'schwach',
  },
  'once-only': {
    dokument: 'digistrat',
    dokumentTitel: 'Digitalisierungsstrategie der Stadt Zürich',
    seite: 13,
    zitat:
      'Weiter wird den Nutzer*innen ermöglicht, dass sie dieselben Dateneingaben nicht mehrfach tätigen müssen.',
    staerke: 'direkt',
  },
  'eid-moeglich': {
    dokument: 'dch2026',
    dokumentTitel: 'Strategie «Digitale Schweiz 2026»',
    seite: 3,
    zitat:
      'Die E-ID ist ein zentraler Baustein für die digitale Transformation der Schweiz. Ihre Nutzung ist freiwillig.',
    staerke: 'direkt',
  },
  // statusverfolgung: bewusst KEIN Anker — selbst gesetzter Nutzwert-Indikator.

  // --- NUTZENDENORIENTIERUNG ---
  'leichte-sprache': {
    dokument: 'servicestd',
    dokumentTitel: 'Service Standard (STRB 677/2025)',
    seite: 3,
    zitat:
      'Das Projektteam verwendet in allen relevanten Teilen leicht verständliche Sprache ohne Fachjargon.',
    staerke: 'direkt',
  },
  mehrsprachigkeit: {
    dokument: 'ds2040',
    dokumentTitel: 'Strategien Zürich 2040',
    seite: 27,
    zitat:
      'Der Zugang zu Angeboten und Leistungen der Stadt ist barriere- und diskriminierungsfrei.',
    staerke: 'schwach',
  },
  'voraussetzungen-genannt': {
    dokument: 'ds2040',
    dokumentTitel: 'Strategien Zürich 2040',
    seite: 27,
    zitat: 'Sie pflegt transparente und lösungsorientierte Prozesse.',
    staerke: 'direkt',
  },
  'fristen-kosten-verlinkt': {
    dokument: 'ds2040',
    dokumentTitel: 'Strategien Zürich 2040',
    seite: 27,
    zitat: 'Sie pflegt transparente und lösungsorientierte Prozesse.',
    staerke: 'direkt',
  },
  barrierefreiheit: {
    dokument: 'servicestd',
    dokumentTitel: 'Service Standard (STRB 677/2025)',
    seite: 3,
    zitat:
      'Das Projektteam stellt sicher, dass öffentliche, digitale Lösung barrierefrei sind (nach WCAG 2.1 Stufe AA).',
    staerke: 'direkt',
  },
  'nicht-digitaler-alternativweg': {
    dokument: 'ds2040',
    dokumentTitel: 'Strategien Zürich 2040',
    seite: 31,
    zitat:
      'Sie stellt dabei die Nutzer*innen stets ins Zentrum und berücksichtigt zugleich diejenigen, die nicht digital affin sind.',
    staerke: 'direkt',
  },
};

/** Anker zu einem Indikator-Key (oder undefined, wenn keiner hinterlegt). */
export function ankerFor(key: string): StrategieAnker | undefined {
  return STRATEGIE_ANKER[key];
}
