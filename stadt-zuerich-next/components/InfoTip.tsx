'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Zugängliche Kurz-Erklärung für Fachbegriffe (Nettoaufwand, FTE, Kürzel …).
 *
 * Anders als die verbreiteten `title=`-Tooltips ist InfoTip tastatur- UND
 * touch-bedienbar: ein echtes <button> öffnet die Erklärung bei Focus, Hover
 * oder Klick/Tap; Escape und Klick ausserhalb schliessen. Die Erklärung wird
 * per aria-describedby mit dem Button verknüpft, damit Screenreader sie
 * ansagen. Entstanden aus UX-Audit-Finding USE-002.
 *
 * Bewusst ohne Portale/Fremd-Lib gehalten — für eine 240px-Sprechblase wäre
 * das überdimensioniert. Die Blase bekommt pointer-events:none, damit sie den
 * Hover nicht selbst kapert.
 */
export default function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // 24×24 Hit-Area (WCAG 2.5.8), Glyph optisch kleiner. cursor-help
        // signalisiert Erklärung wie an den bestehenden title-Stellen.
        className="inline-flex items-center justify-center w-6 h-6 -my-1 rounded-full text-[11px] leading-none text-[var(--color-accent)] cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute z-50 left-1/2 -translate-x-1/2 top-[calc(100%+4px)] w-max max-w-[240px] px-2 py-1.5 rounded bg-[var(--color-ink)] text-[var(--color-panel)] text-[11px] font-normal normal-case tracking-normal leading-snug text-left shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
