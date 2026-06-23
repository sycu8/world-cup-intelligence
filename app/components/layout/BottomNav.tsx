import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/I18nContext';
import type { LocaleKey } from '../../lib/i18n/locales';

const items: { to: string; k: LocaleKey; match?: (path: string) => boolean }[] = [
  { to: '/', k: 'nav.home', match: (p) => p === '/' },
  { to: '/matches', k: 'nav.matches', match: (p) => p === '/matches' || p.startsWith('/matches/') },
  { to: '/news-intelligence', k: 'nav.articles' },
  { to: '/guide', k: 'nav.guide' },
];

export function BottomNav() {
  const loc = useLocation();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden">
      <div className="grid grid-cols-4 gap-1 p-2">
        {items.map((i) => {
          const active = i.match ? i.match(loc.pathname) : loc.pathname === i.to;
          return (
            <Link
              key={i.to}
              to={i.to}
              className={`mobile-touch-target flex items-center justify-center rounded-xl py-2 text-center text-sm font-semibold leading-snug ${
                active ? 'bg-cyan/15 text-cyan' : 'text-foreground/70'
              }`}
            >
              {t(i.k)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
