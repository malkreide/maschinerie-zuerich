'use client';

// Guided Onboarding: ein dreistufiges, ausblendbares Tutorial. Erscheint
// beim ersten Besuch (kein localStorage-Marker gesetzt) und kann jederzeit
// über den «?»-Button im Header neu aufgerufen werden — letzteres läuft
// über ein Custom-Event, damit Header (Client) und Onboarding (Client) nicht
// gegenseitig Refs durchreichen müssen.
//
// Persistenz: localStorage-Key `mog-onboarding-seen-v1`. Versionierung im
// Suffix erlaubt es, das Tutorial nach grösseren UI-Änderungen erneut zu
// zeigen, ohne dass User:innen den Cache leeren müssen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'mog-onboarding-seen-v1';
const TOTAL_STEPS = 3;
export const REOPEN_EVENT = 'mog:onboarding:reopen';

type StepKey = 1 | 2 | 3;

const STEPS: readonly StepKey[] = [1, 2, 3];

export default function Onboarding() {
  const t = useTranslations('Onboarding');
  // open=null heisst "noch nicht entschieden" — wichtig fürs SSR, damit
  // Server und Client identische Hydration-Markup ergeben (nichts gerendert,
  // bis der useEffect das localStorage gelesen hat).
  const [open, setOpen] = useState<boolean>(false);
  const [step, setStep] = useState<StepKey>(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Den Knoten merken, der den Dialog geöffnet hat — Fokus springt nach
  // dem Schliessen dorthin zurück. Beim Auto-Open (erste Visit) ist das
  // null und der Browser setzt Fokus an seinen Standardpunkt.
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Initialer Check: Auto-Open beim ersten Besuch. localStorage darf nur
  // im Browser gelesen werden — daher zwingend in useEffect, nicht in
  // useState-Initializer (würde sonst Hydration-Mismatches geben).
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage gesperrt (Privacy-Mode, iframe, etc.) — dann zeigen
      // wir das Tutorial nicht automatisch, der «?»-Button bleibt aber.
      return;
    }
    if (!seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);

  // Manuelles Öffnen via Header-Button.
  useEffect(() => {
    function handler() {
      lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
      setStep(1);
      setOpen(true);
    }
    window.addEventListener(REOPEN_EVENT, handler);
    return () => window.removeEventListener(REOPEN_EVENT, handler);
  }, []);

  const close = useCallback(
    (markSeen: boolean) => {
      if (markSeen) {
        try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
      }
      setOpen(false);
      // Fokus zurück zum auslösenden Element — fällt sonst ins <body> und
      // bricht die Tastatur-Navigation ab.
      const target = lastFocusedRef.current;
      if (target && typeof target.focus === 'function') {
        // requestAnimationFrame, damit der Dialog erst aus dem DOM raus ist.
        requestAnimationFrame(() => target.focus());
      }
    },
    [],
  );

  // ESC zum Schliessen + simpler Focus-Trap auf erstes/letztes fokussierbares
  // Element. Bewusst ohne Fremd-Lib (focus-trap-react), das wäre für drei
  // Buttons übertrieben.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    // Initialer Fokus auf «Schliessen» — nicht auf «Weiter», damit User:innen
    // nicht versehentlich die Tour ohne Lesen klicken.
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const isFirst = step === 1;
  const isLast = step === TOTAL_STEPS;
  const eyebrow = t(`step${step}Eyebrow` as const);
  const title = t(`step${step}Title` as const);
  const body = t(`step${step}Body` as const);

  return (
    <div
      // Backdrop schluckt Klicks ausserhalb des Panels und schliesst die Tour
      // gleichzeitig — vertraute Modal-Konvention.
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close(true); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        aria-label={t('ariaLabel')}
        className="w-full max-w-md rounded-2xl bg-[var(--color-panel)] text-[var(--color-ink)] shadow-2xl border border-[var(--color-line)] overflow-hidden"
      >
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold">
              {eyebrow}
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => close(true)}
              aria-label={t('skip')}
              className="text-[var(--color-mute)] hover:text-[var(--color-ink)] text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
          <h2 id="onboarding-title" className="text-xl font-semibold m-0 mb-2">
            {title}
          </h2>
          <p id="onboarding-body" className="text-sm leading-relaxed text-[var(--color-mute)] m-0">
            {body}
          </p>
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-bg)] border-t border-[var(--color-line)]">
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label={t('stepLabel', { current: step, total: TOTAL_STEPS })}
          >
            {STEPS.map((s) => (
              <span
                key={s}
                aria-hidden="true"
                className={
                  'h-1.5 w-6 rounded-full transition-colors ' +
                  (s === step
                    ? 'bg-[var(--color-accent)]'
                    : s < step
                      ? 'bg-[var(--color-accent)]/50'
                      : 'bg-[var(--color-line)]')
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepKey) : s))}
                className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-line)] hover:bg-[var(--color-panel)]"
              >
                {t('back')}
              </button>
            )}
            {!isLast && (
              <button
                type="button"
                onClick={() => close(true)}
                className="px-3 py-1.5 text-sm rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              >
                {t('skip')}
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={() => close(true)}
                className="px-4 py-1.5 text-sm rounded-md bg-[var(--color-accent)] text-white font-semibold hover:opacity-90"
              >
                {t('done')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as StepKey) : s))}
                className="px-4 py-1.5 text-sm rounded-md bg-[var(--color-accent)] text-white font-semibold hover:opacity-90"
              >
                {t('next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
