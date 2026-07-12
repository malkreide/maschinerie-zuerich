// Prozess-Bewertung: server-gerenderte, BELEGTE Bewertung eines Prozesses
// entlang zweier Achsen (Digitalisierung / Nutzendenorientierung).
//
// Jeder Indikator trägt seine Evidenz aufklappbar bei sich: entweder
// «Berechnet» (deterministisch aus dem Graphen, mit Zähl-Werten) oder
// «Belegt» (wörtliches source_quote + Deep-Link, exakt wie eine Reference).
// «unbekannt» wird sichtbar als unbekannt gezeigt — nie als 0/nicht erfüllt.
//
// Der Score ist eine transparente, deterministische Funktion (Anteil
// erfüllter unter den bekannten, gezählten Indikatoren) — abgeleitete
// Metadaten, keine autoritative Aussage. Bewusst i18n-server-seitig
// aufgelöst und ohne Client-JS (native <details> für die Evidenz).
//
// AA-Kontrast wie beim Reifegrad-Badge: dunkler Text auf hell getöntem Grund.
//
// Die Hilfs-Komponenten stehen bewusst auf Modul-Ebene (nicht im Render-
// Body): React darf Komponenten nicht während des Renderns erzeugen.

import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import {
  buildBewertung,
  type IndikatorResult,
  type KategorieScore,
} from '@/lib/bewertung';
import { ankerFor } from '@/lib/bewertung-anker';
import { safeUrl } from '@/lib/safe-url';
import type { Prozess } from '@/types/prozess';

/** Gleiche String-basierte Translator-Signatur wie getT zurückgibt. */
type T = (key: string, values?: Record<string, string | number>) => string;

const STATUS_PILL: Record<IndikatorResult['status'], string> = {
  erfuellt: 'border-green-200 bg-green-50 text-green-800',
  'nicht-erfuellt': 'border-amber-200 bg-amber-50 text-amber-800',
  unbekannt: 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)]',
};

const AXIS_H = 'text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2';

