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
import { nodeTypes, type ProzessNodeData } from './ProzessNodes';
import type { Layout, LayoutLane } from '@/lib/prozess-layout';
import type { SchrittTyp } from '@/types/prozess';

export interface ProzessFlowSchritt {
  id: string;
  typ: SchrittTyp;
  akteurId: string;
  label: string;
  beschreibung?: string;
  dauer?: string;
  kosten?: string;
  akteurLabel: string;
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
}

export interface ProzessFlowProps {
  titel: string;
  schritte: ProzessFlowSchritt[];
  kanten: ProzessFlowKante[];
  akteure: ProzessFlowAkteur[];
  layout: Layout;
  colorMode?: ColorMode;
}

export default function ProzessFlow(props: ProzessFlowProps) {
  return (
    <ReactFlowProvider>
      <ProzessFlowInner {...props} />
    </ReactFlowProvider>
  );
}

function ProzessFlowInner({ titel, schritte, kanten, akteure, layout, colorMode = 'light' }: ProzessFlowProps) {
  const nodes = useMemo<Node<ProzessNodeData>[]>(() => {
    return schritte.map((s) => {
      const ln = layout.nodes.find((n) => n.id === s.id);
      return {
        id: s.id,
        type: s.typ,
        position: { x: ln?.x ?? 0, y: ln?.y ?? 0 },
        data: {
          label: s.label,
          beschreibung: s.beschreibung,
          akteurLabel: s.akteurLabel,
          dauer: s.dauer,
          kosten: s.kosten,
          typ: s.typ,
        },
        draggable: false,
      };
    });
  }, [schritte, layout.nodes]);

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
    <div
      className="relative w-full h-[calc(100vh-12rem)] min-h-[520px] border border-[var(--color-line)] rounded-lg overflow-hidden bg-[var(--color-bg)]"
      role="application"
      aria-label={`Prozess-Diagramm: ${titel}`}
    >
      <SwimlaneOverlay lanes={layout.lanes} akteure={akteure} height={layout.height} />
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
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Übersichtskarte" />
      </ReactFlow>
    </div>
  );
}

/** Swimlane-Überlagerung: horizontale Bänder mit Akteur-Label links.
 *  Wird absolut positioniert, damit React Flow's Pan/Zoom sie nicht mitbewegt
 *  — hier akzeptiert; für präzise Synchronisation mit Pan müsste man die
 *  Lanes als NodeType rendern. Kompromiss zugunsten Einfachheit. */
function SwimlaneOverlay({
  lanes,
  akteure,
  height,
}: {
  lanes: LayoutLane[];
  akteure: ProzessFlowAkteur[];
  height: number;
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
            <div className="absolute left-2 top-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-mute)] max-w-[140px] leading-tight">
              {a?.label ?? lane.akteurId}
            </div>
          </div>
        );
      })}
    </div>
  );
}
