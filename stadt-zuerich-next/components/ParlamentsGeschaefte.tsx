'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { safeUrl } from '@/lib/safe-url';
import { formatQuellDatum } from '@/lib/quell-datum';
import { city } from '@/config/city.config';
import type { Locale } from '@/i18n/routing';

type Geschaeft = {
  id: string;
  titel: string;
  geschaeftsart: string;
  /** Wie die Quelle es liefert; leer, wenn sie kein Datum nennt. */
  datum: string;
  link: string;
};

export default function ParlamentsGeschaefte({ departmentName }: { departmentName: string }) {
  const t = useTranslations('RIS');
  // Intl-Locale wie <html lang> (ls → de-CH, fr → fr-CH …): «ls» allein
  // kennt Intl nicht und fiele auf eine Fremdsprache zurück.
  const locale = useLocale();
  const intlLocale = city.htmlLang?.[locale as Locale] ?? locale;
  const [items, setItems] = useState<Geschaeft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(false);

    fetch(`/api/ris?q=${encodeURIComponent(departmentName)}`)
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [departmentName]);

  if (loading) {
    return (
      <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
        <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2 m-0">
          {t('heading')}
        </h4>
        <div className="text-[var(--color-mute)] text-xs animate-pulse">
          {t('loading')}
        </div>
      </div>
    );
  }

  const officialSearchLink = (
    <div className="mt-2 text-right">
      <a
        href={`https://www.gemeinderat-zuerich.ch/geschaefte?q=${encodeURIComponent(departmentName)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-[var(--color-accent)] hover:underline"
      >
        {t('viewAll')}
      </a>
    </div>
  );

  if (error) {
    return (
      <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
        <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2 m-0">
          {t('heading')}
        </h4>
        <div className="text-red-500 text-xs">{t('error')}</div>
        {officialSearchLink}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
        <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2 m-0">
          {t('heading')}
        </h4>
        <div className="text-[var(--color-mute)] text-xs">{t('noData')}</div>
        {officialSearchLink}
      </div>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
      <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-mute)] mb-2 m-0">
        {t('heading')}
      </h4>
      <ul className="space-y-2 m-0 p-0 list-none">
        {items.map(item => {
          // item.link stammt aus extern geparster RIS-XML — nur mit
          // sicherer URL verlinken (lib/safe-url.ts), sonst reiner Text.
          const href = safeUrl(item.link);
          const datum = formatQuellDatum(item.datum, intlLocale);
          const body = (
            <>
              <div className="font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)] leading-tight mb-0.5">
                {item.titel}
              </div>
              <div className="text-[10px] text-[var(--color-mute)] flex justify-between">
                <span>{item.geschaeftsart}</span>
                {datum && <span>{datum}</span>}
              </div>
            </>
          );
          return (
            <li key={item.id} className="text-xs">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block hover:bg-[var(--color-bg)] p-1.5 -mx-1.5 rounded transition-colors no-underline"
                >
                  {body}
                </a>
              ) : (
                <div className="p-1.5 -mx-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {officialSearchLink}
    </div>
  );
}
