import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findSeoPage } from '../lib/seoPages';
import { useI18n } from '../lib/i18n/I18nContext';
import { usePageMeta } from '../lib/usePageMeta';

export function SeoLandingPage() {
  const { pathname } = useLocation();
  const { mode, t } = useI18n();
  const page = findSeoPage(pathname);

  const title = page ? (mode === 'en' ? page.titleEn : page.titleVi) : '';
  const description = page ? (mode === 'en' ? page.descriptionEn : page.descriptionVi) : '';
  const answer = page ? (mode === 'en' ? page.answerEn : page.answerVi) : '';
  const cta = page ? (mode === 'en' ? page.ctaLabelEn : page.ctaLabelVi) : '';

  usePageMeta(
    page
      ? {
          title: `${title} | PitchIntel`,
          description,
          url: typeof window !== 'undefined' ? `${window.location.origin}${page.path}` : undefined,
        }
      : null,
  );

  useEffect(() => {
    if (!page) return;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${window.location.origin}${page.path}`);
  }, [page]);

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

  const related = [page.ctaPath, ...page.relatedPaths].filter(
    (path, index, all) => all.indexOf(path) === index,
  );

  return (
    <article className="panel mx-auto max-w-2xl space-y-4">
      <p className="label-tactical text-cyan">{t('seo.brandLine')}</p>
      <h1 className="font-display text-2xl tracking-wide text-foreground md:text-3xl">{title}</h1>
      <p className="text-base font-medium leading-relaxed text-foreground">{answer}</p>
      <p className="text-sm leading-relaxed text-muted">{description}</p>
      <Link
        to={page.ctaPath}
        className="inline-flex items-center rounded-lg bg-cyan/15 px-4 py-2.5 text-sm font-medium text-cyan ring-1 ring-cyan/30 hover:bg-cyan/25"
      >
        {cta} →
      </Link>
      <nav aria-label={mode === 'en' ? 'Related pages' : 'Trang liên quan'} className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {mode === 'en' ? 'Related' : 'Liên quan'}
        </p>
        <ul className="flex flex-wrap gap-2 text-sm">
          {related.map((path) => (
            <li key={path}>
              <Link to={path} className="text-cyan hover:underline">
                {path}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-xs text-muted">
        {mode === 'en'
          ? 'Source: PitchIntel — FIFA match data and internal probability model.'
          : 'Nguồn: PitchIntel — dữ liệu trận đấu từ FIFA và mô hình xác suất nội bộ.'}
      </p>
      <p className="text-xs text-muted">{t('seo.footerNote')}</p>
    </article>
  );
}
