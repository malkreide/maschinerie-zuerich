// Änderungsprotokoll der Prozessdaten (Ebene 4 der Ansicht «Belege &
// Herkunft», siehe docs/plan-belege-herkunft.md, Abschnitt 5.4).
//
// Liest die Commits auf main, die stadt-zuerich-next/data/prozesse berühren,
// und bildet sie auf schlanke Einträge ab. Nicht persistiert: Abruf zur
// Laufzeit mit ISR (300 s), gleicher Mechanismus wie die Roadmap
// (ROADMAP_GITHUB_REPO, optional ROADMAP_GITHUB_TOKEN).
//
// Harte Prinzipien:
//   1. Datensparsam: nur der Betreff (erste Zeile), Datum und Links. Kein
//      Commit-Body, keine Autor:innen oder Committer:innen, keine E-Mails.
//   2. Kardinalregel: nennt ein Betreff einen bindenden Wert («Gebühr auf …
//      Franken»), erscheint er NICHT — der Eintrag verweist nur auf den PR.
//      Die Erkennung kommt aus scripts/lib/binding-values.mjs und wird als
//      Funktion hereingereicht (wie istGesetzesfassung in lib/belege.ts).
//   3. Nichts raten: Prozesse werden nur zugeordnet, wenn ein Teil des Scopes
//      exakt eine bekannte Prozess-ID ist («fix(parkplatz, veranstaltung)»
//      → beide); sonst bleibt die Liste leer und die Seite zeigt den Bereich.
//
// Selbstständig gehalten (keine Imports), damit die Abbildung ohne
// Pfad-Alias testbar ist (tests/aenderungen.test.mjs, node --test mit
// Type-Stripping).

/** Pfad der Prozessdaten im Repo — Filter für die Commit-Liste. */
export const PROZESS_PFAD = 'stadt-zuerich-next/data/prozesse';

/** So viele Einträge zeigt /belege. */
export const PROTOKOLL_LAENGE = 20;

/** Conventional-Commit-Typen, die das Repo nutzt; alles andere: 'sonstiges'. */
const BEKANNTE_TYPEN = new Set([
  'feat', 'fix', 'i18n', 'docs', 'refactor', 'chore', 'perf', 'style', 'test', 'ci', 'build', 'revert',
]);

/** Anzeige-Kategorie (i18n-Schlüssel Belege.protokollArt.*). */
export type AenderungsArt = 'ergaenzung' | 'korrektur' | 'uebersetzung' | 'dokumentation' | 'wartung' | 'aenderung';

export interface AenderungsEintrag {
  /** 7-stelliger Commit-Hash */
  sha: string;
  /** ISO-Datum (UTC), an dem die Änderung auf main kam */
  datum: string;
  /** Conventional-Commit-Typ oder 'sonstiges' */
  typ: string;
  /** Scope, z. B. «kita-platz» oder «prozesse» */
  bereich: string | null;
  /** slugs «city/id» der Prozesse, die der Scope exakt nennt */
  prozesse: string[];
  /** Betreff ohne Typ, Scope und PR-Nummer; null, wenn er einen bindenden
   *  Wert nennt (Kardinalregel) */
  titel: string | null;
  /** PR-Nummer aus «(#123)» */
  pr: number | null;
  /** PR-Link, sonst Commit-Link */
  url: string;
}

/** Ausschnitt der GitHub-Antwort, der gelesen wird — bewusst ohne author. */
export interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string; committer?: { date?: string } | null };
  parents?: unknown[];
}

