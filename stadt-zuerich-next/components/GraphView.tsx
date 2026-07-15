'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Core, ElementDefinition, LayoutOptions, NodeSingular } from 'cytoscape';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { StadtData } from '@/types/stadt';
import { city } from '@/config/city.config';
import LiveClimateWidget from './LiveClimateWidget';

try {
  cytoscape.use(fcose);
} catch {
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
  const [klimaModus, setKlimaModus] = useState(false);
  const [diversityModus, setDiversityModus] = useState(false);
  const [gudBudgetDelta, setGudBudgetDelta] = useState(0);

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

  const expandedWithFocus = useMemo<Set<string>>(() => {
    if (!focusId) return expanded;
    const u = data.units.find((x) => x.id === focusId);
    const b = data.beteiligungen.find((x) => x.id === focusId);
    const parent = u?.parent ?? b?.verbunden;
    if (parent && !expanded.has(parent)) {
      const next = new Set(expanded);
      next.add(parent);
      return next;
    }
    return expanded;
  }, [expanded, focusId, data]);

  const tableNodes = useMemo(() => {
    const isLs = locale === 'ls';
    const list: Array<{ id: string; name: string; type: string; parent: string | null; budget?: typeof data.departments[0]['budget']; fte?: typeof data.departments[0]['fte'] }> = [];
    list.push({ id: data.center.id, name: data.center.name, type: 'center', parent: null });
    const depMap = new Map(data.departments.map(d => [d.id, d.name]));
    for (const d of data.departments) {
      list.push({ id: d.id, name: d.name, type: 'department', parent: data.center.name, budget: d.budget, fte: d.fte });
    }
    for (const u of data.units) {
      if (!expandedWithFocus.has(u.parent)) continue;
      if (isLs && u.kind !== 'unit') continue;
      list.push({ id: u.id, name: u.name, type: u.kind, parent: depMap.get(u.parent) ?? u.parent, budget: u.budget, fte: u.fte });
    }
    if (!isLs) {
      for (const b of data.beteiligungen) {
        if (!expandedWithFocus.has(b.verbunden)) continue;
        list.push({ id: b.id, name: b.name, type: 'beteiligung', parent: depMap.get(b.verbunden) ?? b.verbunden, budget: b.budget, fte: b.fte });
      }
    }
    return list;
  }, [data, expandedWithFocus, locale]);

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

      const elements = buildElements(data, expandedRef.current, locale, layout);
      const cy = cytoscape({
        container: hostRef.current,
        elements,
        style: getGraphStyle(locale, klimaModus, gudBudgetDelta, diversityModus),
        layout: layoutOptions('radial', false),
        wheelSensitivity: 0.2,
        minZoom: 0.15,
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
        const initialFocus = focusIdRef.current;
        if (initialFocus) applyFocusHighlight(cy, initialFocus);
      });
    };
    
    const handleReset = () => {
      const cy = cyRef.current;
      if (!cy) return;
      setExpanded(new Set());
      suppressFocusEffectRef.current = true;
      focusIdRef.current = null;
      cy.elements().removeClass('faded').removeClass('highlighted').removeClass('search-hit');
      setFocus(null);
      cy.animate({ center: { eles: cy.getElementById('stadtrat') }, zoom: 1 }, { duration: 500 });
    };
    window.addEventListener('mog:graph:reset', handleReset);
    
    initCy();
    
    return () => {
      canceled = true;
      observer?.disconnect();
      window.removeEventListener('mog:graph:reset', handleReset);
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);



  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(getGraphStyle(locale, klimaModus, gudBudgetDelta, diversityModus));
  }, [klimaModus, locale, gudBudgetDelta, diversityModus]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const target = buildElements(data, expandedWithFocus, locale, layout);
    syncElements(cy, target);
    const layoutConfig = cy.layout({ ...layoutOptions(layout, true), fit: true } as LayoutOptions);
    
    const fid = focusIdRef.current;
    if (fid && !suppressFocusEffectRef.current) {
      cy.one('layoutstop', () => {
        const t = cy.getElementById(fid);
        if (t && t.length > 0) {
          applyFocusHighlight(cy, fid);
          cy.animate({ center: { eles: t }, zoom: 1.5 }, { duration: 600 });
        }
      });
    } else if (fid) {
      const t = cy.getElementById(fid);
      if (t && t.length > 0) applyFocusHighlight(cy, fid);
    }
    
    layoutConfig.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedWithFocus, layout]);

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
    if (parentToOpen && !expandedRef.current.has(parentToOpen)) {
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
    cy.stop(true, true);
    cy.animate({ center: { eles: target }, zoom: 1.5 }, { duration: 600 });
  }, [focusId, data]);

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
        klimaModus={klimaModus}
        onChangeKlimaModus={setKlimaModus}
        labelKlimaToggle={tNav('climateToggle')}
        titleKlimaToggle={tNav('climateToggleTitle')}
        diversityModus={diversityModus}
        onChangeDiversityModus={setDiversityModus}
        labelDiversityToggle={tNav('diversityToggle')}
        titleDiversityToggle={tNav('diversityToggleTitle')}
      />
      {klimaModus && (
        <LiveClimateWidget 
          gudBudgetDelta={gudBudgetDelta} 
          onGudBudgetDeltaChange={setGudBudgetDelta} 
        />
      )}
    </>
  );
}

