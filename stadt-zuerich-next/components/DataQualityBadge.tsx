// Wiederverwendbares Datenqualitäts-Badge.
//
// Zweck (Strategie: "keine unmarkierten Mockdaten", "Open by Default",
// "verantwortungsvoller Technologieeinsatz"): Jede Ansicht soll sichtbar
// machen, woher ihre Daten stammen und wie belastbar sie sind — damit
// nichts Fiktives wie offizielle Stadtinformation wirkt.
//
// Bewusst eine reine Präsentationskomponente ohne Hooks, damit sie sowohl
// in Server- als auch in Client-Komponenten eingesetzt werden kann.

export type DataQualityStatus =
  | 'demo' // illustrative/erfundene Daten, KEINE echte Stadtinformation
  | 'geschaetzt' // abgeleitet/geschätzt aus echten Quellen
  | 'publiziert' // direkt aus einer offiziellen Publikation
  | 'aggregiert' // aus mehreren echten Quellen zusammengeführt
  | 'live'; // Live-Abfrage einer externen API

const STATUS_META: Record<
  DataQualityStatus,
  { label: string; dot: string; ring: string }
> = {
  demo: { label: 'Demodaten', dot: '#f59e0b', ring: 'border-amber-300 bg-amber-50 text-amber-800' },
  geschaetzt: { label: 'Geschätzt', dot: '#6366f1', ring: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
  publiziert: { label: 'Publiziert', dot: '#16a34a', ring: 'border-green-200 bg-green-50 text-green-800' },
  aggregiert: { label: 'Aggregiert', dot: '#0ea5e9', ring: 'border-sky-200 bg-sky-50 text-sky-800' },
  live: { label: 'Live', dot: '#0ea5e9', ring: 'border-sky-200 bg-sky-50 text-sky-800' },
};

export default function DataQualityBadge({
  status,
  stand,
  quelle,
  hinweis,
  className = '',
}: {
  status: DataQualityStatus;
  /** Datenstand, z.B. "2026-04-20" */
  stand?: string;
  /** Kurze Quellenangabe, z.B. "data.stadt-zuerich.ch" */
  quelle?: string;
  /** Zusätzlicher Hinweis (erscheint als Tooltip + Untertext) */
  hinweis?: string;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const tooltipParts = [
    `Status: ${meta.label}`,
    stand ? `Stand: ${stand}` : null,
    quelle ? `Quelle: ${quelle}` : null,
    hinweis ?? null,
  ].filter(Boolean);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.ring} ${className}`}
      title={tooltipParts.join(' · ')}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      <span>{meta.label}</span>
      {stand && <span className="font-normal opacity-70">· {stand}</span>}
      {quelle && <span className="font-normal opacity-70">· {quelle}</span>}
    </span>
  );
}
