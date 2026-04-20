'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import type cytoscape from 'cytoscape';
import type { Core, ElementDefinition, LayoutOptions, NodeSingular } from 'cytoscape';
import type { StadtData } from '@/types/stadt';

type Layout = 'radial' | 'force';

export default function GraphView({ data }: { data: StadtData }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');

  const hostRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [layout, setLayout] = useState<Layout>('radial');

  function setFocus(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('focus', id); else params.delete('focus');
    const qs = params.toString();
    // i18n-Router erhält locale-Prefix automatisch; Query-String anhängen.
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Parameters<typeof router.replace>[0], { scroll: false });
  }

  // Initialisierung
  useEffect(() => {
    let canceled = false;
    (async () => {
      const cytoscape = (await import('cytoscape')).default;
      const fcose = (await import('cytoscape-fcose')).default;
      try { cytoscape.use(fcose); } catch { /* schon registriert */ }
      if (canceled || !hostRef.current) return;

      const elements = buildElements(data);
      const cy = cytoscape({
        container: hostRef.current,
        elements,
        style: GRAPH_STYLE,
        layout: layoutOptions('radial'),
        wheelSensitivity: 0.2,
        minZoom: 0.2,
        maxZoom: 4,
      });
      cy.on('mouseover', 'node', (e) => {
        const nb = e.target.closedNeighborhood();
        cy.elements().addClass('faded');
        nb.removeClass('faded').addClass('highlighted');
      });
      cy.on('mouseout', 'node', () => {
        cy.elements().removeClass('faded').removeClass('highlighted');
      });
      cy.on('tap', 'node', (e) => setFocus(e.target.id()));
      cy.on('tap', (e) => { if (e.target === cy) setFocus(null); });
      cyRef.current = cy;
      cy.ready(() => cy.fit(undefined, 60));
    })();
    return () => {
      canceled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Layout-Wechsel
  useEffect(() => {
    cyRef.current?.layout(layoutOptions(layout)).run();
  }, [layout]);

  // Auf URL-Fokus reagieren (Search → Sprung zu Knoten via Deep-Link)
  useEffect(() => {
    if (!focusId || !cyRef.current) return;
    const target = cyRef.current.getElementById(focusId);
    if (!target || target.length === 0) return;
    cyRef.current.elements().removeClass('faded').removeClass('search-hit').removeClass('highlighted');
    cyRef.current.elements().addClass('faded');
    target.closedNeighborhood().removeClass('faded').addClass('highlighted');
    target.addClass('search-hit');
    cyRef.current.animate({ center: { eles: target }, zoom: 1.6 }, { duration: 500 });
  }, [focusId]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute top-14 inset-x-0 bottom-0 cy-host"
        role="img"
        aria-label="Interaktiver Graph der Stadtverwaltung – nicht barrierefrei. Bitte zur Liste wechseln."
      />
      <Toolbar
        layout={layout}
        onLayoutChange={setLayout}
        onCenter={() => {
          const cy = cyRef.current;
          if (!cy) return;
          cy.animate({ center: { eles: cy.getElementById('stadtrat') }, zoom: 1 }, { duration: 500 });
        }}
        onFit={() => cyRef.current?.fit(undefined, 40)}
      />
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-[var(--color-mute)] pointer-events-none z-[8]">
        {t('Hint')}
      </div>
    </>
  );
}

function Toolbar({
  layout, onLayoutChange, onCenter, onFit,
}: {
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  onCenter: () => void;
  onFit: () => void;
}) {
  const btn = (active: boolean) =>
    'px-2.5 py-1.5 text-xs rounded border ' +
    (active
      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
      : 'bg-transparent text-[var(--color-ink)] border-[var(--color-line)] hover:bg-[var(--color-bg)]');
  return (
    <div role="toolbar" aria-label="Diagramm-Werkzeuge"
         className="fixed top-[64px] right-3 z-[9] flex flex-col gap-1.5 items-end">
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
      </div>
    </div>
  );
}

/* -------- Helpers -------- */

function buildElements(d: StadtData): ElementDefinition[] {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];
  nodes.push({ data: { id: d.center.id, label: d.center.name, type: 'center', level: 0 } });
  for (const dep of d.departments) {
    nodes.push({
      data: {
        id: dep.id, label: dep.name, fullName: dep.name, abbr: dep.id,
        vorsteher: dep.vorsteher, type: 'department', level: 1,
        budget: dep.budget, fte: dep.fte, odz: dep.odz,
      },
    });
    edges.push({ data: { id: `e-${d.center.id}-${dep.id}`, source: d.center.id, target: dep.id } });
  }
  for (const u of d.units) {
    const lvl = u.kind === 'extern' ? 3 : 2;
    nodes.push({
      data: {
        id: u.id, label: u.name, type: u.kind, level: lvl, parentDep: u.parent,
        budget: u.budget, fte: u.fte, odz: u.odz, konflikt: u.konflikt,
      },
    });
    edges.push({ data: { id: `e-${u.parent}-${u.id}`, source: u.parent, target: u.id } });
  }
  for (const b of d.beteiligungen) {
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

function layoutOptions(name: Layout): LayoutOptions {
  if (name === 'force') {
    // fcose-spezifische Optionen (nicht in den Cytoscape-Core-Typen)
    return {
      name: 'fcose', quality: 'default', animate: true, animationDuration: 800,
      nodeRepulsion: 6000, idealEdgeLength: 60, gravity: 0.15, nestingFactor: 0.6, randomize: false,
    } as unknown as LayoutOptions;
  }
  return {
    name: 'concentric',
    concentric: (n: NodeSingular) => 10 - (n.data('level') as number),
    levelWidth: () => 1,
    minNodeSpacing: 28,
    spacingFactor: 1.25,
    avoidOverlap: true, animate: true, animationDuration: 600,
  };
}

const GRAPH_STYLE: cytoscape.StylesheetStyle[] = [
  { selector: 'node', style: {
      'label': 'data(label)', 'font-size': 9,
      'text-valign': 'center', 'text-halign': 'center',
      'color': '#1a1f2e', 'text-outline-color': '#fff', 'text-outline-width': 2,
      'border-width': 1, 'border-color': 'rgba(0,0,0,.2)', 'width': 18, 'height': 18 } },
  { selector: 'node[type = "center"]', style: {
      'background-color': '#7a1f2b', 'shape': 'ellipse',
      'width': 70, 'height': 70, 'font-size': 13, 'color': '#fff', 'text-outline-color': '#7a1f2b' } },
  { selector: 'node[type = "department"]', style: {
      'background-color': '#e67e22', 'shape': 'round-rectangle',
      'width': 130, 'height': 54, 'font-size': 10, 'font-weight': 'bold',
      'color': '#fff', 'text-outline-color': '#e67e22',
      'text-wrap': 'wrap', 'text-max-width': '120', 'padding': '4' } },
  { selector: 'node[type = "unit"]', style: {
      'background-color': '#3b6ea5', 'shape': 'round-rectangle', 'width': 22, 'height': 16 } },
  { selector: 'node[type = "staff"]', style: {
      'background-color': '#8b5cf6', 'shape': 'round-rectangle', 'width': 22, 'height': 16 } },
  { selector: 'node[type = "extern"]', style: {
      'background-color': '#16a085', 'shape': 'diamond', 'width': 22, 'height': 22 } },
  { selector: 'node[type = "beteiligung"]', style: {
      'background-color': '#f1c40f', 'shape': 'diamond', 'width': 18, 'height': 18 } },
  { selector: 'edge', style: {
      'width': 1, 'line-color': '#c8cdda', 'curve-style': 'bezier',
      'target-arrow-shape': 'none', 'opacity': 0.6 } },
  { selector: 'edge[?dashed]', style: { 'line-style': 'dashed', 'opacity': 0.45 } },
  { selector: '.faded',       style: { 'opacity': 0.12, 'text-opacity': 0.1 } },
  { selector: '.highlighted', style: { 'border-width': 3, 'border-color': '#1f3a8a', 'opacity': 1 } },
  { selector: '.search-hit',  style: { 'border-width': 4, 'border-color': '#ff4081' } },
  { selector: 'node[?konflikt]', style: {
      'border-width': 2.5, 'border-color': '#e67e22', 'border-style': 'dashed' } },
];
