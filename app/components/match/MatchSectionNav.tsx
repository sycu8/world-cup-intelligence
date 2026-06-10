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
};

export function MatchSectionNav({ active, onSelect, sectionRefs }: Props) {
  const { t } = useI18n();
  const ids = Object.keys(SECTION_KEYS) as MatchSectionId[];

  const scrollTo = (id: MatchSectionId) => {
    onSelect(id);
    sectionRefs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="sticky top-[52px] z-20 -mx-4 border-b border-border/60 bg-background/95 px-2 py-1.5 backdrop-blur-md md:top-0"
      aria-label={t('match.sectionNav')}
    >
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
