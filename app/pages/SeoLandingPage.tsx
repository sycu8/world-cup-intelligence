import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findSeoPage } from '../lib/seoPages';
import { useI18n } from '../lib/i18n/I18nContext';

export function SeoLandingPage() {
  const { pathname } = useLocation();
  const { mode, t } = useI18n();
  const page = findSeoPage(pathname);

  useEffect(() => {
    if (!page) return;
    const title = mode === 'en' ? page.titleEn : page.titleVi;
    const desc = mode === 'en' ? page.descriptionEn : page.descriptionVi;
    document.title = `${title} | PitchIntel`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, [page, mode]);

  if (!page) {
    return (
      <div className="panel text-center text-muted">
        <p>{t('common.backHome')}</p>
        <Link to="/" className="mt-2 inline-block text-cyan hover:underline">
          ← PitchIntel
        </Link>
      </div>
    );
  }

  const title = mode === 'en' ? page.titleEn : page.titleVi;
  const description = mode === 'en' ? page.descriptionEn : page.descriptionVi;
  const cta = mode === 'en' ? page.ctaLabelEn : page.ctaLabelVi;

  return (
    <article className="panel mx-auto max-w-2xl space-y-4">
      <p className="label-tactical text-cyan">{t('seo.brandLine')}</p>
      <h1 className="font-display text-2xl tracking-wide text-foreground md:text-3xl">{title}</h1>
      <p className="text-base leading-relaxed text-muted">{description}</p>
      <Link
        to={page.ctaPath}
        className="inline-flex items-center rounded-lg bg-cyan/15 px-4 py-2.5 text-sm font-medium text-cyan ring-1 ring-cyan/30 hover:bg-cyan/25"
      >
        {cta} →
      </Link>
      <p className="text-xs text-muted">{t('seo.footerNote')}</p>
    </article>
  );
}
