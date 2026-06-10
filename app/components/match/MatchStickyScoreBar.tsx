import { useI18n } from '../../lib/i18n/I18nContext';
import { TeamNameWithFlag } from '../team/TeamNameWithFlag';

type Props = {
  home: string;
  away: string;
  homeCountryCode?: string | null;
  awayCountryCode?: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | null;
  visible: boolean;
};

export function MatchStickyScoreBar({
  home,
  away,
  homeCountryCode,
  awayCountryCode,
  homeScore,
  awayScore,
  status,
  minute,
  visible,
}: Props) {
  const { t } = useI18n();
  if (!visible) return null;

  const statusLabel =
    status === 'live'
      ? minute != null
        ? `${t('common.live')} ${minute}'`
        : t('common.live')
      : status === 'completed'
        ? t('common.ft')
        : status === 'scheduled'
          ? t('match.scheduled')
          : status.toUpperCase();

  return (
    <div
      className="sticky top-0 z-30 -mx-4 border-b border-cyan/20 bg-background/95 px-4 py-2 backdrop-blur-md md:hidden"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <TeamNameWithFlag
          name={home}
          flagName={home}
          countryCode={homeCountryCode}
          className="min-w-0 flex-1 justify-end text-xs font-medium"
          flagClassName="h-4 w-6 rounded-sm object-cover"
        />
        <div className="shrink-0 text-center">
          <p className="font-display text-lg tabular-nums leading-none">
            {homeScore}
            <span className="mx-0.5 text-cyan/60">–</span>
            {awayScore}
          </p>
          <p
            className={`mt-0.5 font-mono-data text-[10px] uppercase tracking-wider ${
              status === 'live' ? 'text-live' : 'text-muted'
            }`}
          >
            {statusLabel}
          </p>
        </div>
        <TeamNameWithFlag
          name={away}
          flagName={away}
          countryCode={awayCountryCode}
          className="min-w-0 flex-1 text-xs font-medium"
          flagClassName="h-4 w-6 rounded-sm object-cover"
        />
      </div>
    </div>
  );
}
