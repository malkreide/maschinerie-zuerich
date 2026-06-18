'use client';

// Haupt-Visualisierung eines Prozesses mit React Flow.
// Zeichnet Swimlanes als Hintergrund-Rechtecke (via Background + absolute
// divs), Nodes mit Custom-Renderern (nodeTypes), Edges mit Labels aus
// 'bedingung'.
//
// Eingabe ist eine bereits serverseitig i18n-aufgelöste Projektion des
// Prozesses — so bleibt die Client-Bundle klein und wir müssen resolveI18n
// nicht im Client ausführen.

import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type ColorMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, type ProzessNodeData, type ProzessNodeReferenz } from './ProzessNodes';
import type { Layout, LayoutLane } from '@/lib/prozess-layout';
import type { SchrittTyp } from '@/types/prozess';

export interface ProzessFlowSchritt {
  id: string;
  typ: SchrittTyp;
  akteurId: string;
  label: string;
  beschreibung?: string;
  /** Bindende Werte des Schritts — nur als Label + Link (Kardinalregel). */
  referenzen?: ProzessNodeReferenz[];
  akteurLabel: string;
  /** Wenn der Akteur per einheit_ref auf eine Org-Chart-Einheit verweist:
   *  href zur Hauptansicht mit ?focus=<id>. Sonst undefined. */
  akteurEinheitHref?: string;
  /** Name der Einheit aus data.json — für Title/Tooltip und a11y. */
  akteurEinheitName?: string;
}

export interface ProzessFlowKante {
  id: string;
  von: string;
  nach: string;
  label?: string;
  bedingung?: string;
}

export interface ProzessFlowAkteur {
  id: string;
  label: string;
  typ: string;
  /** Wenn der Akteur per einheit_ref auf eine Einheit im Org-Chart verweist:
   *  Link zur Hauptansicht mit ?focus=<id>. Sonst undefined. */
  einheitHref?: string;
  /** Kanonischer Name der Einheit aus data.json — für Screenreader-Label
   *  und als Link-Text in der Swimlane. */
  einheitName?: string;
}

/** Ein Eintrag der Diagramm-Legende: ein Schritt-Typ und sein bereits
 *  i18n-aufgelöstes Label. Server-seitig gefüllt (nur die tatsächlich im
 *  Prozess vorkommenden Typen), damit die Client-Komponente next-intl-frei
 *  bleibt. */
export interface ProzessLegendeItem {
  typ: SchrittTyp;
  label: string;
}

export interface ProzessFlowProps {
  titel: string;
  schritte: ProzessFlowSchritt[];
  kanten: ProzessFlowKante[];
  akteure: ProzessFlowAkteur[];
  layout: Layout;
  colorMode?: ColorMode;
  /** Server-seitig i18n-aufgelöster Tooltip für Einheit-Links in der
   *  Swimlane. Erhält {name} als Platzhalter und wird via String.replace
   *  gefüllt — so bleibt die Client-Komponente frei von next-intl. */
  goToUnitLabelTemplate?: string;
  /** Legende: Überschrift + die im Prozess vorkommenden Schritt-Typen.
   *  Erklärt die Formen-Sprache des Diagramms (Pille = Start/Ende,
   *  Raute = Entscheidung, gestrichelt = Rücksprung …). */
  legendeHeading?: string;
  legende?: ProzessLegendeItem[];
}

export default function ProzessFlow(props: ProzessFlowProps) {
  return (
    <ReactFlowProvider>
      <ProzessFlowInner {...props} />
    </ReactFlowProvider>
  );
}

function ProzessFlowInner({ titel, schritte, kanten, akteure, layout, colorMode = 'light', goToUnitLabelTemplate, legendeHeading, legende }: ProzessFlowProps) {
  const nodes = useMemo<Node<ProzessNodeData>[]>(() => {
    const processNodes: Node<ProzessNodeData>[] = schritte.map((s) => {
      const ln = layout.nodes.find((n) => n.id === s.id);
      return {
        id: s.id,
        type: s.typ,
        position: { x: ln?.x ?? 0, y: ln?.y ?? 0 },
        data: {
          label: s.label,
          beschreibung: s.beschreibung,
          akteurLabel: s.akteurLabel,
          referenzen: s.referenzen,
          typ: s.typ,
        },
        draggable: false,
      };
    });

    // Unsichtbare Boundary-Nodes einfügen, damit 'fitView' den linken Rand
    // für die Swimlane-Labels und den unteren Rand für die Controls freihält.
    processNodes.push(
      {
        id: 'boundary-tl',
        type: 'start',
        position: { x: 0, y: 0 },
        data: { label: '', typ: 'start' as SchrittTyp, akteurLabel: '' },
        style: { opacity: 0, pointerEvents: 'none' },
        selectable: false,
        draggable: false,
      },
      {
        id: 'boundary-br',
        type: 'start',
        position: { x: layout.width, y: layout.height + 60 },
        data: { label: '', typ: 'start' as SchrittTyp, akteurLabel: '' },
        style: { opacity: 0, pointerEvents: 'none' },
        selectable: false,
        draggable: false,
      }
    );

    return processNodes;
  }, [schritte, layout]);

  const edges = useMemo<Edge[]>(() => {
    return kanten.map((k) => ({
      id: k.id,
      source: k.von,
      target: k.nach,
      label: k.label ?? k.bedingung,
      labelStyle: { fontSize: 11, fill: 'var(--color-mute)' },
      labelBgStyle: { fill: 'var(--color-bg)' },
      animated: k.bedingung === 'ja' || k.bedingung === 'nein' ? false : false,
      sourceHandle: k.bedingung === 'nein' ? 'nein' : undefined,
      style: {
        stroke: k.bedingung === 'nein' ? 'var(--color-mute)' : 'var(--color-ink)',
        strokeDasharray: k.bedingung === 'nein' ? '4 4' : undefined,
      },
    }));
  }, [kanten]);

  return (
    <div>
      {legende && legende.length > 0 && (
        <ProzessLegende heading={legendeHeading} items={legende} />
      )}
      <div
        className="relative w-full h-[calc(100vh-12rem)] min-h-[520px] border border-[var(--color-line)] rounded-lg overflow-hidden bg-[var(--color-bg)]"
        role="application"
        aria-label={`Prozess-Diagramm: ${titel}`}
      >
      <SwimlaneOverlay
        lanes={layout.lanes}
        akteure={akteure}
        height={layout.height}
        goToUnitLabelTemplate={goToUnitLabelTemplate}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        colorMode={colorMode}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} position="bottom-right" className="sm:mb-0 mb-4" />
        <MiniMap pannable zoomable ariaLabel="Übersichtskarte" />
      </ReactFlow>
      </div>
    </div>
  );
}

