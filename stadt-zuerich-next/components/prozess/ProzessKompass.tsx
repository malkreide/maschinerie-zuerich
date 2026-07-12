// Prozess-Kompass: server-gerenderte strukturelle Diagnose eines Prozesses
// entlang dreier Achsen (Zuständigkeit / Aufwand / Vereinfachung), im Geist
// des «Kita-Kompass» (Avenir Suisse), aber wiederverwendbar für JEDEN
// Prozess und ausschliesslich aus belegten Modelldaten.
//
// Self-contained: nimmt Prozess + Locale, leitet die Diagnose ab und löst
// i18n server-seitig auf. Gibt null zurück, wenn nichts zu zeigen ist.
//
// Bewusst nur App-Farbtokens + AA-konforme Akzentfarben (volle Deckkraft auf
// getöntem Grund) — vgl. die a11y-Lektion beim Reifegrad-Badge.

import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import { buildKompass, kompassHatInhalt } from '@/lib/kompass';
import { resolveI18n, type Prozess, type ProzessLocale } from '@/types/prozess';

export default function ProzessKompass({
  prozess,
  locale,
}: {
  prozess: Prozess;
  locale: Locale;
}) {
  const t = getT(locale, 'Prozesse');
  const loc = locale as ProzessLocale;
  const k = buildKompass(prozess);
  if (!kompassHatInhalt(k)) return null;

  const axisH = 'text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-1.5';
  const fact = 'text-sm text-[var(--color-ink)]';

  return (
    <section
      aria-labelledby="kompass-heading"
      className="max-w-[80ch] mb-5 bg-[var(--color-panel)] border border-[var(--color-line)] rounded-lg p-4"
    >
      <h3 id="kompass-heading" className="text-base font-semibold m-0 mb-1">
        {t('kompass.heading')}
      </h3>
      <p className="text-[12px] text-[var(--color-mute)] m-0 mb-3 max-w-[70ch]">
        {t('kompass.intro')}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Achse 1 — Zuständigkeit */}
        <div>
          <h4 className={axisH}>{t('kompass.zustaendigkeitHeading')}</h4>
          {k.behoerden.length > 0 ? (
            <ul className="list-none m-0 p-0 space-y-1">
              {k.behoerden.map((a) => (
                <li key={a.id} className={fact}>{resolveI18n(a.label, loc)}</li>
              ))}
            </ul>
          ) : (
            <p className={`${fact} text-[var(--color-mute)]`}>{t('kompass.keineBehoerde')}</p>
          )}
          {k.geteilteZustaendigkeit && (
            <p className="mt-2 text-[12px] px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-900">
              <strong className="font-semibold">{t('kompass.geteilt')}</strong>
              {' — '}{t('kompass.geteiltHint')}
            </p>
          )}
          {k.rekursinstanzen.length > 0 && (
            <p className="mt-2 text-[12px] text-[var(--color-mute)]">
              {t('kompass.rekurs')}: {k.rekursinstanzen.map((a) => resolveI18n(a.label, loc)).join(', ')}
            </p>
          )}
        </div>

        {/* Achse 2 — Aufwand für Bürger:innen */}
        <div>
          <h4 className={axisH}>{t('kompass.aufwandHeading')}</h4>
          <ul className="list-none m-0 p-0 space-y-1">
            {k.pflichtdokumente > 0 && (
              <li className={fact}>{t('kompass.pflichtdokumente', { count: k.pflichtdokumente })}</li>
            )}
            {k.entscheidungspunkte > 0 && (
              <li className={fact}>{t('kompass.entscheidungen', { count: k.entscheidungspunkte })}</li>
            )}
            {k.medienbrueche.length > 0 && (
              <li className={fact}>
                {t('medienbruecheHeading')}:{' '}
                {k.medienbrueche.map((m) => t(`medienbruch.${m}`)).join(', ')}
              </li>
            )}
          </ul>
          {k.pflichtdokumente === 0 && k.entscheidungspunkte === 0 && k.medienbrueche.length === 0 && (
            <p className={`${fact} text-[var(--color-mute)]`}>{t('kompass.keinAufwand')}</p>
          )}
        </div>

        {/* Achse 3 — Vereinfachungs-Potenzial */}
        <div>
          <h4 className={axisH}>{t('kompass.vereinfachungHeading')}</h4>
          {k.onceOnlyPotenzial && (
            <p className="text-[12px] px-2 py-1 rounded border border-green-200 bg-green-50 text-green-900 mb-2">
              <strong className="font-semibold">{t('onceOnlyHeading')}</strong>
            </p>
          )}
          {k.verbesserungenCount > 0 ? (
            <p className={fact}>{t('kompass.verbesserungen', { count: k.verbesserungenCount })}</p>
          ) : (
            !k.onceOnlyPotenzial && (
              <p className={`${fact} text-[var(--color-mute)]`}>{t('kompass.keinePotenziale')}</p>
            )
          )}
          {(k.onceOnlyPotenzial || k.verbesserungenCount > 0 || k.painPointsCount > 0) && (
            <p className="mt-2 text-[12px] text-[var(--color-mute)]">
              <a href="#reife-heading" className="underline">{t('kompass.detailsLink')}</a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
