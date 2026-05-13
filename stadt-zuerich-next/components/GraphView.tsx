'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Core, ElementDefinition, LayoutOptions, NodeSingular } from 'cytoscape';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { StadtData, Unit } from '@/types/stadt';
import { city } from '@/config/city.config';

try {
  cytoscape.use(fcose);
} catch (e) {
  // Already registered
}

type Layout = 'radial' | 'force';

export default function GraphView({ data, locale }: { data: StadtData; locale?: string }) {
  const t = useTranslations();
  const tNav = useTranslations('Nav');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');

  const hostRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [layout, setLayout] = useState<Layout>('radial');

  const initialExpanded = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (focusId) {
      const u = data.units.find((x) => x.id === focusId);
      const b = data.beteiligungen.find((x) => x.id === focusId);
      if (u) set.add(u.parent);
      if (b) set.add(b.verbunden);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  const focusIdRef = useRef<string | null>(focusId);
  const suppressFocusEffectRef = useRef(false);
  const expandedRef = useRef<Set<string>>(initialExpanded);
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  const tableNodes = useMemo(() => {
    const isLs = locale === 'ls';
    const list: Array<{ id: string; name: string; type: string; parent: string | null; budget?: typeof data.departments[0]['budget']; fte?: typeof data.departments[0]['fte'] }> = [];
    list.push({ id: data.center.id, name: data.center.name, type: 'center', parent: null });
    const depMap = new Map(data.departments.map(d => [d.id, d.name]));
    for (const d of data.departments) {
      list.push({ id: d.id, name: d.name, type: 'department', parent: data.center.name, budget: d.budget, fte: d.fte });
    }
    for (const u of data.units) {
      if (!expanded.has(u.parent)) continue;
      if (isLs && u.kind !== 'unit') continue;
      list.push({ id: u.id, name: u.name, type: u.kind, parent: depMap.get(u.parent) ?? u.parent, budget: u.budget, fte: u.fte });
    }
    if (!isLs) {
      for (const b of data.beteiligungen) {
        if (!expanded.has(b.verbunden)) continue;
        list.push({ id: b.id, name: b.name, type: 'beteiligung', parent: depMap.get(b.verbunden) ?? b.verbunden, budget: b.budget, fte: b.fte });
      }
    }
    return list;
  }, [data, expanded, locale]);

  function setFocus(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('focus', id); else params.delete('focus');
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Parameters<typeof router.replace>[0], { scroll: false });
  }

  function applyFocusHighlight(cy: Core, id: string) {
    const target = cy.getElementById(id);
    if (!target || target.length === 0) return;
    cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
    cy.elements().addClass('faded');
    target.closedNeighborhood().removeClass('faded').addClass('highlighted');
    target.addClass('search-hit');
  }

  useEffect(() => {
    let canceled = false;
    let observer: ResizeObserver | null = null;

    const initCy = () => {
      if (canceled || !hostRef.current || cyRef.current) return;
      
      const width = hostRef.current.clientWidth;
      const height = hostRef.current.clientHeight;

      if (width === 0 || height === 0) {
        if (!observer) {
          observer = new ResizeObserver(() => {
            if (hostRef.current && hostRef.current.clientWidth > 0 && hostRef.current.clientHeight > 0) {
              observer?.disconnect();
              observer = null;
              initCy();
            }
          });
          observer.observe(hostRef.current);
        }
        return;
      }

      const elements = buildElements(data, expandedRef.current, locale);
      const cy = cytoscape({
        container: hostRef.current,
        elements,
        style: getGraphStyle(locale),
        layout: layoutOptions('radial', false),
        wheelSensitivity: 1,
        minZoom: 0.2,
        maxZoom: 4,
      });

      cy.on('mouseover', 'node', (e) => {
        const nb = e.target.closedNeighborhood();
        cy.elements().removeClass('highlighted').removeClass('search-hit');
        cy.elements().addClass('faded');
        nb.removeClass('faded').addClass('highlighted');
      });
      cy.on('mouseout', 'node', () => {
        cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
        const fid = focusIdRef.current;
        if (fid) applyFocusHighlight(cy, fid);
      });
      cy.on('tap', 'node', (e) => {
        const id = e.target.id();
        const type = e.target.data('type');
        const childCount = (e.target.data('childCount') as number | undefined) ?? 0;
        if (type === 'department' && childCount > 0) {
          const cur = expandedRef.current;
          const next = new Set(cur);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setExpanded(next);
        }
        suppressFocusEffectRef.current = true;
        focusIdRef.current = id;
        applyFocusHighlight(cy, id);
        setFocus(id);
      });
      cy.on('tap', (e) => {
        if (e.target === cy) {
          suppressFocusEffectRef.current = true;
          focusIdRef.current = null;
          cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
          setFocus(null);
        }
      });
      cyRef.current = cy;
      cy.ready(() => {
        cy.fit(undefined, 40);
        cy.zoom({ level: cy.zoom() * 1.45, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
        const initialFocus = focusIdRef.current;
        if (initialFocus) applyFocusHighlight(cy, initialFocus);
      });
    };
    
    initCy();
    
    return () => {
      canceled = true;
      observer?.disconnect();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    cyRef.current?.layout(layoutOptions(layout, true)).run();
  }, [layout]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const target = buildElements(data, expanded, locale);
    syncElements(cy, target);
    cy.layout({ ...layoutOptions(layout, true), fit: false } as LayoutOptions).run();
    const fid = focusIdRef.current;
    if (fid) {
      const t = cy.getElementById(fid);
      if (t && t.length > 0) applyFocusHighlight(cy, fid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    focusIdRef.current = focusId;
    if (suppressFocusEffectRef.current) {
      suppressFocusEffectRef.current = false;
      return;
    }
    const cy = cyRef.current;
    if (!cy) return;
    if (!focusId) {
      cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
      return;
    }
    const u = data.units.find((x) => x.id === focusId);
    const b = data.beteiligungen.find((x) => x.id === focusId);
    const parentToOpen = u?.parent ?? b?.verbunden;
    if (parentToOpen && !expanded.has(parentToOpen)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(parentToOpen);
        return next;
      });
      return;
    }
    const target = cy.getElementById(focusId);
    if (!target || target.length === 0) return;
    applyFocusHighlight(cy, focusId);
    cy.animate({ center: { eles: target }, zoom: 1.6 }, { duration: 500 });
  }, [focusId, data, expanded]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute inset-0 cy-host focus:outline-none"
        aria-hidden="true"
      />
      
      <div className="sr-only">
        <table>
          <caption>{t('GraphTable.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('GraphTable.colName')}</th>
              <th scope="col">{t('GraphTable.colType')}</th>
              <th scope="col">{t('GraphTable.colParent')}</th>
              <th scope="col">{t('GraphTable.colBudget')}</th>
              <th scope="col">{t('GraphTable.colFte')}</th>
            </tr>
          </thead>
          <tbody>
            {tableNodes.map(n => (
              <tr key={n.id}>
                <td>{n.name}</td>
                <td>{t.has(`Type.${n.type}`) ? t(`Type.${n.type}`) : n.type}</td>
                <td>{n.parent ?? '-'}</td>
                <td suppressHydrationWarning>{n.budget?.aufwand != null ? n.budget.aufwand.toLocaleString('de-CH') : ''}</td>
                <td suppressHydrationWarning>{n.fte?.schaetzung != null ? n.fte.schaetzung.toLocaleString('de-CH') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <Toolbar
        onExportCSV={() => {
          import('@/lib/export').then(({ downloadNodesAsCSV }) => {
            downloadNodesAsCSV(tableNodes);
          });
        }}
        layout={layout}
        onLayoutChange={setLayout}
        onCenter={() => {
          const cy = cyRef.current;
          if (!cy) return;
          setExpanded(new Set());
          suppressFocusEffectRef.current = true;
          focusIdRef.current = null;
          cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
          setFocus(null);
          cy.animate({ center: { eles: cy.getElementById('stadtrat') }, zoom: 1 }, { duration: 500 });
        }}
        onFit={() => cyRef.current?.fit(undefined, 40)}
        allExpanded={
          data.departments.length > 0 && expanded.size === data.departments.length
        }
        onExpandAll={() => setExpanded(new Set(data.departments.map((d) => d.id)))}
        onCollapseAll={() => {
          setExpanded(new Set());
          const fid = focusIdRef.current;
          if (fid) {
            const stillVisible =
              data.departments.some((d) => d.id === fid) || data.center.id === fid;
            if (!stillVisible) setFocus(null);
          }
        }}
        labelExpandAll={tNav('expandAll')}
        labelCollapseAll={tNav('collapseAll')}
        labelExportCSV={t('Export.csvButton')}
      />
    </>
  );
}

function Toolbar({
  layout, onLayoutChange, onCenter, onFit, allExpanded, onExpandAll, onCollapseAll, labelExpandAll, labelCollapseAll, labelExportCSV, onExportCSV
}: {
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  onCenter: () => void;
  onFit: () => void;
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  labelExpandAll: string;
  labelCollapseAll: string;
  labelExportCSV: string;
  onExportCSV: () => void;
}) {
  const btn = (active: boolean) =>
    'px-2.5 py-1.5 text-xs rounded border ' +
    (active
      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
      : 'bg-transparent text-[var(--color-ink)] border-[var(--color-line)] hover:bg-[var(--color-bg)]');
  return (
    <div role="toolbar" aria-label="Diagramm-Werkzeuge"
         className="fixed top-[124px] sm:top-[64px] right-3 z-[9] flex flex-col sm:flex-col gap-1.5 items-end pointer-events-none [&>*]:pointer-events-auto">
      <div role="group" aria-label="Layout"
           className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow">
        <button className={btn(layout === 'radial')} aria-pressed={layout === 'radial'}
                onClick={() => onLayoutChange('radial')}>Radial</button>
        <button className={btn(layout === 'force')} aria-pressed={layout === 'force'}
                onClick={() => onLayoutChange('force')}>Gravitation</button>
      </div>
      <div role="group" aria-label="Ansicht"
           className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow">
        <button className={btn(false)} onClick={onCenter}
                aria-label="Diagramm auf Stadtrat zentrieren">Zentrieren</button>
        <button className={btn(false)} onClick={onFit}
                aria-label="Alle Knoten ins Sichtfeld einpassen">Alles zeigen</button>
        <button
          className={btn(false)}
          onClick={allExpanded ? onCollapseAll : onExpandAll}
          aria-label={allExpanded ? labelCollapseAll : labelExpandAll}
          title={allExpanded ? labelCollapseAll : labelExpandAll}
        >
          {allExpanded ? labelCollapseAll : labelExpandAll}
        </button>
      </div>
      <div role="group" aria-label="Export" className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow mt-2">
        <button className={btn(false)} onClick={onExportCSV} aria-label={labelExportCSV}>
          {labelExportCSV}
        </button>
      </div>
    </div>
  );
}

function buildElements(d: StadtData, expanded: Set<string>, locale?: string): ElementDefinition[] {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];
  const isLs = locale === 'ls';

  nodes.push({ data: { id: d.center.id, label: d.center.name, type: 'center', level: 0 } });

  const childCount = new Map<string, number>();
  for (const u of d.units) {
    if (isLs && u.kind !== 'unit') continue;
    childCount.set(u.parent, (childCount.get(u.parent) ?? 0) + 1);
  }
  for (const b of d.beteiligungen) {
    if (isLs) continue;
    childCount.set(b.verbunden, (childCount.get(b.verbunden) ?? 0) + 1);
  }

  for (const dep of d.departments) {
    const n = childCount.get(dep.id) ?? 0;
    const isOpen = expanded.has(dep.id);
    const label =
      n === 0 ? dep.name
      : isOpen ? `▾ ${dep.name}`
      : `▸ ${dep.name} (${n})`;
    nodes.push({
      data: {
        id: dep.id, label, fullName: dep.name, abbr: dep.id,
        vorsteher: dep.vorsteher, type: 'department', level: 1,
        budget: dep.budget, fte: dep.fte, odz: dep.odz,
        childCount: n,
        expanded: isOpen,
      },
    });
    edges.push({ data: { id: `e-${d.center.id}-${dep.id}`, source: d.center.id, target: dep.id } });
  }

  for (const u of d.units) {
    if (!expanded.has(u.parent)) continue;
    if (isLs && u.kind !== 'unit') continue;
    const lvl = u.kind === 'extern' ? 3 : 2;
    const isCompound = u.kind !== 'extern';
    nodes.push({
      data: {
        id: u.id, label: u.name, type: u.kind, level: lvl, parentDep: u.parent,
        parent: isCompound ? u.parent : undefined,
        budget: u.budget, fte: u.fte, odz: u.odz, konflikt: u.konflikt,
      },
    });
    if (!isCompound) {
      edges.push({ data: { id: `e-${u.parent}-${u.id}`, source: u.parent, target: u.id } });
    }
  }

  for (const b of d.beteiligungen) {
    if (isLs) continue;
    if (!expanded.has(b.verbunden)) continue;
    nodes.push({
      data: {
        id: b.id, label: b.name, type: 'beteiligung', level: 4, parentDep: b.verbunden,
        budget: b.budget, fte: b.fte, odz: b.odz,
      },
    });
    edges.push({
      data: { id: `e-${b.verbunden}-${b.id}`, source: b.verbunden, target: b.id, dashed: true },
    });
  }

  return [...nodes, ...edges];
}

function syncElements(cy: Core, target: ElementDefinition[]): void {
  const targetById = new Map<string, ElementDefinition>();
  for (const el of target) {
    if (el.data?.id) targetById.set(el.data.id, el);
  }
  cy.batch(() => {
    cy.elements().forEach((ele) => {
      if (!targetById.has(ele.id())) ele.remove();
    });
    const toAdd: ElementDefinition[] = [];
    for (const [id, def] of targetById) {
      const existing = cy.getElementById(id);
      if (existing.length === 0) {
        toAdd.push(def);
      } else if (def.data) {
        for (const key of Object.keys(def.data)) {
          existing.data(key, (def.data as Record<string, unknown>)[key]);
        }
      }
    }
    if (toAdd.length > 0) cy.add(toAdd);
  });
}

function layoutOptions(name: Layout, animate: boolean): LayoutOptions {
  if (name === 'force') {
    return {
      name: 'fcose', quality: 'default', animate, animationDuration: 800,
      nodeRepulsion: 6000, idealEdgeLength: 60, gravity: 0.15, nestingFactor: 0.6, randomize: false,
    } as unknown as LayoutOptions;
  }
  return {
    name: 'concentric',
    concentric: (n: NodeSingular) => 10 - (n.data('level') as number),
    levelWidth: () => 1,
    minNodeSpacing: 14,
    spacingFactor: 0.75,
    avoidOverlap: true, animate, animationDuration: 600,
  };
}

const TC = city.theme;
function getGraphStyle(locale?: string): cytoscape.StylesheetStyle[] {
  const isLs = locale === 'ls';
  const mul = isLs ? 1.5 : 1;
  return [
    { selector: 'node', style: {
        'label': 'data(label)', 'font-size': 9 * mul,
        'text-valign': 'center', 'text-halign': 'center',
        'color': '#1a1f2e', 'text-outline-color': '#fff', 'text-outline-width': 2 * mul,
        'border-width': 1 * mul, 'border-color': 'rgba(0,0,0,.2)', 'width': 18 * mul, 'height': 18 * mul } },
    { selector: 'node[type = "center"]', style: {
        'background-color': TC.nodeType.stadtpraesidium, 'shape': 'ellipse',
        'width': 70 * mul, 'height': 70 * mul, 'font-size': 13 * mul, 'color': '#fff',
        'text-outline-color': TC.nodeType.stadtpraesidium } },
    { selector: 'node[type = "department"]', style: {
        'background-color': TC.nodeType.department, 'shape': 'round-rectangle',
        'width': 130 * mul, 'height': 54 * mul, 'font-size': 10 * mul, 'font-weight': 'bold',
        'color': '#fff', 'text-outline-color': TC.nodeType.department,
        'text-wrap': 'wrap', 'text-max-width': String(120 * mul), 'padding': String(4 * mul) } },
    { selector: 'node[type = "department"]:parent', style: {
        'background-color': 'rgba(255, 255, 255, 0.65)',
        'border-width': 2 * mul, 'border-color': TC.nodeType.department,
        'shape': 'round-rectangle', 'padding': String(16 * mul),
        'text-valign': 'top', 'text-halign': 'center',
        'color': TC.nodeType.department, 'text-outline-width': 0,
        'font-size': 11 * mul, 'text-margin-y': -8 * mul,
    } },
    { selector: 'node[type = "unit"]', style: {
        'background-color': TC.nodeType.unit, 'shape': 'round-rectangle', 'width': 22 * mul, 'height': 16 * mul } },
    { selector: 'node[type = "staff"]', style: {
        'background-color': TC.nodeType.staff, 'shape': 'round-rectangle', 'width': 22 * mul, 'height': 16 * mul } },
    { selector: 'node[type = "extern"]', style: {
        'background-color': TC.nodeType.extern, 'shape': 'diamond', 'width': 22 * mul, 'height': 22 * mul } },
    { selector: 'node[type = "beteiligung"]', style: {
        'background-color': TC.nodeType.beteiligung, 'shape': 'diamond', 'width': 18 * mul, 'height': 18 * mul } },
    { selector: 'edge', style: {
        'width': 1 * mul, 'line-color': '#c8cdda', 'curve-style': 'bezier',
        'target-arrow-shape': 'none', 'opacity': 0.6 } },
    { selector: 'edge[?dashed]', style: { 'line-style': 'dashed', 'opacity': 0.45 } },
    { selector: '.faded',       style: { 'opacity': 0.35, 'text-opacity': 0.25 } },
    { selector: '.highlighted', style: { 'border-width': 3 * mul, 'border-color': TC.accent, 'opacity': 1 } },
    { selector: '.search-hit',  style: { 'border-width': 4 * mul, 'border-color': TC.accent } },
    { selector: 'node[?konflikt]', style: {
        'border-width': 2.5 * mul, 'border-color': TC.konflikt, 'border-style': 'dashed' } },
  ];
}
