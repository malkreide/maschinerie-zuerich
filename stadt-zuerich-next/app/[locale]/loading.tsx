import { useTranslations } from 'next-intl';

export default function Loading() {
  const t = useTranslations('App');
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--color-bg)] space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-line)] border-t-[var(--color-accent)]" />
      <p className="text-sm text-[var(--color-mute)] font-medium">Lade Strukturdaten...</p>
    </div>
  );
}
