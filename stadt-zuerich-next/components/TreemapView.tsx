'use client';

import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy';
import { scaleOrdinal } from 'd3-scale';
import { Link } from '@/i18n/navigation';
import type { StadtData, Department, Unit } from '@/types/stadt';
import { fmtMio, fmtNumber } from '@/lib/search';
import { computeTotalAufwand, perCapitaCHF, budgetSharePercent } from '@/lib/budget-context';
import { city } from '@/config/city.config';

type Datum = {
  name: string;
  id?: string;
  depId?: string;
  value?: number;
  netto?: number;
  fte?: number;
  konflikt?: boolean;
  isFocus?: boolean;
  children?: Datum[];
  kurz?: string;
};

// Departement-Palette kommt aus der Stadt-Konfiguration — andere Städte
// haben andere Corporate-Palettes, ohne Code-Änderung im Treemap.
const DEP_COLORS = city.theme.departmentPalette;

export default function TreemapView({
  data,
  rootName,
}: {
  data: StadtData;
  /** Label für den Root-Knoten des Treemaps (z. B. 'Stadt Zürich').
   *  Wird vom Server-Component aus city.config.name[locale] befüllt. */
  rootName: string;
}) {
  const t = useTranslations('Treemap');
  const hostRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; node: Datum; total: number;
  } | null>(null);
  const [mobileSelected, setMobileSelected] = useState<{ node: Datum; total: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!hostRef.current) return;
    const update = () => {
      if (!hostRef.current) return;
      setSize({ w: hostRef.current.clientWidth, h: hostRef.current.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, []);

  const colorOf = scaleOrdinal<string, string>()
    .domain(data.departments.map((d) => d.id))
    .range(DEP_COLORS);

  const { tree, hiddenDepartments } = buildHierarchy(data, focus, rootName);
  const root = computeLayout(tree, size.w, size.h, focus !== null);

  // Stadt-weiter Gesamtaufwand als stabile Bezugsgrösse für die Anteils-
  // Anzeige im Tooltip. Wichtig: aus den Originaldaten, nicht aus dem
  // (bei Fokus auf ein Departement reduzierten) `root` — sonst würde die
  // "Anteil Gesamtbudget"-Zahl beim Hineinzoomen kollabieren.
  const cityTotalAufwand = useMemo(() => computeTotalAufwand(data), [data]);
  const population = city.population;

  const sampleJahr = data.units.find((u) => u.budget?.jahr)?.budget?.jahr ?? 2024;

  // Leer-Zustand: wenn in den Daten überhaupt kein Amt positive Aufwände hat,
  // rendern wir statt eines leeren SVG einen Info-Block mit Handlungsangeboten.
  const isEmpty = !tree.children || tree.children.length === 0;

  return (
    <main className="absolute top-14 inset-x-0 bottom-0 p-4 pb-10 overflow-hidden"
          aria-label={t('ariaLabel')}>
      <h2 className="text-lg font-semibold m-0 mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-3">
        {t('intro', { jahr: sampleJahr })}
        {root && <strong>{t('total', { sum: fmtMio(root.value ?? 0) })}</strong>}
        {/* Pro-Kopf-Einordnung der Gesamtsumme — macht aus "1.4 Mrd CHF"
            (für die meisten abstrakt) eine greifbare Pro-Kopf-Zahl. */}
        {root && (() => {
          const pc = perCapitaCHF(root.value ?? 0, population);
          return pc ? <em>{t('totalPerCapita', { value: pc })}</em> : null;
        })()}
      </p>
      {isEmpty && (
        <div
          role="status"
          className="max-w-[70ch] rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-5"
        >
          <h3 className="text-base font-semibold mb-2">{t('emptyTitle')}</h3>
          <p className="text-[13px] text-[var(--color-mute)] m-0">
            {t.rich('emptyBody', {
              listLink: (chunks) => (
                <Link href="/liste" className="text-[var(--color-accent)] underline">
                  {chunks}
                </Link>
              ),
              searchLink: (chunks) => (
                <Link href="/anliegen" className="text-[var(--color-accent)] underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      )}
      {!isEmpty && hiddenDepartments.length > 0 && !focus && (
        <p className="text-[11px] text-[var(--color-mute)] mb-2 max-w-[80ch]">
          {t('hiddenDepartments', {
            count: hiddenDepartments.length,
            names: hiddenDepartments.map((d) => d.name).join(', '),
          })}
        </p>
      )}
      {!isEmpty && !focus && (
        <p className="text-[11px] text-[var(--color-mute)] mb-2 max-w-[80ch]">
          {t('committeeNote')}
        </p>
      )}
      <div className="sr-only">
        <table>
          <caption>{t('ariaLabel')}</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Aufwand (CHF)</th>
              <th scope="col">Nettoaufwand (CHF)</th>
              <th scope="col">FTE</th>
            </tr>
          </thead>
          <tbody>
            {tree.children?.map(dep => (
              <Fragment key={dep.id}>
                <tr>
                  <td><strong>{dep.name}</strong></td>
                  <td suppressHydrationWarning>{dep.value != null ? dep.value.toLocaleString('de-CH') : ''}</td>
                  <td suppressHydrationWarning>{dep.netto != null ? dep.netto.toLocaleString('de-CH') : ''}</td>
                  <td suppressHydrationWarning>{dep.fte != null ? dep.fte.toLocaleString('de-CH') : ''}</td>
                </tr>
                {dep.children?.map(unit => (
                  <tr key={unit.id}>
                    <td>↳ {unit.name}</td>
                    <td suppressHydrationWarning>{unit.value != null ? unit.value.toLocaleString('de-CH') : ''}</td>
                    <td suppressHydrationWarning>{unit.netto != null ? unit.netto.toLocaleString('de-CH') : ''}</td>
                    <td suppressHydrationWarning>{unit.fte != null ? unit.fte.toLocaleString('de-CH') : ''}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div ref={hostRef} className="relative w-full h-[calc(100%-70px)]">
        <svg
          id="treemap-svg"
          width={size.w}
          height={size.h}
          onClick={(e) => { if (e.target === e.currentTarget) setFocus(null); }}
        >
          {root && renderTree(root, colorOf, !focus, setFocus, setTooltip, setMobileSelected)}
          {focus && (
            <g style={{ cursor: 'pointer' }} onClick={() => setFocus(null)}
               role="button" tabIndex={0} aria-label={t('back')}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFocus(null); }}
               className="focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]"
            >
              <rect x={0} y={0} width={180} height={26} fill="var(--color-ink)" rx={4} />
              <text x={12} y={17} fill="white" fontSize={12} fontWeight="500">{t('back')}</text>
            </g>
          )}
        </svg>
        {tooltip && (
          <div
            className="fixed pointer-events-none bg-[var(--color-panel)] border border-[var(--color-line)] rounded-md px-2.5 py-2 shadow text-xs z-[100] max-w-[280px]"
            style={{
              left: Math.min(tooltip.x + 14, window.innerWidth - 300),
              top:  Math.min(tooltip.y + 14, window.innerHeight - 180),
            }}
          >
            <div className="font-semibold mb-1">{tooltip.node.name}</div>
            <Row k={t('tooltipExpense')} v={`${fmtNumber(tooltip.node.value)} CHF`} />
            {/* Pro-Kopf direkt nach Aufwand — ordnet die Brutto-Zahl ein. */}
            {(() => {
              const pc = perCapitaCHF(tooltip.node.value, population);
              return pc ? <Row k={t('tooltipPerCapita')} v={`≈ ${pc}`} /> : null;
            })()}
            {tooltip.node.netto != null && <Row k={t('tooltipNet')} v={`${fmtNumber(tooltip.node.netto)} CHF`} />}
            {/* Pro-Kopf für Netto: das ist der Betrag, den Steuerzahlende
                effektiv tragen — die ehrlichste Pro-Kopf-Grösse. */}
            {tooltip.node.netto != null && (() => {
              const pc = perCapitaCHF(tooltip.node.netto, population);
              return pc ? <Row k={t('tooltipPerCapitaNet')} v={`≈ ${pc}`} /> : null;
            })()}
            {tooltip.node.fte   != null && <Row k={t('tooltipFte')} v={fmtNumber(tooltip.node.fte)} />}
            <Row k={t('tooltipShare')} v={`${(((tooltip.node.value ?? 0) / tooltip.total) * 100).toFixed(1)} %`} />
            {/* Anteil Stadt-Total bezieht sich bewusst auf das ganze Stadt-
                Budget, nicht auf tooltip.total (welcher beim Hineinzoomen
                schrumpft). */}
            {(() => {
              const sh = budgetSharePercent(tooltip.node.value, cityTotalAufwand);
              return sh ? <Row k={t('tooltipShareTotal')} v={`${sh} %`} /> : null;
            })()}
            {tooltip.node.konflikt && <div className="mt-1 text-[var(--color-konflikt)] text-[11px]">{t('conflictNote')}</div>}
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet Drawer */}
      {mobileSelected && (
        <div className="sm:hidden fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 backdrop-blur-sm transition-opacity"
             onClick={() => setMobileSelected(null)}>
          <div className="bg-[var(--color-bg)] rounded-t-2xl p-5 shadow-2xl transform transition-transform"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold m-0 leading-tight pr-4">{mobileSelected.node.name}</h3>
              <button onClick={() => setMobileSelected(null)} className="p-2 -mr-2 -mt-2 text-[var(--color-mute)]" aria-label="Schliessen">
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-2 mb-6 text-sm">
              <Row k={t('tooltipExpense')} v={`${fmtNumber(mobileSelected.node.value)} CHF`} />
              {(() => {
                const pc = perCapitaCHF(mobileSelected.node.value, population);
                return pc ? <Row k={t('tooltipPerCapita')} v={`≈ ${pc}`} /> : null;
              })()}
              {mobileSelected.node.netto != null && <Row k={t('tooltipNet')} v={`${fmtNumber(mobileSelected.node.netto)} CHF`} />}
              {mobileSelected.node.netto != null && (() => {
                const pc = perCapitaCHF(mobileSelected.node.netto, population);
                return pc ? <Row k={t('tooltipPerCapitaNet')} v={`≈ ${pc}`} /> : null;
              })()}
              {mobileSelected.node.fte != null && <Row k={t('tooltipFte')} v={fmtNumber(mobileSelected.node.fte)} />}
              <Row k={t('tooltipShare')} v={`${(((mobileSelected.node.value ?? 0) / mobileSelected.total) * 100).toFixed(1)} %`} />
              {(() => {
                const sh = budgetSharePercent(mobileSelected.node.value, cityTotalAufwand);
                return sh ? <Row k={t('tooltipShareTotal')} v={`${sh} %`} /> : null;
              })()}
              {mobileSelected.node.konflikt && <div className="mt-2 text-[var(--color-konflikt)] text-[13px]">{t('conflictNote')}</div>}
            </div>
            
            <button
              onClick={() => {
                if (mobileSelected.node.depId) setFocus(mobileSelected.node.depId);
                setMobileSelected(null);
              }}
              className="w-full bg-[var(--color-accent)] text-white font-semibold py-3 rounded-xl flex justify-center items-center shadow-md active:scale-[0.98] transition-transform"
            >
              Departement öffnen
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{k}</span>
      <span className="text-[var(--color-accent)] tabular-nums">{v}</span>
    </div>
  );
}

function buildHierarchy(
  data: StadtData,
  focus: string | null,
  rootName: string,
): { tree: Datum; hiddenDepartments: { id: string; name: string }[] } {
  // Zwei parallele Listen: die sichtbaren Departemente (mit Budget-Units) und
  // die ausgefilterten (die sonst unkommentiert aus dem Treemap verschwinden
  // würden). Letztere rendern wir als kleinen Hinweis unter der Visualisierung.
  const visible: Datum[] = [];
  const hidden: { id: string; name: string }[] = [];
  for (const dep of data.departments as Department[]) {
    const units: Datum[] = data.units
      .filter((u: Unit) => u.parent === dep.id && (u.budget?.aufwand ?? 0) > 0)
      .map((u: Unit) => ({
        name: u.name, id: u.id, depId: dep.id,
        kurz: u.odz?.kurzname,
        value: u.budget!.aufwand,
        netto: u.budget?.nettoaufwand,
        fte: u.fte?.schaetzung,
        konflikt: !!u.konflikt,
      }));
    if (units.length > 0) {
      visible.push({ name: dep.name, id: dep.id, children: units });
    } else {
      hidden.push({ id: dep.id, name: dep.name });
    }
  }

  if (focus) {
    const dep = visible.find((d) => d.id === focus);
    if (dep) return { tree: { ...dep, depId: dep.id, isFocus: true }, hiddenDepartments: hidden };
  }
  return { tree: { name: rootName, children: visible }, hiddenDepartments: hidden };
}

function computeLayout(data: Datum, w: number, h: number, isFocus: boolean) {
  if (!w || !h) return null;
  const root = hierarchy<Datum>(data)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  treemap<Datum>().size([w, h]).paddingTop(isFocus ? 36 : 22).paddingInner(2).round(true)(root);
  return root as HierarchyRectangularNode<Datum>;
}

function renderTree(
  root: HierarchyRectangularNode<Datum>,
  colorOf: (key: string) => string,
  showHeaders: boolean,
  onDepClick: (id: string) => void,
  setTooltip: (t: { x: number; y: number; node: Datum; total: number } | null) => void,
  setMobileSelected: (t: { node: Datum; total: number } | null) => void
) {
  const total = root.value ?? 1;
  return (
    <>
      {showHeaders && root.children?.map((d) => (
        <g key={d.data.id} style={{ cursor: 'pointer' }}
           tabIndex={0}
           role="button"
           aria-label={`Departement ${d.data.name} öffnen`}
           onKeyDown={(e) => {
             if (e.key === 'Enter' || e.key === ' ') {
               e.preventDefault();
               if (d.data.id) onDepClick(d.data.id);
             }
           }}
           onClick={() => d.data.id && onDepClick(d.data.id)}
           className="focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]"
        >
          <rect x={d.x0} y={d.y0} width={d.x1 - d.x0} height={22}
                fill={colorOf(d.data.id ?? '')} opacity={1} />
          <text x={d.x0 + 6} y={d.y0 + 15} className="dep-label">
            {labelDep(d, d.value ?? 0)}
          </text>
        </g>
      ))}
      {root.leaves().map((d, i) => (
        <Leaf key={d.data.id ?? `${d.x0}-${d.y0}-${i}`} d={d} colorOf={colorOf}
              total={total} setTooltip={setTooltip} onDepClick={onDepClick} setMobileSelected={setMobileSelected} />
      ))}
    </>
  );
}

function Leaf({
  d, colorOf, total, setTooltip, onDepClick, setMobileSelected,
}: {
  d: HierarchyRectangularNode<Datum>;
  colorOf: (key: string) => string;
  total: number;
  setTooltip: (t: { x: number; y: number; node: Datum; total: number } | null) => void;
  onDepClick: (id: string) => void;
  setMobileSelected: (t: { node: Datum; total: number } | null) => void;
}) {
  const w = d.x1 - d.x0;
  const h = d.y1 - d.y0;
  const color = colorOf(d.data.depId ?? '');

  const kurz = d.data.kurz || d.data.name.substring(0, 4);
  const budgetStr = fmtMio(d.value ?? 0);

  let line1 = '';
  let line2 = '';

  const nameWidth = d.data.name.length * 6.0 + 10;
  const kurzWidth = kurz.length * 6.5 + 10;
  const combinedFullWidth = (d.data.name.length + budgetStr.length + 3) * 6.0 + 10;
  const combinedKurzWidth = (kurz.length + budgetStr.length + 3) * 6.0 + 10;

  if (h >= 30) {
    if (w >= nameWidth) {
      line1 = d.data.name;
      line2 = budgetStr;
    } else if (w >= kurzWidth) {
      line1 = kurz;
      line2 = budgetStr;
    } else if (w >= 30) {
      const maxChars = Math.max(0, Math.floor((w - 10) / 6.0));
      line1 = maxChars > 1 ? d.data.name.slice(0, maxChars) + '…' : '';
    }
  } else if (h >= 16) {
    if (w >= combinedFullWidth) {
      line1 = `${d.data.name} · ${budgetStr}`;
    } else if (w >= nameWidth) {
      line1 = d.data.name;
    } else if (w >= combinedKurzWidth) {
      line1 = `${kurz} · ${budgetStr}`;
    } else if (w >= kurzWidth) {
      line1 = kurz;
    } else if (w >= 30) {
      const maxChars = Math.max(0, Math.floor((w - 10) / 6.0));
      line1 = maxChars > 1 ? d.data.name.slice(0, maxChars) + '…' : '';
    }
  }

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`${d.data.name} öffnen`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (d.data.depId) onDepClick(d.data.depId);
        }
      }}
      onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, node: d.data, total })}
      onMouseLeave={() => setTooltip(null)}
      onClick={() => {
        if (window.innerWidth < 640) {
          setMobileSelected({ node: d.data, total });
        } else {
          if (d.data.depId) {
            onDepClick(d.data.depId);
          }
        }
      }}
      style={{ cursor: 'pointer' }}
      className="focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]"
    >
      <rect x={d.x0} y={d.y0} width={w} height={h} fill={color} opacity={0.65} />
      {d.data.konflikt && w > 10 && h > 10 && (
        <rect x={d.x0} y={d.y0} width={w} height={h} fill="none"
              style={{ stroke: 'var(--color-konflikt)', strokeWidth: 2 }} 
              strokeDasharray="4 3" pointerEvents="none" />
      )}
      {(line1 || line2) && (
        <>
          {/* Kontrast-sicheres Label-Band: dezenter Streifen in Panel-Farbe
              hinter der Beschriftung, Text in --color-ink. Garantiert hohen
              Kontrast (≥12:1) unabhängig von der Departements-Farbe und passt
              sich Hell/Dunkel an. Verhindert den WCAG-1.4.3-Verstoss, den
              dunkler Text direkt auf den mittel-dunklen Rects auslöste. */}
          <rect
            x={d.x0}
            y={d.y0 + 2}
            width={w}
            height={Math.min(line2 ? 30 : 18, Math.max(0, h - 2))}
            fill="var(--color-panel)"
            opacity={0.9}
            pointerEvents="none"
          />
          {line1 && (
            <text x={d.x0 + 5} y={d.y0 + 14} fill="var(--color-ink)" fontWeight="600" fontSize={12}>
              {line1}
            </text>
          )}
          {line2 && (
            <text x={d.x0 + 5} y={d.y0 + 27} fontSize={10} fill="var(--color-ink)">
              {line2}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function labelDep(d: HierarchyRectangularNode<Datum>, value: number) {
  const w = d.x1 - d.x0;
  if (w < 30) return '';
  if (w < 80) return d.data.id ?? '';
  if (w < 220) return `${d.data.id} · ${fmtMio(value)}`;
  return `${d.data.name} · ${fmtMio(value)}`;
}
