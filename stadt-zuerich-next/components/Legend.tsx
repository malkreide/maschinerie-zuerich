import { useTranslations } from 'next-intl';

export default function Legend() {
  const t = useTranslations('Legend');
  return (
    <aside
      aria-label={t('headingTop')}
      className="fixed left-3 bottom-3 z-[9] bg-[var(--color-panel)] px-3 py-2.5 rounded-lg shadow text-xs max-w-[320px]"
    >
      <Heading>{t('headingTop')}</Heading>
      <Row color="#7a1f2b" round>{t('stadtpraesidium')}</Row>
      <Row color="#c0392b" round>{t('stadtrat')}</Row>
      <Row color="#e67e22" sq>{t('departement')}</Row>

      <Heading mt>{t('headingUnits')}</Heading>
      <Row color="#3b6ea5" sq>{t('dienstabteilung')}</Row>
      <Row color="#8b5cf6" sq>{t('stab')}</Row>

      <Heading mt>{t('headingExtern')}</Heading>
      <Row color="#16a085" dia>{t('verselbst')}</Row>
      <Row color="#f1c40f" dia>{t('beteiligung')}</Row>

      <Heading mt>{t('headingMarker')}</Heading>
      <Row dashed>{t('konflikt')}</Row>
    </aside>
  );
}

function Heading({ children, mt }: { children: React.ReactNode; mt?: boolean }) {
  return (
    <h4 className={`m-0 text-[11px] uppercase text-[var(--color-mute)] tracking-wider font-semibold ${mt ? 'mt-2' : ''} mb-1`}>
      {children}
    </h4>
  );
}

function Row({
  color, sq, dia, round, dashed, children,
}: {
  color?: string; sq?: boolean; dia?: boolean; round?: boolean; dashed?: boolean;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = dashed
    ? { background: 'transparent', border: '2px dashed #e67e22', width: 14, height: 14, borderRadius: 3 }
    : {
        background: color,
        width: dia ? 11 : 14,
        height: dia ? 11 : 14,
        borderRadius: round ? '50%' : (sq ? 3 : 0),
        transform: dia ? 'rotate(45deg)' : undefined,
        border: '1px solid rgba(0,0,0,.1)',
      };
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div style={style} />
      <span>{children}</span>
    </div>
  );
}
