'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StadtData } from '@/types/stadt';

export default function ListFocusSync({ data }: { data: StadtData }) {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');

  useEffect(() => {
    if (!focusId) return;
    
    const u = data.units.find((x) => x.id === focusId);
    const b = data.beteiligungen.find((x) => x.id === focusId);
    const parentId = u?.parent ?? b?.verbunden;
    
    if (parentId) {
      const parentEl = document.getElementById(`dep-${parentId}`) as HTMLDetailsElement | null;
      if (parentEl) parentEl.open = true;
    }
    
    const targetId = u ? `unit-${focusId}` : (b ? `bet-${focusId}` : `dep-${focusId}`);
    const targetEl = document.getElementById(targetId) as HTMLDetailsElement | null;
    
    if (targetEl) {
      targetEl.open = true;
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Highlight-Effekt
        const originalBg = targetEl.style.backgroundColor;
        targetEl.style.backgroundColor = 'var(--color-panel)';
        targetEl.style.transition = 'background-color 0.5s ease-out';
        
        setTimeout(() => {
          targetEl.style.backgroundColor = originalBg;
        }, 1500);
      }, 100);
    }
  }, [focusId, data]);

  return null;
}
