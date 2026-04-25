'use client';

// Interaktiver Budget-Simulator: pro Departement ein Schieberegler von -50 %
// bis +50 % — Bürger:innen erleben hands-on, wie schwer es ist, an einer
// Stelle zu kürzen, ohne die Gesamtsumme oder die Pro-Kopf-Belastung zu
// verschieben.
//
// State liegt rein im React-Komponenten-Tree (kein localStorage), damit
// jeder Besuch frisch startet — Simulator ist Lernspiel, kein Werkzeug für
// fortlaufende Analyse.

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fmtCHF, fmtMio } from '@/lib/search';
import { perCapitaCHF } from '@/lib/budget-context';

export interface SimulatorDept {
  id: string;
  name: string;
  /** Ausgangs-Aufwand in CHF (Summe aller Unter-Einheiten). */
  originalAufwand: number;
  /** Farbe aus city.theme.departmentPalette — visuelle Brücke zur Treemap. */
  color: string;
}

const SLIDER_MIN = -50;
const SLIDER_MAX = 50;
const SLIDER_STEP = 1;

export default function BudgetSimulator({
  departments,
  totalOriginal,
  population,
  jahr,
}: {
  departments: SimulatorDept[];
  totalOriginal: number;
  population: number | undefined;
  jahr: number | undefined;
}) {
  const t = useTranslations('Simulator');

  // deltas[depId] = Prozent-Anpassung. Default 0 % pro Departement. Setzen
  // wir bewusst nicht im useState-Initializer mit einem Map-Build — dann
  // bleibt der Code lesbarer und Tree-Shaking simpler.
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  const setDelta = (id: string, value: number) =>
    setDeltas((prev) => ({ ...prev, [id]: value }));

  const reset = () => setDeltas({});

  // Abgeleitete Werte: simulierter Aufwand pro Departement, Summe, Differenz.
  // useMemo, weil bei jedem Slider-Tick neu gerendert wird — die Reduce-
  // Schleife ist günstig, aber warum nicht.
  const { simulated, totalSimulated, deltaTotal } = useMemo(() => {
    let total = 0;
    const sim: { id: string; value: number; delta: number }[] = [];
    for (const d of departments) {
      const pct = deltas[d.id] ?? 0;
      const value = d.originalAufwand * (1 + pct / 100);
      total += value;
      sim.push({ id: d.id, value, delta: value - d.originalAufwand });
    }
    return { simulated: sim, totalSimulated: total, deltaTotal: total - totalOriginal };
  }, [deltas, departments, totalOriginal]);

  const deltaPerCapita = perCapitaCHF(Math.abs(deltaTotal), population);
  const deltaSign = deltaTotal === 0 ? 'zero' : deltaTotal > 0 ? 'pos' : 'neg';

  // Bar-Skala: längster ursprünglicher Wert bestimmt die Vollbreite, damit
  // alle Departemente proportional dargestellt werden.
  const maxAufwand = useMemo(
    () => departments.reduce((m, d) => Math.max(m, d.originalAufwand), 0),
    [departments],
  );

  if (departments.length === 0) {
    return (
      <main
        className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
        aria-label={t('ariaLabel')}
      >
        <h2 className="text-lg font-semibold m-0 mb-1">{t('title')}</h2>
        <p className="text-[13px] text-[var(--color-mute)]">{t('empty')}</p>
      </main>
    );
  }

  return (
    <main
      className="absolute top-14 inset-x-0 bottom-0 px-6 pt-4 pb-10 overflow-y-auto bg-[var(--color-bg)]"
      aria-label={t('ariaLabel')}
    >
      <h2 className="text-lg font-semibold m-0 mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-4 max-w-[80ch]">
        {t('intro')}
        {jahr ? <> · <em>{t('yearLabel', { jahr })}</em></> : null}
      </p>

      {/* Summary-Card mit den drei Kennzahlen + Reset.
          aria-live='polite': Screenreader bekommen die neue Differenz nach
          jeder Slider-Bewegung gemeldet, ohne dass der Fokus verloren geht. */}
      <section
        aria-live="polite"
        className="mb-5 p-4 rounded-lg bg-[var(--color-panel)] border border-[var(--color-line)] shadow flex flex-wrap items-center gap-x-6 gap-y-3 max-w-[80ch]"
      >
        <Metric label={t('originalLabel')} value={`${fmtMio(totalOriginal)} CHF`} />
        <Metric label={t('simulatedLabel')} value={`${fmtMio(totalSimulated)} CHF`} />
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-0.5">
            {t('deltaLabel')}
          </div>
          <div className={
            'text-base font-semibold tabular-nums ' +
            (deltaSign === 'pos' ? 'text-[#c0392b]'
             : deltaSign === 'neg' ? 'text-[#16a085]'
             : 'text-[var(--color-mute)]')
          }>
            {deltaSign === 'zero'
              ? t('balanced')
              : `${deltaSign === 'pos' ? '+' : '−'} ${fmtMio(Math.abs(deltaTotal))} CHF`}
          </div>
          {deltaPerCapita && deltaSign !== 'zero' && (
            <div className="text-[11px] text-[var(--color-mute)] mt-0.5">
              {t('deltaPerCapita', {
                value: `${deltaSign === 'pos' ? '+' : '−'} ${deltaPerCapita}`,
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          title={t('resetTitle')}
          disabled={Object.values(deltas).every((v) => v === 0)}
          className="ml-auto px-3 py-1.5 text-xs rounded border border-[var(--color-line)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('resetButton')}
        </button>
      </section>

      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2">
        {t('departmentsHeading')}
      </h3>

      <ol className="grid gap-2.5 list-none m-0 p-0 max-w-[80ch]">
        {departments.map((dep, i) => {
          const sim = simulated[i];
          const pct = deltas[dep.id] ?? 0;
          return (
            <SliderRow
              key={dep.id}
              dep={dep}
              pct={pct}
              simulatedValue={sim.value}
              deltaValue={sim.delta}
              maxAufwand={maxAufwand}
              perCapitaDelta={perCapitaCHF(Math.abs(sim.delta), population)}
              onChange={(v) => setDelta(dep.id, v)}
              labels={{
                slider: t('sliderLabel', { dep: dep.name }),
                noChange: t('noChange'),
                increase: t('increase'),
                decrease: t('decrease'),
                perCapitaUnit: t('perCapitaUnit'),
              }}
            />
          );
        })}
      </ol>

      <p className="text-[11px] text-[var(--color-mute)] italic mt-6 max-w-[80ch]">
        {t('disclaimer')}
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-0.5">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SliderRow({
  dep, pct, simulatedValue, deltaValue, maxAufwand, perCapitaDelta, onChange, labels,
}: {
  dep: SimulatorDept;
  pct: number;
  simulatedValue: number;
  deltaValue: number;
  maxAufwand: number;
  perCapitaDelta: string | null;
  onChange: (v: number) => void;
  labels: {
    slider: string;
    noChange: string;
    increase: string;
    decrease: string;
    perCapitaUnit: string;
  };
}) {
  const sign = deltaValue === 0 ? 'zero' : deltaValue > 0 ? 'pos' : 'neg';
  // Bar-Längen relativ zur grössten Original-Summe: Original = graue Spur,
  // simulierte Länge in Departement-Farbe darüber. So sieht man auf einen
  // Blick, ob ein Dep gewachsen oder geschrumpft ist (über/unter dem Marker).
  const origPct = (dep.originalAufwand / maxAufwand) * 100;
  const simPct  = (simulatedValue       / maxAufwand) * 100;

  return (
    <li className="rounded-lg bg-[var(--color-panel)] border border-[var(--color-line)] p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[13px] font-semibold">{dep.name}</span>
        <span className={
          'text-[12px] tabular-nums ' +
          (sign === 'pos' ? 'text-[#c0392b]'
           : sign === 'neg' ? 'text-[#16a085]'
           : 'text-[var(--color-mute)]')
        }>
          {sign === 'zero'
            ? labels.noChange
            : `${pct > 0 ? '+' : ''}${pct} %`}
        </span>
      </div>

      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={pct}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        aria-label={labels.slider}
        // Akzentfarbe färbt Daumen/Track im modernen Browser; sonst Default.
        style={{ accentColor: dep.color }}
        className="w-full"
      />

      {/* Mini-Vergleichs-Bar: Hintergrund = Original-Länge (grau), Vordergrund
          = simulierte Länge in Departement-Farbe. Tick zeigt die 100%-Marke
          (Original) — Bar darüber/darunter signalisiert visuell die Richtung. */}
      <div
        aria-hidden="true"
        className="relative h-2 mt-1.5 mb-2 rounded-full bg-[var(--color-bg)] overflow-hidden"
      >
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full"
          style={{ width: `${origPct}%`, background: 'rgba(0,0,0,.10)' }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full"
          style={{ width: `${simPct}%`, background: dep.color, opacity: 0.85 }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--color-ink)] opacity-60"
          style={{ left: `${origPct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-3 text-[11px] text-[var(--color-mute)]">
        <span className="tabular-nums">
          {fmtMio(dep.originalAufwand)} → <strong className="text-[var(--color-ink)]">{fmtMio(simulatedValue)}</strong> CHF
        </span>
        <span className="tabular-nums">
          {sign === 'zero'
            ? null
            : <>{sign === 'pos' ? '+' : '−'} {fmtCHF(Math.abs(deltaValue))}
                {perCapitaDelta ? ` (≈ ${perCapitaDelta} ${labels.perCapitaUnit})` : ''}</>}
        </span>
      </div>
    </li>
  );
}
