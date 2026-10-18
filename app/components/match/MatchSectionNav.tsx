import type { RefObject } from 'react';
import { useI18n } from '../../lib/i18n/I18nContext';

export type MatchSectionId =
  | 'overview'
  | 'stats'
  | 'prediction'
  | 'momentum'
  | 'tactical'
  | 'scenarios';

const SECTION_KEYS: Record<MatchSectionId, 'match.tabOverview' | 'match.tabStats' | 'match.tabPrediction' | 'match.tabMomentum' | 'match.tabTactical' | 'match.tabScenarios'> = {
  overview: 'match.tabOverview',
  stats: 'match.tabStats',
  prediction: 'match.tabPrediction',
  momentum: 'match.tabMomentum',
  tactical: 'match.tabTactical',
  scenarios: 'match.tabScenarios',
};

type Props = {
  active: MatchSectionId;
  onSelect: (id: MatchSectionId) => void;
  sectionRefs: Record<MatchSectionId, RefObject<HTMLElement | null>>;
  scoreBarVisible?: boolean;
};

export function MatchSectionNav({ active, onSelect, sectionRefs, scoreBarVisible = false }: Props) {
  const { t } = useI18n();
  const ids = Object.keys(SECTION_KEYS) as MatchSectionId[];

  const scrollTo = (id: MatchSectionId) => {
    onSelect(id);
    sectionRefs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className={`mobile-sticky-section-nav -mx-4 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur-md md:static md:mx-0 md:w-full md:border-b-0 md:bg-transparent md:px-0 md:py-0 ${
        scoreBarVisible ? 'mobile-sticky-section-nav--with-score' : ''
      }`}
      aria-label={t('match.sectionNav')}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none md:flex-wrap md:overflow-visible">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`mobile-touch-target shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors sm:text-sm ${
              active === id
                ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/30'
                : 'text-muted hover:bg-panel2/60 hover:text-foreground'
            }`}
          >
            {t(SECTION_KEYS[id])}
          </button>
        ))}
      </div>
    </nav>
  );
}