/** Legende: erklärt die Formen-Sprache des Diagramms. Reine Darstellung,
 *  daher mit kleinen Form-Swatches (aria-hidden) plus dem i18n-Label je
 *  Schritt-Typ. Wird über der Zeichenfläche gerendert, damit sie weder die
 *  Swimlane-Labels (links) noch Controls/MiniMap (unten rechts) überdeckt. */
function ProzessLegende({ heading, items }: { heading?: string; items: ProzessLegendeItem[] }) {
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--color-mute)]"
      role="group"
      aria-label={heading}
    >
      {heading && (
        <span className="text-[11px] uppercase tracking-wider font-semibold">{heading}</span>
      )}
      {items.map((it) => (
        <span key={it.typ} className="inline-flex items-center gap-1.5">
          <LegendeSwatch typ={it.typ} />
          <span className="text-[var(--color-ink)]">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Kleines Form-Symbol je Schritt-Typ, das die Node-Optik aus ProzessNodes
 *  spiegelt (Pille, Raute, gestrichelt …). Rein dekorativ → aria-hidden. */
function LegendeSwatch({ typ }: { typ: SchrittTyp }) {
  const common = 'inline-block w-3.5 h-3.5 border';
  switch (typ) {
    case 'start':
      return <span aria-hidden className={`${common} rounded-full border-[var(--color-accent)] bg-[var(--color-accent)]`} />;
    case 'ende':
      return <span aria-hidden className={`${common} rounded-full border-[var(--color-line)] bg-[var(--color-bg)]`} />;
    case 'input':
      return <span aria-hidden className={`${common} rounded-sm border-[var(--color-line)] border-l-[3px] border-l-[var(--color-accent)] bg-[var(--color-panel)]`} />;
    case 'entscheidung':
      return <span aria-hidden className="inline-block w-3 h-3 rotate-45 border border-[var(--color-accent)] bg-[var(--color-panel)]" />;
    case 'loop':
      return <span aria-hidden className={`${common} rounded-sm border-dashed border-[var(--color-mute)] bg-[var(--color-panel)]`} />;
    case 'warten':
      return <span aria-hidden className={`${common} rounded-sm border-[var(--color-line)] bg-[var(--color-panel)] italic`} />;
    case 'prozess':
    default:
      return <span aria-hidden className={`${common} rounded-sm border-[var(--color-line)] bg-[var(--color-panel)]`} />;
  }
}

/** Swimlane-Überlagerung: horizontale Bänder mit Akteur-Label links.
 *  Wird absolut positioniert, damit React Flow's Pan/Zoom sie nicht mitbewegt
 *  — hier akzeptiert; für präzise Synchronisation mit Pan müsste man die
 *  Lanes als NodeType rendern. Kompromiss zugunsten Einfachheit. */
function SwimlaneOverlay({
  lanes,
  akteure,
  height,
  goToUnitLabelTemplate,
}: {
  lanes: LayoutLane[];
  akteure: ProzessFlowAkteur[];
  height: number;
  goToUnitLabelTemplate?: string;
}) {
  const akteurMap = new Map(akteure.map((a) => [a.id, a]));
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      style={{ height }}
    >
      {lanes.map((lane, i) => {
        const a = akteurMap.get(lane.akteurId);
        const label = a?.label ?? lane.akteurId;
        // Wenn per einheit_ref verlinkt: Swimlane-Label wird zum Link auf die
        // Hauptansicht mit fokussierter Einheit. pointer-events-auto hebt
        // das pointer-events-none des Container-Overlays für genau dieses
        // Element auf, damit der Link klickbar bleibt.
        const title = a?.einheitName && goToUnitLabelTemplate
          ? goToUnitLabelTemplate.replace('{name}', a.einheitName)
          : a?.einheitName;
        const inner = a?.einheitHref ? (
          <a
            href={a.einheitHref}
            className="pointer-events-auto underline decoration-dotted hover:text-[var(--color-accent)]"
            title={title}
          >
            {label}
          </a>
        ) : (
          label
        );
        return (
          <div
            key={lane.akteurId}
            className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'bg-[var(--color-panel)]/30' : ''}`}
            style={{
              top: lane.y,
              height: lane.height,
              borderColor: 'var(--color-line)',
            }}
          >
            <div className="absolute left-2 top-2 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] max-w-[80px] sm:max-w-[140px] leading-tight break-words">
              {inner}
            </div>
          </div>
        );
      })}
    </div>
  );
}