function Toolbar({
  layout, onLayoutChange, onCenter, onFit, allExpanded, onExpandAll, onCollapseAll, labelExpandAll, labelCollapseAll, labelExportCSV, onExportCSV,
  klimaModus, onChangeKlimaModus, labelKlimaToggle, titleKlimaToggle,
  diversityModus, onChangeDiversityModus, labelDiversityToggle, titleDiversityToggle
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
  klimaModus?: boolean;
  onChangeKlimaModus?: (k: boolean) => void;
  labelKlimaToggle?: string;
  titleKlimaToggle?: string;
  diversityModus?: boolean;
  onChangeDiversityModus?: (d: boolean) => void;
  labelDiversityToggle?: string;
  titleDiversityToggle?: string;
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
                aria-label="Auswahl aufheben und Ansicht zurücksetzen">↻ Zurücksetzen</button>
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
      
      {onChangeKlimaModus && (
        <div role="group" aria-label="Klima" className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow mt-2">
          <button 
            className={btn(klimaModus ?? false)} 
            onClick={() => {
              if (klimaModus && onChangeDiversityModus) onChangeDiversityModus(false); // mutually exclusive
              onChangeKlimaModus(!(klimaModus ?? false));
            }}
            aria-pressed={klimaModus ?? false}
            title={titleKlimaToggle}
          >
            {labelKlimaToggle}
          </button>
        </div>
      )}

      {onChangeDiversityModus && (
        <div role="group" aria-label="Diversity" className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow mt-2">
          <button 
            className={btn(diversityModus ?? false)} 
            onClick={() => {
              if (!diversityModus && onChangeKlimaModus) onChangeKlimaModus(false); // mutually exclusive
              onChangeDiversityModus(!(diversityModus ?? false));
            }}
            aria-pressed={diversityModus ?? false}
            title={titleDiversityToggle}
          >
            {labelDiversityToggle}
          </button>
        </div>
      )}

      <div role="group" aria-label="Export" className="flex gap-1.5 bg-[var(--color-panel)] p-1.5 rounded-lg shadow mt-2">
        <button className={btn(false)} onClick={onExportCSV} aria-label={labelExportCSV}>
          {labelExportCSV}
        </button>
      </div>
    </div>
  );
}

