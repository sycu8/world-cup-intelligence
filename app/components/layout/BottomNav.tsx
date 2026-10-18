import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/I18nContext';
import type { LocaleKey } from '../../lib/i18n/locales';

const items: { to: string; k: LocaleKey; match?: (path: string, search: string) => boolean }[] = [
  { to: '/', k: 'nav.home', match: (p) => p === '/' },
  {
    to: '/matches',
    k: 'nav.matches',
    match: (p, search) =>
      (p === '/matches' && new URLSearchParams(search).get('tab') !== 'standings') ||
      (p.startsWith('/matches/') && !p.endsWith('/analysis')),
  },
  {
    to: '/leagues',
    k: 'nav.tournaments',
    match: (p, search) => p.startsWith('/leagues') || (p === '/matches' && new URLSearchParams(search).get('tab') === 'standings'),
  },
  { to: '/news-intelligence', k: 'nav.articles', match: (p) => p.startsWith('/news-intelligence') },
  { to: '/guide', k: 'nav.guide', match: (p) => p === '/guide' },
];

export function BottomNav() {
  const loc = useLocation();
  const { t } = useI18n();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden">
      <div className="grid grid-cols-5 gap-0.5 p-1.5">
        {items.map((i) => {
          const active = i.match
            ? i.match(loc.pathname, loc.search)
            : loc.pathname === i.to;
          return (
            <Link
              key={i.to}
              to={i.to}
              className={`mobile-touch-target flex flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-tight ${
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
