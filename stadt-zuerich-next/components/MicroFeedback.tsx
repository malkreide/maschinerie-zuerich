'use client';

import { useState } from 'react';

export default function MicroFeedback({ contextId, contextName }: { contextId: string, contextName: string }) {
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleFeedback = async (isHelpful: boolean) => {
    setSubmitted(true);
    
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isHelpful, contextId, contextName }),
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (submitted) {
    return (
      <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-center text-[12px] text-[var(--color-status-positive)]">
        Danke für dein Feedback!
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] flex items-center justify-between text-[12px]">
      <span className="text-[var(--color-mute)]">War diese Information hilfreich?</span>
      <div className="flex gap-1.5">
        <button 
          onClick={() => handleFeedback(true)}
          className="p-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors bg-transparent border-0 text-base leading-none"
          title="Ja, hilfreich"
          aria-label="Ja, hilfreich"
        >
          👍
        </button>
        <button 
          onClick={() => handleFeedback(false)}
          className="p-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors bg-transparent border-0 text-base leading-none"
          title="Nein, eher nicht"
          aria-label="Nein, eher nicht"
        >
          👎
        </button>
      </div>
    </div>
  );
}