function buildElements(d: StadtData, expanded: Set<string>, locale: string | undefined, layout: Layout): ElementDefinition[] {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];
  const isLs = locale === 'ls';

  nodes.push({ data: { id: d.center.id, label: d.center.name, type: 'center', level: 0, color: TC.nodeType.stadtpraesidium } });

  const childCount = new Map<string, number>();
  for (const u of d.units) {
    if (isLs && u.kind !== 'unit') continue;
    childCount.set(u.parent, (childCount.get(u.parent) ?? 0) + 1);
  }
  for (const b of d.beteiligungen) {
    if (isLs) continue;
    childCount.set(b.verbunden, (childCount.get(b.verbunden) ?? 0) + 1);
  }

  const depColors = new Map<string, string>();

  for (let i = 0; i < d.departments.length; i++) {
    const dep = d.departments[i];
    const n = childCount.get(dep.id) ?? 0;
    const isOpen = expanded.has(dep.id);
    const label = n > 0 ? `${dep.name}\n(${n})` : dep.name;
    const color = TC.departmentPalette[i % TC.departmentPalette.length];
    depColors.set(dep.id, color);

    nodes.push({
      data: {
        id: dep.id, label, fullName: dep.name, abbr: dep.id,
        vorsteher: dep.vorsteher, type: 'department', level: 1,
        budget: dep.budget, fte: dep.fte, odz: dep.odz,
        childCount: n,
        expanded: isOpen,
        klima: (dep as unknown as Record<string, unknown>).klima,
        diversity: (dep as unknown as Record<string, unknown>).diversity,
        color
      },
    });
    edges.push({ data: { id: `e-${d.center.id}-${dep.id}`, source: d.center.id, target: dep.id, color } });
  }

  for (const u of d.units) {
    if (!expanded.has(u.parent)) continue;
    if (isLs && u.kind !== 'unit') continue;
    const lvl = u.kind === 'extern' ? 3 : 2;
    const isCompound = u.kind !== 'extern' && layout === 'force';
    const color = depColors.get(u.parent) ?? TC.nodeType.unit;
    nodes.push({
      data: {
        id: u.id, label: u.name, type: u.kind, level: lvl, parentDep: u.parent,
        parent: isCompound ? u.parent : undefined,
        budget: u.budget, fte: u.fte, odz: u.odz, konflikt: u.konflikt,
        klima: (u as unknown as Record<string, unknown>).klima,
        diversity: (u as unknown as Record<string, unknown>).diversity,
        color
      },
    });
    if (!isCompound) {
      edges.push({ data: { id: `e-${u.parent}-${u.id}`, source: u.parent, target: u.id, color } });
    }
  }

  for (const b of d.beteiligungen) {
    if (isLs) continue;
    if (!expanded.has(b.verbunden)) continue;
    const color = depColors.get(b.verbunden) ?? TC.nodeType.beteiligung;
    nodes.push({
      data: {
        id: b.id, label: b.name, type: 'beteiligung', level: 4, parentDep: b.verbunden,
        budget: b.budget, fte: b.fte, odz: b.odz,
        klima: (b as unknown as Record<string, unknown>).klima,
        diversity: (b as unknown as Record<string, unknown>).diversity,
        color
      },
    });
    edges.push({
      data: { id: `e-${b.verbunden}-${b.id}`, source: b.verbunden, target: b.id, dashed: true, color },
    });
  }

  // Nicht-hierarchische Aufsichts-/Verknüpfungs-Kanten (verwaltungsunabhängige
  // Behörden). Nur zeichnen, wenn beide Endpunkte gerade gerendert sind —
  // sonst würde Cytoscape eine Kante ohne Knoten erzeugen.
  const renderedIds = new Set<string>();
  for (const n of nodes) if (n.data?.id) renderedIds.add(n.data.id as string);
  for (const rel of d.relationships ?? []) {
    if (!renderedIds.has(rel.from) || !renderedIds.has(rel.to)) continue;
    edges.push({
      data: {
        id: `r-${rel.from}-${rel.to}`, source: rel.from, target: rel.to,
        dashed: true, rel: true, color: TC.konflikt,
      },
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
        const oldParent = existing.isNode() ? existing.data('parent') : undefined;
        for (const key of Object.keys(def.data)) {
          existing.data(key, (def.data as Record<string, unknown>)[key]);
        }
        if (existing.isNode() && def.data.parent !== oldParent) {
          existing.move({ parent: def.data.parent || null });
        }
      }
    }
    if (toAdd.length > 0) cy.add(toAdd);
  });
}

