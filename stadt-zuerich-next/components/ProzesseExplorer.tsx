'use client';

// Interaktive Prozess-Übersicht mit Reifegrad-Filter.
//
// Inspiriert vom Muster «nach Kategorie filtern» (track-policy: Jurisdiktionen
// nach Haltung): hier filtert die Bevölkerung die Verfahren nach ihrem
// Online-Reifegrad und sieht auf einen Blick, was bereits durchgängig digital
// läuft und wo noch Behördengänge nötig sind.
//
// Die Komponente bekommt ausschliesslich bereits übersetzte, serialisierbare
// Daten vom Server-Component — keine i18n-Logik, keine Datenladung hier.

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { OnlineReifegrad } from '@/types/prozess';
import { REIFEGRAD_ORDER } from '@/lib/reifegrad';
import ReifegradBadge from '@/components/ReifegradBadge';

export interface ExplorerItem {
  city: string;
  id: string;
  pathname: string;
  title: string;
  description?: string;
  schritteText?: string;
  version: string;
  hochrisiko: boolean;
  hochrisikoLabel?: string;
  reifegrad?: OnlineReifegrad;
  reifegradLabel?: string;
}

export interface ExplorerGroup {
  city: string;
  cityLabel: string;
  items: ExplorerItem[];
}

export interface ExplorerLabels {
  filterHeading: string;
  alle: string;
  reifegradLabel: string;
  leer: string;
  /** Reifegrad-Key → übersetztes Label, für die Filter-Chips. */
  reifegrad: Record<OnlineReifegrad, string>;
}

type Selection = OnlineReifegrad | 'alle' | 'ohne';

export default function ProzesseExplorer({
  groups,
  labels,
}: {
  groups: ExplorerGroup[];
  labels: ExplorerLabels;
}) {
  const [selected, setSelected] = useState<Selection>('alle');

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Zähler je Reifegrad über alle Städte hinweg.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    let ohne = 0;
    for (const it of allItems) {
      if (it.reifegrad) c[it.reifegrad] = (c[it.reifegrad] ?? 0) + 1;
      else ohne++;
    }
    return { byGrad: c, ohne };
  }, [allItems]);

  const presentGrade = REIFEGRAD_ORDER.filter((g) => (counts.byGrad[g] ?? 0) > 0);

  const matches = (it: ExplorerItem) =>
    selected === 'alle' ||
    (selected === 'ohne' && !it.reifegrad) ||
    it.reifegrad === selected;

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0);

  const chipBase =
    'px-3 py-1 rounded-full border text-[13px] font-medium transition-colors cursor-pointer';
  const chipOn = 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-bg)]';
  const chipOff =
    'border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:bg-[var(--color-bg)]';

  return (
    <div>
      <fieldset className="mb-5 max-w-[70ch] border-0 p-0 m-0">
        <legend className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2 p-0">
          {labels.filterHeading}
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selected === 'alle'}
            onClick={() => setSelected('alle')}
            className={`${chipBase} ${selected === 'alle' ? chipOn : chipOff}`}
          >
            {labels.alle} ({allItems.length})
          </button>
          {presentGrade.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={selected === g}
              onClick={() => setSelected(g)}
              className={`${chipBase} ${selected === g ? chipOn : chipOff}`}
            >
              {labels.reifegrad[g]} ({counts.byGrad[g]})
            </button>
          ))}
        </div>
      </fieldset>

      {visibleGroups.length === 0 && (
        <p className="text-[var(--color-mute)] max-w-[70ch]">{labels.leer}</p>
      )}

      {visibleGroups.map((g) => (
        <section key={g.city} aria-labelledby={`city-${g.city}`} className="mb-8">
          <h3
            id={`city-${g.city}`}
            className="text-sm font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3"
          >
            {g.cityLabel}
          </h3>
          <ul className="grid gap-3 max-w-[70ch] list-none m-0 p-0">
            {g.items.map((e) => (
              <li
                key={e.pathname}
                className="bg-[var(--color-panel)] rounded-lg shadow border border-[var(--color-line)]"
              >
                <Link
                  href={{ pathname: e.pathname }}
                  className="block p-4 no-underline text-[var(--color-ink)] hover:bg-[var(--color-bg)] rounded-lg"
                >
                  <div className="font-semibold text-base mb-1 flex items-center gap-2 flex-wrap">
                    {e.title}
                    {e.hochrisiko && e.hochrisikoLabel && (
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-800">
                        <span aria-hidden="true">⚠ </span>
                        {e.hochrisikoLabel}
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-sm text-[var(--color-mute)] m-0">{e.description}</p>
                  )}
                  <div className="text-[11px] text-[var(--color-mute)] mt-2 flex flex-wrap items-center gap-2">
                    <span>v{e.version}</span>
                    {e.schritteText && (
                      <span className="px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
                        {e.schritteText}
                      </span>
                    )}
                    {e.reifegrad && e.reifegradLabel && (
                      <ReifegradBadge
                        reifegrad={e.reifegrad}
                        label={e.reifegradLabel}
                        prefix={labels.reifegradLabel}
                      />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
