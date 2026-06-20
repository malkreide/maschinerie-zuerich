// Farbiges Badge für den Online-Reifegrad eines Prozesses.
//
// Bewusst eine reine Präsentationskomponente ohne Hooks — einsetzbar in
// Server- wie Client-Komponenten (vgl. DataQualityBadge). Die Farbe kommt
// aus der gemeinsamen Skala in lib/reifegrad, das Label wird übersetzt
// hereingereicht, damit die Komponente i18n-frei bleibt.

import type { OnlineReifegrad } from '@/types/prozess';
import { REIFEGRAD_META } from '@/lib/reifegrad';

export default function ReifegradBadge({
  reifegrad,
  label,
  prefix,
  className = '',
}: {
  reifegrad: OnlineReifegrad;
  /** Übersetztes Label des Reifegrads, z.B. "Durchgängig digital". */
  label: string;
  /** Optionaler Voranstellungstext, z.B. "Online-Reifegrad". */
  prefix?: string;
  className?: string;
}) {
  const meta = REIFEGRAD_META[reifegrad];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.pill} ${className}`}
      title={prefix ? `${prefix}: ${label}` : label}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      {prefix && <span className="font-normal opacity-70">{prefix}:</span>}
      <span>{label}</span>
    </span>
  );
}
