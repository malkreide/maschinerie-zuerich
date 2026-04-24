// Optionales Brand-Glyph für den Header. Liest `city.brand` aus der
// Config: ist kein Brand gesetzt, rendert die Komponente nichts und der
// Header bleibt rein textlich — so bleibt ein Logo-Slot ein städte-
// individuelles Detail, nicht ein harter Anspruch.
//
// Bewusst `<img>` statt inline-SVG: das SVG lebt unter public/, ist
// statisch und wird vom Browser gecacht. Und wir vermeiden einen
// Server-Read-Roundtrip beim Rendern des Headers.

'use client';

import { useLocale } from 'next-intl';
import { city } from '@/config/city.config';
import type { Locale } from '@/i18n/routing';

export default function Brand({ className = '' }: { className?: string }) {
  const locale = useLocale() as Locale;
  const brand = city.brand;
  if (!brand) return null;

  const alt = brand.logoAlt[locale] ?? brand.logoAlt.de;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoPath}
      alt={alt}
      width={24}
      height={24}
      className={className}
      // Decorative-ish: alt-Text ist präzise, aber für Screenreader,
      // die den Seiten-Titel eh vorlesen, ist das Glyph redundant.
      // Wir lassen role/aria, wie sie per default für <img> sind.
    />
  );
}
