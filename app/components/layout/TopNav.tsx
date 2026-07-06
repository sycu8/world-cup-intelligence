import { Link, useLocation } from 'react-router-dom';
import { Bilingual } from '../i18n/Bilingual';
import { LangSwitch } from '../i18n/LangSwitch';
import { BrandLogo } from '../brand/BrandLogo';

const links = [
  { to: '/', k: 'nav.home' as const, match: (p: string, search: string) => p === '/' },
  {
    to: '/matches',
    k: 'nav.matches' as const,
    match: (p: string, search: string) =>
      (p === '/matches' && new URLSearchParams(search).get('tab') !== 'standings') ||
      (p.startsWith('/matches/') && !p.endsWith('/analysis')),
  },
  {
    to: '/matches?tab=standings',
    k: 'nav.tournaments' as const,
    match: (p: string, search: string) => p === '/matches' && new URLSearchParams(search).get('tab') === 'standings',
  },
  { to: '/news-intelligence', k: 'nav.articles' as const, match: (p: string) => p.startsWith('/news-intelligence') },
  { to: '/guide', k: 'nav.guide' as const, match: (p: string) => p === '/guide' },
  { to: '/docs/api', k: 'nav.api' as const, match: (p: string) => p.startsWith('/docs/api') },
];

export function TopNav() {
  const loc = useLocation();
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3">
        <BrandLogo />
        <nav className="hidden gap-1 md:flex">
          {links.map((l) => {
            const active = l.match ? l.match(loc.pathname, loc.search) : loc.pathname === l.to;
            return (
              <Link
                key={l.k}
                to={l.to}
                className={`rounded-lg px-3 py-2 text-base font-medium transition ${
                  active
                    ? 'bg-cyan/15 text-cyan'
                    : 'text-foreground/75 hover:bg-panel2/60 hover:text-foreground'
                }`}
              >
                <Bilingual k={l.k} as="span" />
              </Link>
            );
          })}
        </nav>
        <LangSwitch />
      </div>
    </header>
  );
}
