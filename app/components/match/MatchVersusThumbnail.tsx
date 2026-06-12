import { flagImageUrl, resolveTeamFlagSlug } from '../../lib/nationFlags';
import { matchThumbnailUrl } from '../../lib/matchThumbnail';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  homeName: string;
  awayName: string;
  homeCountryCode?: string | null;
  awayCountryCode?: string | null;
  matchRef: string;
  variant?: 'card' | 'hero' | 'compact';
  className?: string;
};

export function MatchVersusThumbnail({
  homeName,
  awayName,
  homeCountryCode,
  awayCountryCode,
  matchRef,
  variant = 'card',
  className = '',
}: Props) {
  const { t } = useI18n();
  const alt = t('match.thumbAlt')
    .replace('{home}', homeName)
    .replace('{away}', awayName);

  if (variant === 'hero' || variant === 'card') {
    return (
      <img
        src={matchThumbnailUrl(matchRef)}
        alt={alt}
        width={1200}
        height={630}
        loading="lazy"
        decoding="async"
        className={
          variant === 'hero'
            ? `w-full rounded-xl border border-border/60 object-cover shadow-lg ${className}`
            : `aspect-[1200/630] w-full rounded-lg border border-border/50 object-cover ${className}`
        }
      />
    );
  }

  const homeSlug = resolveTeamFlagSlug({ countryCode: homeCountryCode, teamName: homeName });
  const awaySlug = resolveTeamFlagSlug({ countryCode: awayCountryCode, teamName: awayName });
  const homeFlag = homeSlug ? flagImageUrl(homeSlug, 80) : '';
  const awayFlag = awaySlug ? flagImageUrl(awaySlug, 80) : '';

  return (
    <div
      className={`relative flex aspect-[5/3] min-w-[4.5rem] items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#071014] via-[#0d1520] to-[#111827] ring-1 ring-border/60 ${className}`}
      aria-hidden
    >
      {homeFlag ? (
        <img
          src={homeFlag}
          alt=""
          className="absolute left-0 top-0 h-full w-[46%] object-cover opacity-90"
          loading="lazy"
        />
      ) : null}
      {awayFlag ? (
        <img
          src={awayFlag}
          alt=""
          className="absolute right-0 top-0 h-full w-[46%] object-cover opacity-90"
          loading="lazy"
        />
      ) : null}
      <span className="relative z-10 rounded-full bg-panel/90 px-1.5 py-0.5 font-mono-data text-[9px] font-bold text-foreground/90 ring-1 ring-border/80">
        VS
      </span>
    </div>
  );
}
