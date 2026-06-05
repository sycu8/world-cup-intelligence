import { brandTheme } from '../../lib/brand/brandTheme';
import { useI18n } from '../../lib/i18n/I18nContext';

const LINKEDIN_URL = 'https://www.linkedin.com/in/sycule/';
const GITHUB_URL = 'https://github.com/sycu8/';

export function Footer() {
  const { t, mode } = useI18n();
  const authorName = mode === 'en' ? 'Cuong Le Sy' : 'Lê Sỹ Cường';

  return (
    <footer className="mt-10 border-t border-border/60 py-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-lg font-extrabold tracking-tight text-foreground">
            {brandTheme.name}
          </p>
          <p className="mt-1 text-base text-foreground/85">{t('footer.tagline')}</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{t('footer.description')}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-sm text-muted-dim">
            FIFA World Cup 2026 · {t('footer.analytics')}
          </p>
          <p className="text-sm text-muted">
            {t('footer.builtBy')}{' '}
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-cyan hover:underline"
            >
              {authorName}
            </a>
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted hover:text-cyan hover:underline"
          >
            {t('footer.github')}
          </a>
        </div>
      </div>
    </footer>
  );
}
