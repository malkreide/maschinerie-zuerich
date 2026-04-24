'use client';

// Custom-Nodes für React Flow. Ein Node-Typ pro SchrittTyp.
// Wir halten die Optik bewusst sparsam: Rechteck/Raute/Pille reicht, damit
// Screenreader und Text-Browser das Wesentliche — Label und Dauer — sehen.

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchrittTyp } from '@/types/prozess';

export interface ProzessNodeData extends Record<string, unknown> {
  label: string;
  beschreibung?: string;
  akteurLabel: string;
  dauer?: string;
  kosten?: string;
  typ: SchrittTyp;
}

const baseClass =
  'px-3 py-2 text-[13px] leading-snug border bg-[var(--color-panel)] text-[var(--color-ink)] shadow-sm';

function Base({
  children,
  className = '',
  shape = 'rect',
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  shape?: 'rect' | 'pill' | 'diamond';
  ariaLabel: string;
}) {
  const shapeClass =
    shape === 'pill' ? 'rounded-full' : shape === 'diamond' ? 'rotate-45' : 'rounded-lg';
  const innerRotate = shape === 'diamond' ? '-rotate-45 flex items-center justify-center h-full w-full' : '';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`${baseClass} ${shapeClass} ${className} w-[200px] h-[80px] flex items-center`}
      style={shape === 'diamond' ? { width: 140, height: 140 } : undefined}
    >
      <div className={innerRotate}>{children}</div>
    </div>
  );
}

function MetaRow({ dauer, kosten }: { dauer?: string; kosten?: string }) {
  if (!dauer && !kosten) return null;
  return (
    <div className="mt-1 text-[11px] text-[var(--color-mute)] flex gap-2 flex-wrap">
      {dauer && <span aria-label={`Dauer ${dauer}`}>⏱ {dauer}</span>}
      {kosten && <span aria-label={`Kosten ${kosten}`}>CHF {kosten}</span>}
    </div>
  );
}

export function StartNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Base shape="pill" className="border-[var(--color-accent)] bg-[var(--color-accent)] text-white" ariaLabel={`Start: ${d.label}`}>
        <div className="w-full text-center font-semibold">{d.label}</div>
      </Base>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function EndeNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base shape="pill" className="border-[var(--color-line)] bg-[var(--color-bg)]" ariaLabel={`Ende: ${d.label}`}>
        <div className="w-full text-center font-semibold">{d.label}</div>
      </Base>
    </>
  );
}

export function InputNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base className="border-[var(--color-line)] border-l-4 border-l-[var(--color-accent)]" ariaLabel={`Input: ${d.label}`}>
        <div className="w-full">
          <div className="font-semibold">{d.label}</div>
          <MetaRow dauer={d.dauer} kosten={d.kosten} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function ProzessNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base className="border-[var(--color-line)]" ariaLabel={`Prozessschritt: ${d.label}`}>
        <div className="w-full">
          <div className="font-semibold">{d.label}</div>
          <MetaRow dauer={d.dauer} kosten={d.kosten} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function EntscheidungNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base shape="diamond" className="border-[var(--color-accent)] bg-[var(--color-panel)]" ariaLabel={`Entscheidung: ${d.label}`}>
        <div className="text-center text-[12px] font-semibold px-2" style={{ maxWidth: 120 }}>
          {d.label}
        </div>
      </Base>
      <Handle type="source" position={Position.Right} id="ja" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="nein" />
    </>
  );
}

export function LoopNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base className="border-dashed border-[var(--color-mute)]" ariaLabel={`Schleife: ${d.label}`}>
        <div className="w-full">
          <div className="font-semibold flex items-center gap-1"><span aria-hidden>↻</span>{d.label}</div>
          <MetaRow dauer={d.dauer} kosten={d.kosten} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
      <Handle type="source" position={Position.Top} id="back" />
    </>
  );
}

export function WartenNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base className="border-[var(--color-line)] italic" ariaLabel={`Wartezeit: ${d.label}`}>
        <div className="w-full">
          <div className="font-semibold flex items-center gap-1"><span aria-hidden>⏳</span>{d.label}</div>
          <MetaRow dauer={d.dauer} kosten={d.kosten} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export const nodeTypes = {
  start: StartNode,
  ende: EndeNode,
  input: InputNode,
  prozess: ProzessNode,
  entscheidung: EntscheidungNode,
  loop: LoopNode,
  warten: WartenNode,
};
