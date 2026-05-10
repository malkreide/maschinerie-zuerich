'use client';

import { useEffect, useState } from 'react';
import { Joyride, STATUS, Step } from 'react-joyride';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { city } from '@/config/city.config';

export default function GuidedTour() {
  const t = useTranslations('Onboarding');
  const pathname = usePathname();
  const router = useRouter();
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasSeen = localStorage.getItem('mog-tour-seen');
    if (!hasSeen) {
      // Kurze Verzögerung, damit die UI gerendert ist
      setTimeout(() => setRun(true), 1500);
    }
    
    const handleStartTour = () => {
      if (pathname !== '/') {
        router.push('/');
        setTimeout(() => setRun(true), 500);
      } else {
        setRun(true);
      }
    };
    window.addEventListener('mog:onboarding:reopen', handleStartTour);
    return () => window.removeEventListener('mog:onboarding:reopen', handleStartTour);
  }, [pathname, router]);

  if (!mounted) return null;

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('mog-tour-seen', 'true');
    }
  };

  const steps: Step[] = [
    {
      target: 'div[role="search"]',
      content: (
        <div className="text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('step1Eyebrow')}</div>
          <h3 className="font-bold text-base mb-1.5">{t('step1Title')}</h3>
          <p className="text-sm m-0 leading-relaxed text-[var(--color-ink)]">{t('step1Body')}</p>
        </div>
      ),
      placement: 'bottom-start',
    },
    {
      target: '.cy-host',
      content: (
        <div className="text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('step2Eyebrow')}</div>
          <h3 className="font-bold text-base mb-1.5">{t('step2Title')}</h3>
          <p className="text-sm m-0 leading-relaxed text-[var(--color-ink)]">{t('step2Body')}</p>
        </div>
      ),
      placement: 'center',
    },
    {
      target: 'header nav',
      content: (
        <div className="text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] mb-1">{t('step3Eyebrow')}</div>
          <h3 className="font-bold text-base mb-1.5">{t('step3Title')}</h3>
          <p className="text-sm m-0 leading-relaxed text-[var(--color-ink)]">{t('step3Body')}</p>
        </div>
      ),
      placement: 'bottom',
    }
  ];

  return (
    <Joyride
      onEvent={handleJoyrideCallback}
      run={run}
      steps={steps}
      locale={{
        back: t('back'),
        close: t('done'),
        last: t('done'),
        next: t('next'),
        skip: t('skip'),
      }}
    />
  );
}