// typ(scope)!: … — auch zusammengesetzt «fix(a) + feat(b): …» (erster Teil zählt).
const KOPF_RE = /^([a-z0-9]+)(?:\(([^)]*)\))?!?(?:\s*\+\s*[a-z0-9]+(?:\([^)]*\))?!?)*:\s*(.+)$/i;
const PR_RE = /\s*\(#(\d+)\)\s*$/;

/** Anzeige-Kategorie eines Conventional-Commit-Typs. */
export function artVon(typ: string): AenderungsArt {
  switch (typ) {
    case 'feat':
      return 'ergaenzung';
    case 'fix':
      return 'korrektur';
    case 'i18n':
      return 'uebersetzung';
    case 'docs':
      return 'dokumentation';
    case 'sonstiges':
      return 'aenderung';
    default:
      return 'wartung';
  }
}

/** slugs zu den Teilen eines Scopes («parkplatz, veranstaltung»). Ein Teil
 *  zählt nur bei genau einem Treffer: eine ID kann in mehreren Städten
 *  vorkommen, dann wird nicht geraten. */
function prozesseFuerScope(scope: string | null, prozessSlugs: ReadonlySet<string>): string[] {
  if (!scope) return [];
  const out: string[] = [];
  for (const teil of scope.split(/\s*[,/+]\s*/)) {
    const treffer = [...prozessSlugs].filter((s) => s.split('/')[1] === teil);
    if (treffer.length === 1 && !out.includes(treffer[0])) out.push(treffer[0]);
  }
  return out;
}

/** Reine Abbildung eines Commits. null für Merge-Commits (mehrere Eltern):
 *  sie doppeln den Squash- bzw. PR-Commit und tragen keinen eigenen Betreff. */
export function mapCommitToEintrag(
  raw: RawCommit,
  opts: {
    repoUrl: string;
    prozessSlugs: ReadonlySet<string>;
    /** true, wenn der Text einen bindenden Wert nennt (findBindingValue) */
    istBindend: (text: string) => boolean;
  },
): AenderungsEintrag | null {
  if ((raw.parents?.length ?? 1) > 1) return null;
  const betreff = (raw.commit.message ?? '').split('\n')[0].trim();
  if (!betreff) return null;

  const prMatch = betreff.match(PR_RE);
  const pr = prMatch ? Number(prMatch[1]) : null;
  const ohnePr = prMatch ? betreff.slice(0, prMatch.index).trim() : betreff;

  const kopf = ohnePr.match(KOPF_RE);
  const roherTyp = kopf ? kopf[1].toLowerCase() : null;
  const typ = roherTyp && BEKANNTE_TYPEN.has(roherTyp) ? roherTyp : 'sonstiges';
  const bereich = kopf?.[2]?.trim() || null;
  const text = (kopf ? kopf[3] : ohnePr).trim();

  return {
    sha: raw.sha.slice(0, 7),
    datum: (raw.commit.committer?.date ?? '').slice(0, 10),
    typ,
    bereich,
    prozesse: prozesseFuerScope(bereich, opts.prozessSlugs),
    titel: opts.istBindend(text) ? null : text,
    pr,
    url: pr !== null ? `${opts.repoUrl}/pull/${pr}` : raw.html_url,
  };
}

/** Holt die letzten Änderungen live von GitHub. null, wenn die API nicht
 *  antwortet (Rate-Limit, Netz): die Seite zeigt dann einen Hinweis statt
 *  einer leeren Liste. Der Token wird nur als Header gesendet, nie geloggt. */
export async function fetchAenderungen(opts: {
  prozessSlugs: ReadonlySet<string>;
  istBindend: (text: string) => boolean;
  limit?: number;
}): Promise<AenderungsEintrag[] | null> {
  const repo = process.env.ROADMAP_GITHUB_REPO ?? 'malkreide/maschinerie-zuerich';
  const token = process.env.ROADMAP_GITHUB_TOKEN;
  const limit = opts.limit ?? PROTOKOLL_LAENGE;
  try {
    const res = await fetch(
      // Etwas mehr holen als gezeigt wird: Merge-Commits fallen weg.
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(PROZESS_PFAD)}&sha=main&per_page=${Math.min(100, limit + 10)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'maschinerie-zuerich-belege',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const commits = (await res.json()) as unknown;
    if (!Array.isArray(commits)) return null;
    const repoUrl = `https://github.com/${repo}`;
    return commits
      .map((c) => mapCommitToEintrag(c as RawCommit, { repoUrl, prozessSlugs: opts.prozessSlugs, istBindend: opts.istBindend }))
      .filter((e): e is AenderungsEintrag => e !== null)
      .slice(0, limit);
  } catch {
    return null;
  }
}
