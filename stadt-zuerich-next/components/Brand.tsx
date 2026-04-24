// Optionales Brand-Glyph für den Header. Liest `city.brand` aus der
// Config: ist kein Brand gesetzt, rendert die Komponente nichts und der
// Header bleibt rein textlich — so bleibt ein Logo-Slot ein städte-
// individuelles Detail, nicht ein harter Anspruch.
//
// Inline-SVG (statt <img src=".../zh-logo.svg">) damit das Glyph
// `currentColor` der Header-Schriftfarbe erbt. Im Light-Mode ist der
// Header dunkelblau mit weisser Schrift, im Dark-Mode hellblau mit
// weisser Schrift — inlining mit currentColor garantiert, dass das
// Logo in beiden Varianten sichtbar bleibt, ohne zwei SVG-Assets
// pflegen zu müssen.

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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={alt}
      className={className}
    >
      <line x1="12" y1="5.5" x2="6" y2="18" />
      <line x1="12" y1="5.5" x2="18" y2="18" />
      <circle cx="12" cy="5.5" r="2.25" fill="currentColor" />
      <circle cx="6"  cy="18"  r="2.25" fill="currentColor" />
      <circle cx="18" cy="18"  r="2.25" fill="currentColor" />
    </svg>
  );
}
