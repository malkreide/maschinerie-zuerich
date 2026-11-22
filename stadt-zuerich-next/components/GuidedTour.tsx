'use client';

// Einführungstour auf der Startseite (react-joyride 3).
//
// Bis 2026-11 war die Tour noch für react-joyride 2 geschrieben. Version 3
// kennt showProgress, showSkipButton, disableOverlayClose und
// disableCloseOnEsc nicht mehr als Props — sie wirkten nicht. Dazu:
//   • Farben fest von Joyride (weisser Tooltip), der Fliesstext aber mit
//     --color-ink: im Dunkelmodus hell auf weiss, kaum lesbar.
//   • Schritt 2 zeigte auf das ganze Organigramm; der Tooltip landete über
//     dem Bildschirmrand.
//   • Auf dem Handy gibt es kein Organigramm (MobileExplorer statt Graph):
//     Nach Schritt 1 erschien nichts mehr.
//   • Beacon «Open the dialog» in allen Sprachen, das X hiess «Los geht's»,
//     und das X beendete die Tour nicht, sondern sprang weiter.
//   • Der Autostart lief auf jeder Seite, auch dort, wo die Ziele fehlen.

import { useEffect, useState, type ReactNode } from 'react';
import { ACTIONS, Joyride, ORIGIN, STATUS, type EventData, type Step } from 'react-joyride';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { city } from '@/config/city.config';

const GESEHEN = 'mog-tour-seen';
// = Tailwind sm: Ab hier zeigt die Startseite das Organigramm, darunter den
// MobileExplorer (app/[locale]/(main)/page.tsx).
const BREIT = '(min-width: 40rem)';

type Lauf = {
  /** Zähler: neuer key = Joyride beginnt wieder bei Schritt 1. */
  nr: number;
  /** Über den Hilfe-Knopf gestartet: Tooltip sofort, ohne Beacon. */
  vonHand: boolean;
  breit: boolean;
};

function gesehen(): boolean {
  try { return localStorage.getItem(GESEHEN) !== null; } catch { return false; }
}

