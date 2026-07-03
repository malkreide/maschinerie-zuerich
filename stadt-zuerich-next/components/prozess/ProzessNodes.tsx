'use client';

// Custom-Nodes für React Flow. Ein Node-Typ pro SchrittTyp.
// Wir halten die Optik bewusst sparsam: Rechteck/Raute/Pille reicht, damit
// Screenreader und Text-Browser das Wesentliche — Label und Referenzen — sehen.
//
// Kardinalregel (docs/process-data-contract.md): bindende Werte (Fristen,
// Gebühren) erscheinen im Node NUR als Link auf die amtliche Quelle, nie
// als Zahl.

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchrittTyp } from '@/types/prozess';

export interface ProzessNodeReferenz {
  label: string;
  /** Bereits durch safeUrl() geprüfte Quell-URL (lib/safe-url.ts).
   *  undefined = URL unsicher/fehlend → Label wird als Text gerendert. */
  url?: string;
  /** true = Beleg noch nicht wörtlich gegen die Quelle geprüft. Wird im Node
   *  dezent als „ungeprüft" markiert — nie als bestätigter Wert dargestellt
   *  (Kardinalregel). */
  unverifiziert?: boolean;
}

export interface ProzessNodeData extends Record<string, unknown> {
  label: string;
  beschreibung?: string;
  akteurLabel: string;
  referenzen?: ProzessNodeReferenz[];
  /** i18n-Wort für unverifizierte Referenzen (server-seitig aufgelöst). */
  referenzUnverifiziertLabel?: string;
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

function MetaRow({
  referenzen,
  unverifiziertLabel,
}: {
  referenzen?: ProzessNodeReferenz[];
  unverifiziertLabel?: string;
}) {
  if (!referenzen || referenzen.length === 0) return null;
  return (
    <div className="mt-1 text-[11px] flex gap-2 flex-wrap">
      {referenzen.map((r) => {
        const marker = r.unverifiziert && (
          // Kompakter „ungeprüft"-Marker im Node; der volle Hinweis steht im
          // title-Tooltip und ausgeschrieben in der textuellen Schrittliste.
          <span className="text-amber-700" aria-label={unverifiziertLabel}>⚠ </span>
        );
        return r.url ? (
          <a
            key={`${r.url}|${r.label}`}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline decoration-dotted hover:decoration-solid"
            title={r.unverifiziert ? unverifiziertLabel : undefined}
          >
            {marker}
            {r.label} ↗
          </a>
        ) : (
          <span
            key={`|${r.label}`}
            className="text-[var(--color-accent)]"
            title={r.unverifiziert ? unverifiziertLabel : undefined}
          >
            {marker}
            {r.label}
          </span>
        );
      })}
    </div>
  );
}

export function StartNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  return (
    <>
      <Base shape="pill" className="border-[var(--color-accent)] bg-[var(--color-accent)] text-white" ariaLabel={`Start: ${d.label}`}>
        <div className="w-full text-center font-semibold line-clamp-2">{d.label}</div>
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
        <div className="w-full text-center font-semibold line-clamp-2">{d.label}</div>
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
          <div className="font-semibold line-clamp-2">{d.label}</div>
          <MetaRow referenzen={d.referenzen} unverifiziertLabel={d.referenzUnverifiziertLabel} />
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
          <div className="font-semibold line-clamp-2">{d.label}</div>
          <MetaRow referenzen={d.referenzen} unverifiziertLabel={d.referenzUnverifiziertLabel} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function EntscheidungNode({ data }: NodeProps) {
  const d = data as ProzessNodeData;
  // Drei Quell-Handles an den Rauten-Ecken (rechts/unten/oben). Welche Kante
  // welches Handle nutzt, entscheidet die Geometrie in ProzessFlow (Ziel in
  // tieferer/höherer/gleicher Swimlane) — nicht der Bedingungstext. So
  // verteilen sich auch mehrwertige Verzweigungen kollisionsfrei.
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Base shape="diamond" className="border-[var(--color-accent)] bg-[var(--color-panel)]" ariaLabel={`Entscheidung: ${d.label}`}>
        <div className="text-center text-[12px] font-semibold px-2" style={{ maxWidth: 120 }}>
          {d.label}
        </div>
      </Base>
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="down" />
      <Handle type="source" position={Position.Top} id="up" />
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
          <MetaRow referenzen={d.referenzen} unverifiziertLabel={d.referenzUnverifiziertLabel} />
        </div>
      </Base>
      <Handle type="source" position={Position.Right} />
      {/* Rücksprung-Kante (loops_back_to) verlässt den Schritt oben — in
          ProzessFlow eigens gestrichelt/animiert gezeichnet. */}
      <Handle type="source" position={Position.Top} id="loop-out" />
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
          <MetaRow referenzen={d.referenzen} unverifiziertLabel={d.referenzUnverifiziertLabel} />
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
