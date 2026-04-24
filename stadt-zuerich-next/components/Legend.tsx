import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/i18n/routing';
import { city } from '@/config/city.config';

export default function Legend({ locale }: { locale: Locale }) {
  const t = getT(locale, 'Legend');
  const c = city.theme.nodeType;
  return (
    <aside
      aria-label={t('headingTop')}
      className="fixed left-3 bottom-3 z-[9] bg-[var(--color-panel)] px-3 py-2.5 rounded-lg shadow text-xs max-w-[320px]"
    >
      <Heading>{t('headingTop')}</Heading>
      <Row color={c.stadtpraesidium} round>{t('stadtpraesidium')}</Row>
      <Row color={c.stadtrat} round>{t('stadtrat')}</Row>
      <Row color={c.department} sq>{t('departement')}</Row>

      <Heading mt>{t('headingUnits')}</Heading>
      <Row color={c.unit} sq>{t('dienstabteilung')}</Row>
      <Row color={c.staff} sq>{t('stab')}</Row>

      <Heading mt>{t('headingExtern')}</Heading>
      <Row color={c.extern} dia>{t('verselbst')}</Row>
      <Row color={c.beteiligung} dia>{t('beteiligung')}</Row>

      <Heading mt>{t('headingMarker')}</Heading>
      <Row dashed dashColor={city.theme.konflikt}>{t('konflikt')}</Row>
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
  color, sq, dia, round, dashed, dashColor, children,
}: {
  color?: string; sq?: boolean; dia?: boolean; round?: boolean; dashed?: boolean;
  dashColor?: string;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = dashed
    ? { background: 'transparent', border: `2px dashed ${dashColor ?? 'currentColor'}`, width: 14, height: 14, borderRadius: 3 }
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
