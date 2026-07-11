import { compactTeamLabel } from '../../lib/matchTeams';
import { isPlaceholderTeam } from '../../lib/matchTeamDisplay';
import {
  DEFAULT_FLAG_IMG_CLASS,
  flagImageUrl,
  resolveTeamFlagSlug,
} from '../../lib/nationFlags';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  name: string;
  /** Full team name for flag lookup when `name` is a 3-letter short code. */
  flagName?: string | null;
  countryCode?: string | null;
  compact?: boolean;
  className?: string;
  flagClassName?: string;
};

export function TeamNameWithFlag({
  name,
  flagName,
  countryCode,
  compact = false,
  className = '',
  flagClassName = DEFAULT_FLAG_IMG_CLASS,
}: Props) {
  const { t } = useI18n();
  const placeholder = isPlaceholderTeam(countryCode);
  const slug = placeholder
    ? ''
    : resolveTeamFlagSlug({
        countryCode,
        teamName: flagName?.trim() || name,
      });
  const flagSrc = slug ? flagImageUrl(slug, 40) : '';
  const flagSrc2x = slug ? flagImageUrl(slug, 80) : '';
  const label = placeholder ? t('common.tbd') : compact ? compactTeamLabel(name) : name;

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 ${className}`}>
      {flagSrc ? (
        <img
          src={flagSrc}
          srcSet={`${flagSrc} 1x, ${flagSrc2x} 2x`}
          alt=""
          aria-hidden
          width={22}
          height={15}
          loading="lazy"
          decoding="async"
          className={`shrink-0 ${flagClassName}`}
        />
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

type MatchProps = {
  homeName: string;
  awayName: string;
  homeCountryCode?: string | null;
  awayCountryCode?: string | null;
  homeShort?: string | null;
  awayShort?: string | null;
  separator?: string;
  className?: string;
  flagClassName?: string;
  /** Keep home/away on one line (board rows). */
  nowrap?: boolean;
  /** Shorter team labels for tight layouts. */
  compact?: boolean;
};

export function MatchTeamsWithFlags({
  homeName,
  awayName,
  homeCountryCode,
  awayCountryCode,
  homeShort,
  awayShort,
  separator = ' - ',
  className = '',
  flagClassName,
  nowrap = false,
  compact = false,
}: MatchProps) {
  return (
    <span
      className={`inline-flex items-center gap-x-0.5 ${nowrap ? 'max-w-full flex-nowrap' : 'flex-wrap'} ${className}`}
    >
      <TeamNameWithFlag
        name={homeShort?.trim() || homeName}
        flagName={homeName}
        countryCode={homeCountryCode}
        compact={compact}
        flagClassName={flagClassName}
        className="min-w-0 shrink"
      />
      <span className="shrink-0 text-muted">{separator.trim()}</span>
      <TeamNameWithFlag
        name={awayShort?.trim() || awayName}
        flagName={awayName}
        countryCode={awayCountryCode}
        compact={compact}
        flagClassName={flagClassName}
        className="min-w-0 shrink"
      />
    </span>
  );
}
