'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FEEDBACK_CATEGORIES, FEEDBACK_COMMENT_MAX, type FeedbackCategory } from '@/lib/feedback';

type Phase = 'ask' | 'form' | 'done';

// contextName bleibt aus Kompatibilität in der Signatur, wird aber bewusst
// NICHT an die API gesendet (Datenminimierung — contextId genügt).
export default function MicroFeedback({ contextId }: { contextId: string; contextName?: string }) {
  const t = useTranslations('Feedback');
  const locale = useLocale();
  const hpId = useId();
  const [phase, setPhase] = useState<Phase>('ask');
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [sending, setSending] = useState(false);

  async function send(payload: Record<string, unknown>) {
    setSending(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, locale, website, ...payload }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSending(false);
      setPhase('done');
    }
  }

  if (phase === 'done') {
    return (
      <div
        role="status"
        className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-center text-[12px] text-[var(--color-status-positive)]"
      >
        {t('thanks')}
      </div>
    );
  }

  if (phase === 'ask') {
    return (
      <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] flex items-center justify-between gap-2 text-[12px]">
        <span className="text-[var(--color-mute)]">{t('question')}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={sending}
            onClick={() => send({ helpful: true })}
            className="px-2 py-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors bg-transparent border border-[var(--color-line)] leading-none"
            aria-label={t('yes')}
          >
            👍<span className="sr-only">{t('yes')}</span>
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => setPhase('form')}
            className="px-2 py-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors bg-transparent border border-[var(--color-line)] leading-none"
            aria-label={t('no')}
          >
            👎<span className="sr-only">{t('no')}</span>
          </button>
        </div>
      </div>
    );
  }

  // phase === 'form'
  return (
    <form
      className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-[12px]"
      onSubmit={(e) => {
        e.preventDefault();
        send({ helpful: false, category: category ?? undefined, comment: comment.trim() || undefined });
      }}
    >
      <div className="font-semibold text-[var(--color-ink)] mb-1.5">{t('formIntro')}</div>
      <fieldset className="border-0 p-0 m-0 mb-2">
        <legend className="sr-only">{t('formIntro')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(active ? null : c)}
                className={
                  'px-2 py-0.5 rounded-full border text-[11px] cursor-pointer transition-colors ' +
                  (active
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink)] border-[var(--color-line)] hover:bg-black/5 dark:hover:bg-white/10')
                }
              >
                {t(`category.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor={`${hpId}-comment`} className="sr-only">{t('commentLabel')}</label>
      <textarea
        id={`${hpId}-comment`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={FEEDBACK_COMMENT_MAX}
        rows={2}
        placeholder={t('commentPlaceholder')}
        className="w-full resize-none border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] rounded px-2 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${hpId}-website`}>Website</label>
        <input
          id={`${hpId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <p className="text-[10px] text-[var(--color-mute)] mt-1.5 leading-snug">{t('privacy')}</p>

      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          disabled={sending}
          onClick={() => send({ helpful: false })}
          className="px-2 py-1 rounded text-[11px] text-[var(--color-mute)] hover:text-[var(--color-ink)] bg-transparent border-0 cursor-pointer"
        >
          {t('skip')}
        </button>
        <button
          type="submit"
          disabled={sending}
          className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--color-accent)] text-white cursor-pointer disabled:opacity-60"
        >
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