function layoutOptions(name: Layout, animate: boolean): LayoutOptions {
  if (name === 'force') {
    return {
      name: 'fcose', quality: 'proof', animate, animationDuration: 800,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 400000, idealEdgeLength: 150, gravity: 0.05, nestingFactor: 0.6, randomize: true,
      fit: true, padding: 60,
    } as unknown as LayoutOptions;
  }
  return {
    name: 'breadthfirst',
    circle: true,
    roots: '[type = "center"]',
    nodeDimensionsIncludeLabels: true,
    spacingFactor: 0.95,
    fit: true, padding: 40,
    avoidOverlap: true, animate, animationDuration: 600,
  } as unknown as LayoutOptions;
}

const TC = city.theme;
function getGraphStyle(locale?: string, klimaModus?: boolean, gudBudgetDelta: number = 0, diversityModus?: boolean): cytoscape.StylesheetStyle[] {
  const isLs = locale === 'ls';
  const mul = isLs ? 1.5 : 1;
  const gudScale = 1 + (gudBudgetDelta / 100);

  const styles: cytoscape.StylesheetStyle[] = [
    { selector: 'node', style: {
        'label': 'data(label)', 'font-size': 9 * mul,
        'text-valign': 'bottom', 'text-halign': 'center',
        'text-margin-y': 4 * mul,
        'color': '#1a1f2e', 'text-outline-color': '#fff', 'text-outline-width': 2 * mul,
        'border-width': 1 * mul, 'border-color': 'rgba(0,0,0,.2)', 'width': 18 * mul, 'height': 18 * mul } },
    { selector: 'node[type = "center"]', style: {
        'background-color': 'data(color)', 'shape': 'ellipse',
        'width': 64 * mul, 'height': 64 * mul, 'font-size': 12 * mul, 'color': '#fff',
        'text-valign': 'center', 'text-margin-y': 0,
        'text-outline-color': 'data(color)' } },
    { selector: 'node[type = "department"]', style: {
        'background-color': 'data(color)', 'shape': 'round-rectangle',
        'width': 120 * mul, 'height': 52 * mul, 'font-size': 11 * mul, 'font-weight': 'bold',
        'color': '#fff', 'text-outline-color': 'data(color)',
        'text-valign': 'center', 'text-margin-y': 0,
        'text-wrap': 'wrap', 'text-max-width': String(112 * mul), 'padding': String(4 * mul) } },
    { selector: 'node[type = "department"]:parent', style: {
        'background-color': 'rgba(255, 255, 255, 0.65)',
        'border-width': 2 * mul, 'border-color': 'data(color)',
        'shape': 'round-rectangle', 'padding': String(16 * mul),
        'text-valign': 'top', 'text-halign': 'center',
        'color': 'data(color)', 'text-outline-width': 0,
        'font-size': 11 * mul, 'text-margin-y': -8 * mul,
    } },
    { selector: 'node[type = "unit"]', style: {
        'background-color': 'data(color)', 'shape': 'round-rectangle', 'width': 22 * mul, 'height': 16 * mul } },
    { selector: 'node[type = "staff"]', style: {
        'background-color': 'data(color)', 'shape': 'round-rectangle', 'width': 22 * mul, 'height': 16 * mul } },
    // Spezialverwaltungsbehörde: weisse Box mit kräftiger Kontur — spiegelt
    // die Darstellung im offiziellen Organigramm der Stadt.
    { selector: 'node[type = "spezial"]', style: {
        'background-color': TC.nodeType.spezial, 'shape': 'round-rectangle',
        'width': 22 * mul, 'height': 16 * mul,
        'border-width': 1.5 * mul, 'border-color': '#475569' } },
    { selector: 'node[type = "extern"]', style: {
        'background-color': 'data(color)', 'shape': 'diamond', 'width': 22 * mul, 'height': 22 * mul } },
    { selector: 'node[type = "beteiligung"]', style: {
        'background-color': 'data(color)', 'shape': 'diamond', 'width': 18 * mul, 'height': 18 * mul } },
    { selector: 'edge', style: {
        'width': 1 * mul, 'line-color': 'data(color)', 'curve-style': 'bezier',
        'target-arrow-shape': 'none', 'opacity': 0.6 } },
    { selector: 'edge[?dashed]', style: { 'line-style': 'dashed', 'opacity': 0.45 } },
    // Aufsichts-/Verknüpfungs-Kante (verwaltungsunabhängig): gestrichelt in der
    // Konflikt-Farbe mit Pfeil zur beaufsichtigten/verknüpften Einheit.
    { selector: 'edge[?rel]', style: {
        'line-style': 'dashed', 'line-color': TC.konflikt,
        'target-arrow-shape': 'triangle', 'target-arrow-color': TC.konflikt,
        'width': 1.2 * mul, 'opacity': 0.5 } },
    { selector: '.faded',       style: { 'opacity': 0.6, 'text-opacity': 0.8 } },
    { selector: '.highlighted', style: { 'border-width': 3 * mul, 'border-color': TC.accent, 'opacity': 1 } },
    { selector: '.search-hit',  style: { 'border-width': 4 * mul, 'border-color': TC.accent } },
    { selector: 'node[?konflikt]', style: {
        'border-width': 2.5 * mul, 'border-color': TC.konflikt, 'border-style': 'dashed' } },
  ];

  if (klimaModus) {
    styles.push({
      selector: 'node[type="department"], node[type="unit"], node[type="staff"]',
      style: {
        'background-color': (ele: NodeSingular) => {
          const klima = ele.data('klima');
          if (klima && klima.co2Score > 50) return '#ef4444'; // red-500
          if (klima && klima.co2Score > 20) return '#eab308'; // yellow-500
          return '#22c55e'; // green-500
        },
        'border-width': 4 * mul,
        'border-color': '#cbd5e1'
      } as cytoscape.Css.Node
    });

    if (gudBudgetDelta !== 0) {
      styles.push({
        selector: 'node[id="GUD"], node[parentDep="GUD"], node[parent="GUD"]',
        style: {
          'width': (ele: NodeSingular) => {
             const baseW = ele.data('type') === 'department' ? 130 : 22;
             return baseW * mul * gudScale;
          },
          'height': (ele: NodeSingular) => {
             const baseH = ele.data('type') === 'department' ? 54 : 16;
             return baseH * mul * gudScale;
          },
          'font-size': (ele: NodeSingular) => {
             const baseFS = ele.data('type') === 'department' ? 10 : 9;
             return baseFS * mul * Math.max(0.5, Math.min(gudScale, 1.5));
          },
          'border-width': 4 * mul,
          'border-color': gudBudgetDelta > 0 ? '#ef4444' : '#22c55e', 
          'transition-property': 'width, height, font-size, border-color',
          'transition-duration': 300
        } as cytoscape.Css.Node
      });
    }
  }

  if (diversityModus) {
    styles.push({
      selector: 'node[type="department"], node[type="unit"]',
      style: {
        'pie-size': '100%',
        'pie-1-background-color': '#d946ef', // fuchsia-500 (women)
        'pie-1-background-size': (ele: NodeSingular) => {
           const div = ele.data('diversity');
           return div ? div.womenInManagement : 0;
        },
        'pie-2-background-color': '#0ea5e9', // sky-500 (men)
        'pie-2-background-size': (ele: NodeSingular) => {
           const div = ele.data('diversity');
           return div ? div.menInManagement : 0;
        },
        'background-opacity': 0 // hide original solid color
      } as cytoscape.Css.Node
    });
  }

  return styles;
}
