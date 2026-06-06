// Liest die öffentlichen GitHub-Issues und bildet sie auf eine
// datenschutzschonende, statusbasierte Roadmap ab.
//
// Privacy: Es werden NUR unbedenkliche Felder übernommen (Titel, Status,
// Kategorie/Sprache aus Labels, Link, Datum). KEINE Autor:innen, KEINE
// Issue-Bodies (die könnten — obwohl serverseitig bereinigt — Freitext
// enthalten). Kuratierung: nur Issues mit feedback*/strategie:*/roadmap-Label
// erscheinen, damit keine internen Issues durchsickern.
//
// Die reine Abbildung (mapIssueToItem) ist von fetch getrennt und damit
// testbar (siehe scripts/probe-roadmap.mjs).

export type RoadmapStatus = 'eingegangen' | 'geprueft' | 'in-umsetzung' | 'umgesetzt';

export const ROADMAP_STATUS_ORDER: RoadmapStatus[] = [
  'eingegangen',
  'geprueft',
  'in-umsetzung',
  'umgesetzt',
];

export interface RoadmapItem {
  number: number;
  title: string;
  url: string;
  status: RoadmapStatus;
  category?: string; // aus feedback:<cat>
  lang?: string;     // aus lang:<x>
  createdAt: string;
}

const STATUS_LABEL_MAP: Record<string, RoadmapStatus> = {
  'status:eingegangen': 'eingegangen',
  'status:geprueft': 'geprueft',
  'status:in-umsetzung': 'in-umsetzung',
  'status:umgesetzt': 'umgesetzt',
};

// Nur kuratierte Issues erscheinen öffentlich.
const INCLUDE_LABEL_RE = /^(feedback|strategie|roadmap)/;

interface RawLabel { name?: string }
interface RawIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  pull_request?: unknown;
  labels?: (string | RawLabel)[];
}

function labelNames(issue: RawIssue): string[] {
  return (issue.labels ?? [])
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((l): l is string => Boolean(l));
}

export function mapIssueToItem(issue: RawIssue): RoadmapItem | null {
  if (issue.pull_request) return null; // PRs ausschliessen
  const labels = labelNames(issue);
  if (!labels.some((l) => INCLUDE_LABEL_RE.test(l))) return null; // Kuratierung

  let status: RoadmapStatus | undefined;
  for (const l of labels) if (STATUS_LABEL_MAP[l]) status = STATUS_LABEL_MAP[l];
  if (!status) status = issue.state === 'closed' ? 'umgesetzt' : 'eingegangen';

  const category = labels.find((l) => l.startsWith('feedback:'))?.slice('feedback:'.length);
  const lang = labels.find((l) => l.startsWith('lang:'))?.slice('lang:'.length);

  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    status,
    category,
    lang,
    createdAt: issue.created_at,
  };
}

/** Holt die Roadmap live von GitHub. Gibt `null` zurück, wenn die API nicht
 *  erreichbar ist (die Seite zeigt dann einen Fallback). */
export async function fetchRoadmap(): Promise<RoadmapItem[] | null> {
  const repo = process.env.ROADMAP_GITHUB_REPO ?? 'malkreide/maschinerie-zuerich';
  const token = process.env.ROADMAP_GITHUB_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=all&per_page=100&sort=updated`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'maschinerie-zuerich-roadmap',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // ISR: alle 5 Minuten neu, damit die Seite nicht bei jedem Request
        // ein GitHub-Rate-Limit-Budget verbraucht.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const issues = (await res.json()) as unknown;
    if (!Array.isArray(issues)) return null;
    return issues
      .map((i) => mapIssueToItem(i as RawIssue))
      .filter((x): x is RoadmapItem => x !== null);
  } catch {
    return null;
  }
}