/** Evidenz-Block eines Indikators (aufklappbar, ohne Client-JS). */
function Evidenz({ ind, t }: { ind: IndikatorResult; t: T }) {
  const ev = ind.evidenz;
  const anker = ankerFor(ind.key);

  const body =
    ev === null ? (
      <p className="text-[12px] text-[var(--color-mute)]">
        {t('bewertung.evidenz.unbekanntText')}
      </p>
    ) : ev.art === 'berechnet' ? (
      <p className="text-[12px] text-[var(--color-mute)]">
        <span className="font-medium text-[var(--color-ink)]">
          {t('bewertung.evidenz.berechnetLabel')}:
        </span>{' '}
        {t(`bewertung.evidenz.berechnet.${ind.key}`, { zahl: ev.zahl, von: ev.von ?? 0 })}
      </p>
    ) : (
      // Belegt — wörtliches Zitat + Deep-Link, wie bei References.
      <div className="text-[12px] text-[var(--color-mute)]">
        <span className="font-medium text-[var(--color-ink)]">
          {t('bewertung.evidenz.belegLabel')}:
        </span>{' '}
        {safeUrl(ev.url) ? (
          <a
            href={safeUrl(ev.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline decoration-dotted hover:decoration-solid"
          >
            {ev.url} ↗
          </a>
        ) : (
          <span>{ev.url}</span>
        )}
        {ev.unverifiziert && (
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {t('referenzUnverifiziert')}
          </span>
        )}
        <span className="ml-2">({t('retrieved', { date: ev.retrieved_at })})</span>
        {ev.quote && (
          <blockquote className="mt-0.5 border-l-2 border-[var(--color-line)] pl-2">
            «{ev.quote}»
          </blockquote>
        )}
      </div>
    );

  return (
    <div className="mt-1 space-y-1">
      {body}
      {/* Strategischer Bezug: belegt, WARUM der Indikator zählt (Strategie +
          Seite + wörtliches Zitat). Siehe docs/bewertung-strategiebezug.md. */}
      {anker && (
        <p className="text-[12px] text-[var(--color-mute)]">
          <span className="font-medium text-[var(--color-ink)]">
            {t('bewertung.ankerLabel')}:
          </span>{' '}
          {safeUrl(anker.url) ? (
            <a
              href={safeUrl(anker.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] underline decoration-dotted hover:decoration-solid"
            >
              {anker.dokumentTitel}
              {anker.seite ? `, S. ${anker.seite}` : ''} ↗
            </a>
          ) : (
            <span className="text-[var(--color-ink)]">
              {anker.dokumentTitel}
              {anker.seite ? `, S. ${anker.seite}` : ''}
            </span>
          )}
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)]">
            {t(`bewertung.ankerStaerke.${anker.staerke}`)}
          </span>
          <span className="block italic mt-0.5">«{anker.zitat}»</span>
        </p>
      )}
    </div>
  );
}

function IndikatorZeile({ ind, t }: { ind: IndikatorResult; t: T }) {
  // Informative Indikatoren (z.B. eid-noetig) zählen nicht in den Score und
  // werden neutral als belegte Tatsache (ja/nein) gezeigt — nicht als
  // erfüllt/nicht erfüllt. Unbelegte informative Indikatoren entfallen.
  if (!ind.gezaehlt) {
    if (ind.status === 'unbekannt') return null;
    const ja = ind.status === 'erfuellt';
    return (
      <li className="text-sm">
        <details className="group">
          <summary className="flex flex-wrap items-center gap-2 cursor-pointer list-none">
            <span className="text-[var(--color-ink)]">{t(`bewertung.indikator.${ind.key}`)}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)]">
              {ja ? t('bewertung.ja') : t('bewertung.nein')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-mute)]">
              {t('bewertung.informativ')}
            </span>
            <span className="text-[11px] text-[var(--color-accent)] underline group-open:hidden">
              {t('bewertung.evidenz.toggle')}
            </span>
          </summary>
          <Evidenz ind={ind} t={t} />
        </details>
      </li>
    );
  }

  return (
    <li className="text-sm">
      <details className="group">
        <summary className="flex flex-wrap items-center gap-2 cursor-pointer list-none">
          <span className="text-[var(--color-ink)]">{t(`bewertung.indikator.${ind.key}`)}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_PILL[ind.status]}`}>
            {t(`bewertung.status.${ind.status}`)}
          </span>
          <span className="text-[11px] text-[var(--color-accent)] underline group-open:hidden">
            {t('bewertung.evidenz.toggle')}
          </span>
        </summary>
        <Evidenz ind={ind} t={t} />
      </details>
    </li>
  );
}

function ScoreZeile({ score, t }: { score: KategorieScore; t: T }) {
  if (score.prozent === null) {
    return <span className="text-[var(--color-mute)]">{t('bewertung.keinScore')}</span>;
  }
  return (
    <span className="font-medium text-[var(--color-ink)]">
      {score.prozent}%{' '}
      <span className="font-normal text-[var(--color-mute)]">
        ({t('bewertung.scoreWert', { erfuellt: score.erfuellt, bekannt: score.bekannt })})
      </span>
    </span>
  );
}

export default function ProzessBewertung({
  prozess,
  locale,
}: {
  prozess: Prozess;
  locale: Locale;
}) {
  const t = getT(locale, 'Prozesse');
  const report = buildBewertung(prozess);

  const digital = report.indikatoren.filter((i) => i.kategorie === 'digitalisierung');
  const nutzend = report.indikatoren.filter((i) => i.kategorie === 'nutzendenorientierung');

  const gesamt = report.score.gesamt;
  const k = report.kennzahlen;

  return (
    <section
      aria-labelledby="bewertung-heading"
      className="max-w-[80ch] mb-5 bg-[var(--color-panel)] border border-[var(--color-line)] rounded-lg p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 id="bewertung-heading" className="text-base font-semibold m-0">
          {t('bewertung.heading')}
        </h3>
        <p className="text-sm m-0">
          <span className="text-[var(--color-mute)]">{t('bewertung.scoreLabel')}: </span>
          <ScoreZeile score={gesamt} t={t} />
        </p>
      </div>
      <p className="text-[12px] text-[var(--color-mute)] m-0 mb-3 max-w-[70ch]">
        {t('bewertung.intro')}
      </p>

      {gesamt.unbekannt > 0 && (
        <p className="text-[12px] px-2 py-1 mb-3 rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-mute)]">
          {t('bewertung.unbekanntHinweis', { count: gesamt.unbekannt })}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className={AXIS_H}>
            {t('bewertung.kategorie.digitalisierung')}
            {' · '}
            <ScoreZeile score={report.score.digitalisierung} t={t} />
          </h4>
          <ul className="list-none m-0 p-0 space-y-1.5">
            {digital.map((ind) => (
              <IndikatorZeile key={ind.key} ind={ind} t={t} />
            ))}
          </ul>
        </div>

        <div>
          <h4 className={AXIS_H}>
            {t('bewertung.kategorie.nutzendenorientierung')}
            {' · '}
            <ScoreZeile score={report.score.nutzendenorientierung} t={t} />
          </h4>
          <ul className="list-none m-0 p-0 space-y-1.5">
            {nutzend.map((ind) => (
              <IndikatorZeile key={ind.key} ind={ind} t={t} />
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
        <h4 className={AXIS_H}>{t('bewertung.kennzahlenHeading')}</h4>
        <ul className="flex flex-wrap gap-1.5 list-none m-0 p-0">
          {[
            t('bewertung.kennzahl.schritte', { count: k.schritte }),
            t('bewertung.kennzahl.akteurswechsel', { count: k.akteurswechsel }),
            t('bewertung.kennzahl.behoerden', { count: k.behoerden }),
            t('bewertung.kennzahl.pflichtdokumente', { count: k.pflichtdokumente }),
            t('bewertung.kennzahl.entscheidungspunkte', { count: k.entscheidungspunkte }),
          ].map((label, i) => (
            <li
              key={i}
              className="text-[12px] px-2 py-0.5 rounded-full border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)]"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