export default function GuidedTour() {
  const t = useTranslations('Onboarding');
  const tApp = useTranslations('App');
  const pathname = usePathname();
  const router = useRouter();
  const [lauf, setLauf] = useState<Lauf | null>(null);

  // Erstbesuch: nur auf der Startseite, dort stehen alle Ziele der Tour.
  // Zuerst nur der Beacon — er drängt sich nicht auf, bis man ihn anklickt.
  useEffect(() => {
    if (pathname !== '/' || gesehen()) return;
    const id = setTimeout(() => {
      if (gesehen()) return;
      setLauf((l) => l ?? { nr: 1, vonHand: false, breit: matchMedia(BREIT).matches });
    }, 1500);
    return () => clearTimeout(id);
  }, [pathname]);

  // Hilfe-Knopf im Header (Header.tsx): Tour von vorn, Tooltip sofort.
  useEffect(() => {
    const starten = () =>
      setLauf((l) => ({ nr: (l?.nr ?? 0) + 1, vonHand: true, breit: matchMedia(BREIT).matches }));
    const oeffnen = () => {
      if (pathname !== '/') {
        router.push('/');
        setTimeout(starten, 500);
      } else {
        starten();
      }
    };
    window.addEventListener('mog:onboarding:reopen', oeffnen);
    return () => window.removeEventListener('mog:onboarding:reopen', oeffnen);
  }, [pathname, router]);

  if (!lauf) return null;

  const beimEreignis = (data: EventData) => {
    const ende =
      data.status === STATUS.FINISHED ||
      data.status === STATUS.SKIPPED ||
      // Escape: Joyride schlösse nur den Schritt und zeigte beim nächsten
      // wieder einen Beacon. Wer Escape drückt, will die Tour beenden.
      (data.action === ACTIONS.CLOSE && data.origin === ORIGIN.KEYBOARD);
    if (!ende) return;
    setLauf(null);
    try { localStorage.setItem(GESEHEN, 'true'); } catch { /* privat: Tour kommt wieder */ }
  };

  // Titel als Joyride-«title»: Der Tooltip (role="alertdialog") bekommt damit
  // aria-labelledby auf den Titel. Vorher klebte sein Name aus Eyebrow, Titel
  // und Text ohne Leerzeichen zusammen. Die Eyebrow («1 · Suchen») ist für
  // Screenreader doppelt (Fortschritt steht im Weiter-Knopf), darum aria-hidden.
  const kopf = (eyebrow: string, titel: string): ReactNode => (
    <>
      <span aria-hidden="true" className="block mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
        {eyebrow}
      </span>
      {titel}
    </>
  );
  const text = (s: string): ReactNode => <p className="m-0 text-sm leading-relaxed">{s}</p>;

  const steps: Step[] = [
    {
      target: 'div[role="search"]',
      title: kopf(t('step1Eyebrow'), t('step1Title')),
      content: text(t('step1Body')),
      placement: 'bottom-start',
    },
    lauf.breit
      ? {
          // Das Organigramm füllt den Bildschirm: Tooltip in die Mitte,
          // sonst landet er über dem Rand.
          target: '.cy-host',
          title: kopf(t('step2Eyebrow'), t('step2Title')),
          content: text(t('step2Body')),
          placement: 'center',
        }
      : {
          // Handy: Liste der Departemente statt Organigramm, Tippen statt Hover.
          target: '[data-tour="verwaltung"]',
          title: kopf(t('step2Eyebrow'), t('step2Title')),
          content: text(t('step2BodyMobile')),
          placement: 'center',
        },
    {
      target: 'header nav',
      title: kopf(t('step3Eyebrow'), t('step3Title')),
      content: text(t('step3Body')),
      placement: 'bottom',
    },
  ];

  return (
    <Joyride
      key={lauf.nr}
      run
      continuous
      steps={steps}
      onEvent={beimEreignis}
      options={{
        // Hex nötig: Joyride rechnet daraus den Ring des Beacons (hexToRGB).
        primaryColor: city.theme.accent,
        // Tooltip in den Farben des Themes, hell wie dunkel.
        backgroundColor: 'var(--color-panel)',
        textColor: 'var(--color-ink)',
        arrowColor: 'var(--color-panel)',
        zIndex: 10000,
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
        // Das X beendet die Tour (Joyride-Standard: nächster Schritt).
        closeButtonAction: 'skip',
        overlayClickAction: false,
        dismissKeyAction: 'close',
        skipBeacon: lauf.vonHand,
        // Das Organigramm lädt erst nach der Hydration (GraphLoader).
        targetWaitTimeout: 5000,
      }}
      styles={{
        tooltipContainer: { textAlign: 'left' },
        tooltipTitle: { fontSize: 16, fontWeight: 700, marginRight: 24 },
        // Joyride setzt die Schrift des Hauptknopfs auf die Tooltip-Farbe;
        // im Dunkelmodus wäre das dunkel auf der hellen Akzentfarbe.
        buttonPrimary: { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)', fontSize: 14, whiteSpace: 'nowrap' },
        buttonBack: { color: 'var(--color-accent)', fontSize: 14, whiteSpace: 'nowrap' },
        buttonSkip: { color: 'var(--color-mute)', fontSize: 14, whiteSpace: 'nowrap' },
        // Wird es eng (Handy, lange Übersetzung), bricht die Zeile zwischen
        // den Knöpfen um, nicht mitten im Knopf.
        tooltipFooter: { flexWrap: 'wrap', gap: 4 },
      }}
      locale={{
        open: tApp('helpButton'),
        back: t('back'),
        next: t('next'),
        // «Weiter (1 von 3)»: Joyride ersetzt {current} und {total}. Ohne
        // «Schritt», sonst bricht der Knopf auf dem Handy um; die Eyebrow
        // («2 · Erkunden») zeigt den Schritt ohnehin.
        nextWithProgress: `${t('next')} (${t('progress', { current: '{current}', total: '{total}' })})`,
        last: t('done'),
        close: t('close'),
        skip: t('skip'),
      }}
    />
  );
}
