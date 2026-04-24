'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy';
import { scaleOrdinal } from 'd3-scale';
import type { StadtData, Department, Unit } from '@/types/stadt';
import { fmtMio, fmtNumber } from '@/lib/search';

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
};

const DEP_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#16a085', '#3b6ea5',
                    '#8b5cf6', '#7a1f2b', '#2c7a7b', '#d35400'];

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

  const tree = buildHierarchy(data, focus, rootName);
  const root = computeLayout(tree, size.w, size.h, focus !== null);

  const sampleJahr = data.units.find((u) => u.budget?.jahr)?.budget?.jahr ?? 2024;

  return (
    <main className="absolute top-14 inset-x-0 bottom-0 p-4 pb-10 overflow-hidden"
          aria-label={t('ariaLabel')}>
      <h2 className="text-lg font-semibold m-0 mb-1">{t('title')}</h2>
      <p className="text-[13px] text-[var(--color-mute)] mb-3">
        {t('intro', { jahr: sampleJahr })}
        {root && <strong>{t('total', { sum: fmtMio(root.value ?? 0) })}</strong>}
      </p>
      <div ref={hostRef} className="relative w-full h-[calc(100%-70px)]">
        <svg
          id="treemap-svg"
          width={size.w}
          height={size.h}
          onClick={(e) => { if (e.target === e.currentTarget) setFocus(null); }}
        >
          {root && renderTree(root, colorOf, !focus, setFocus, setTooltip)}
          {focus && (
            <g style={{ cursor: 'pointer' }} onClick={() => setFocus(null)}>
              <rect x={0} y={0} width={200} height={24} fill="rgba(20,30,60,.78)" />
              <text x={10} y={16} fill="white" fontSize={12}>{t('back')}</text>
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
            {tooltip.node.netto != null && <Row k={t('tooltipNet')} v={`${fmtNumber(tooltip.node.netto)} CHF`} />}
            {tooltip.node.fte   != null && <Row k={t('tooltipFte')} v={fmtNumber(tooltip.node.fte)} />}
            <Row k={t('tooltipShare')} v={`${(((tooltip.node.value ?? 0) / tooltip.total) * 100).toFixed(1)} %`} />
            {tooltip.node.konflikt && <div className="mt-1 text-[#e67e22] text-[11px]">{t('conflictNote')}</div>}
          </div>
        )}
      </div>
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

function buildHierarchy(data: StadtData, focus: string | null, rootName: string): Datum {
  const allDeps: Datum[] = data.departments.map((dep: Department) => {
    const units: Datum[] = data.units
      .filter((u: Unit) => u.parent === dep.id && (u.budget?.aufwand ?? 0) > 0)
      .map((u: Unit) => ({
        name: u.name, id: u.id, depId: dep.id,
        value: u.budget!.aufwand,
        netto: u.budget?.nettoaufwand,
        fte: u.fte?.schaetzung,
        konflikt: !!u.konflikt,
      }));
    return { name: dep.name, id: dep.id, children: units } as Datum;
  }).filter((d) => d.children && d.children.length > 0);

  if (focus) {
    const dep = allDeps.find((d) => d.id === focus);
    if (dep) return { ...dep, depId: dep.id, isFocus: true };
  }
  return { name: rootName, children: allDeps };
}

function computeLayout(data: Datum, w: number, h: number, isFocus: boolean) {
  if (!w || !h) return null;
  const root = hierarchy<Datum>(data)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  treemap<Datum>().size([w, h]).paddingTop(isFocus ? 0 : 22).paddingInner(2).round(true)(root);
  return root as HierarchyRectangularNode<Datum>;
}

function renderTree(
  root: HierarchyRectangularNode<Datum>,
  colorOf: (key: string) => string,
  showHeaders: boolean,
  onDepClick: (id: string) => void,
  setTooltip: (t: { x: number; y: number; node: Datum; total: number } | null) => void
) {
  const total = root.value ?? 1;
  return (
    <>
      {showHeaders && root.children?.map((d) => (
        <g key={d.data.id} style={{ cursor: 'pointer' }}
           onClick={() => d.data.id && onDepClick(d.data.id)}>
          <rect x={d.x0} y={d.y0} width={d.x1 - d.x0} height={22}
                fill={colorOf(d.data.id ?? '')} opacity={1} />
          <text x={d.x0 + 6} y={d.y0 + 15} className="dep-label">
            {labelDep(d, d.value ?? 0)}
          </text>
        </g>
      ))}
      {root.leaves().map((d, i) => (
        <Leaf key={d.data.id ?? `${d.x0}-${d.y0}-${i}`} d={d} colorOf={colorOf}
              total={total} setTooltip={setTooltip} />
      ))}
    </>
  );
}

function Leaf({
  d, colorOf, total, setTooltip,
}: {
  d: HierarchyRectangularNode<Datum>;
  colorOf: (key: string) => string;
  total: number;
  setTooltip: (t: { x: number; y: number; node: Datum; total: number } | null) => void;
}) {
  const w = d.x1 - d.x0;
  const h = d.y1 - d.y0;
  const color = colorOf(d.data.depId ?? '');
  const showName = w > 60 && h > 18;
  const showValue = h > 32;
  const maxChars = Math.max(0, Math.floor(w / 6.5) - 1);
  const name = d.data.name.length > maxChars ? d.data.name.slice(0, maxChars) + '…' : d.data.name;
  return (
    <g
      onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, node: d.data, total })}
      onMouseLeave={() => setTooltip(null)}
    >
      <rect x={d.x0} y={d.y0} width={w} height={h} fill={color} opacity={0.65} />
      {d.data.konflikt && w > 10 && h > 10 && (
        <rect x={d.x0} y={d.y0} width={w} height={h} fill="none"
              stroke="#e67e22" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
      )}
      {showName && <text x={d.x0 + 5} y={d.y0 + 14}>{name}</text>}
      {showName && showValue && (
        <text x={d.x0 + 5} y={d.y0 + 28} fontSize={10} opacity={0.85}>
          {fmtMio(d.value ?? 0)}
        </text>
      )}
    </g>
  );
}

function labelDep(d: HierarchyRectangularNode<Datum>, value: number) {
  const w = d.x1 - d.x0;
  if (w < 60) return '';
  if (w < 220) return d.data.id ?? '';
  return `${d.data.name} · ${fmtMio(value)}`;
}
