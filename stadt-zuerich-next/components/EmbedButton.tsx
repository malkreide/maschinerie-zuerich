'use client';

// Knopf «Grafik einbetten» und Dialog mit dem iframe-Code (/steuerfranken).
//
// Bis 2026-11 stand alles fest auf Deutsch (auch in en/fr/it/ls), in Du-Form,
// ohne Dunkelmodus und ohne Dialog-Semantik: kein role="dialog", der Fokus
// blieb auf dem Knopf, Escape schloss nicht, das Codefeld war unbeschriftet
// (axe «label», kritisch). Und weil der Dialog im Wrapper der Seite steckte
// (z-10, eigener Stapelkontext), lag das Suchfeld (z-[20]) über seinem
// Hintergrund.
//
// Darum das native <dialog> mit showModal(): Es liegt in der obersten Ebene
// des Browsers über jedem z-Index, macht den Rest der Seite inert, schliesst
// mit Escape und gibt den Fokus beim Schliessen an den Knopf zurück.

import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/lib/i18n-client';

// Text, der in den kopierten HTML-Code kommt, als HTML maskieren.
function html(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function EmbedButton({ embedPath, title }: {
  embedPath: string;
  /** Titel des iframes für Screenreader auf der einbettenden Seite. */
  title: string;
}) {
  const t = useT('Embed');
  const tApp = useT('App');
  const titelId = useId();
  const codeId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const kopierenRef = useRef<HTMLButtonElement>(null);
  const druckAufHintergrund = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [offen, setOffen] = useState(false);
  const [status, setStatus] = useState<'' | 'kopiert' | 'fehler'>('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (offen && !dialog.open) {
      dialog.showModal();
      kopierenRef.current?.focus();
    }
    if (!offen && dialog.open) dialog.close();
  }, [offen]);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  function baueCode() {
    const origin = window.location.origin;
    // Quellenhinweis je Sprache, der Link sitzt an der Stelle von {name}.
    const MARKE = '\u0000';
    const [vor, nach = ''] = t('quelle', { name: MARKE }).split(MARKE);
    return `<iframe
  src="${html(origin + embedPath)}"
  width="100%"
  height="600"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
  title="${html(title)}"
  allowfullscreen>
</iframe>
<p style="font-size: 12px; color: #666; font-family: sans-serif; text-align: right; margin-top: 4px;">
  ${html(vor)}<a href="${html(origin)}" target="_blank" rel="noopener noreferrer" style="color: #666; text-decoration: underline;">${html(tApp('title'))}</a>${html(nach)}
</p>`;
  }

  // Der Code hängt vom Origin ab und entsteht nur im offenen Dialog, also nur
  // im Browser — kein Server-Wert, der beim Hydrieren abweichen könnte.
  const code = offen ? baueCode() : '';

  async function kopieren() {
    clearTimeout(statusTimer.current);
    try {
      await navigator.clipboard.writeText(code);
      setStatus('kopiert');
      statusTimer.current = setTimeout(() => setStatus(''), 4000);
    } catch {
      // Ohne Zwischenablage-Zugriff (z. B. ohne HTTPS): Code markieren und
      // sagen, dass man selbst kopieren muss — statt «Kopiert!» zu melden.
      codeRef.current?.focus();
      codeRef.current?.select();
      setStatus('fehler');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] transition-colors"
      >
        <svg aria-hidden="true" className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {t('knopf')}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titelId}
        // Escape und close() lösen «close» aus: Zustand nachführen.
        onClose={() => { setOffen(false); setStatus(''); clearTimeout(statusTimer.current); }}
        // Klick auf den abgedunkelten Hintergrund trifft das dialog-Element
        // selbst. Nur schliessen, wenn auch der Druck dort begann: Wer im
        // Codefeld markiert und ausserhalb loslässt, verliert sonst den Dialog.
        onPointerDown={(e) => { druckAufHintergrund.current = e.target === e.currentTarget; }}
        onClick={(e) => { if (druckAufHintergrund.current && e.target === e.currentTarget) setOffen(false); }}
        className="m-auto p-0 border-0 w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg shadow-xl bg-[var(--color-panel)] text-[var(--color-ink)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {offen && (
          <div className="relative p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label={t('schliessen')}
              className="absolute top-3 right-3 p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <svg aria-hidden="true" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 id={titelId} className="m-0 pr-8 text-lg font-semibold leading-6">{t('titel')}</h2>
            <p className="mt-2 text-sm text-[var(--color-mute)]">{t('anleitung')}</p>

            <label htmlFor={codeId} className="block mt-4 mb-1 text-xs font-semibold text-[var(--color-mute)]">
              {t('codeLabel')}
            </label>
            <textarea
              id={codeId}
              ref={codeRef}
              readOnly
              value={code}
              onClick={(e) => e.currentTarget.select()}
              className="w-full h-40 p-3 font-mono text-sm rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {/* Rückmeldung zum Kopieren, sichtbar und für Screenreader angesagt. */}
            <p role="status" className="mt-2 min-h-5 text-sm text-[var(--color-mute)]">
              {status === 'kopiert' ? t('kopiert') : status === 'fehler' ? t('kopierenFehler') : ''}
            </p>

            <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOffen(false)}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:bg-[var(--color-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {t('schliessen')}
              </button>
              <button
                type="button"
                ref={kopierenRef}
                onClick={kopieren}
                className="inline-flex justify-center px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
              >
                {t('kopieren')}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
