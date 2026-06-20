// Gemeinsame Farbskala für den Online-Reifegrad eines Prozesses.
//
// Zweck: den vorhandenen kategorialen Render-Hint `reife.onlineReifegrad`
// (offline | teil-digital | digital | end-to-end) visuell einordnen — analog
// zur Datenherkunfts-Logik in DataQualityBadge. Es handelt sich um eine
// Klassifizierung der digitalen Reife, NICHT um einen bindenden Wert; die
// Kardinalregel ist damit nicht berührt.
//
// Sequenzielle Skala: «noch nicht digital» (warm) → «durchgängig digital»
// (grün). Dunkler Text auf hell getöntem Grund hält den WCAG-AA-Kontrast.

import type { OnlineReifegrad } from '@/types/prozess';

export const REIFEGRAD_ORDER: OnlineReifegrad[] = [
  'offline',
  'teil-digital',
  'digital',
  'end-to-end',
];

export const REIFEGRAD_META: Record<
  OnlineReifegrad,
  { dot: string; pill: string }
> = {
  offline: { dot: '#ef4444', pill: 'border-red-200 bg-red-50 text-red-800' },
  'teil-digital': { dot: '#f59e0b', pill: 'border-amber-200 bg-amber-50 text-amber-800' },
  digital: { dot: '#0ea5e9', pill: 'border-sky-200 bg-sky-50 text-sky-800' },
  'end-to-end': { dot: '#16a34a', pill: 'border-green-200 bg-green-50 text-green-800' },
};
