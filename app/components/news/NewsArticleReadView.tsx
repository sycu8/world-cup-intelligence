import type { NewsArticle } from '../../lib/api';
import { EditorialArticleLayout } from '../editorial/EditorialArticleLayout';
import { SourceConfidencePanel } from '../intelligence/SourceConfidencePanel';
import { useI18n } from '../../lib/i18n/I18nContext';
import { pickNewsTitle, pickNewsSummary } from '../../lib/newsDisplay';
import { NewsArticleLangToggle, type ArticleLang } from './NewsArticleLangToggle';

type Props = {
  article: NewsArticle;
  articleLang: ArticleLang;
  onArticleLangChange: (lang: ArticleLang) => void;
  onBack: () => void;
  translationPending?: boolean;
};

export function NewsArticleReadView({
  article,
  articleLang,
  onArticleLangChange,
  onBack,
  translationPending = false,
}: Props) {
  const { t } = useI18n();
  const locale = articleLang === 'en' ? 'en' : 'vi-VN';

  const needsVi = articleLang === 'vi' && !article.translated;
  const title = needsVi
    ? translationPending
      ? t('news.translating')
      : pickNewsTitle(article, 'en')
    : pickNewsTitle(article, articleLang);
  const summary = needsVi
    ? translationPending
      ? t('news.translatingBody')
      : pickNewsSummary(article, 'en')
    : pickNewsSummary(article, articleLang);

  const publishedLabel = new Date(article.published_at).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-cyan">
          ← {t('news.backToFeed')}
        </button>
        <NewsArticleLangToggle lang={articleLang} onChange={onArticleLangChange} />
      </div>

      <EditorialArticleLayout
        kicker={`${t('editorial.mode')} · ${t('nav.news')}`}
        title={title}
        meta={<time dateTime={article.published_at}>{publishedLabel}</time>}
        sidebar={
          <SourceConfidencePanel
            sources={[
              {
                name: article.source_name ?? 'RSS',
                score: article.reliability_score,
                url: article.source_url,
              },
            ]}
            compact
          />
        }
      >
        <div className="space-y-4">
          <p className="label-tactical text-cyan">{t('news.briefLabel')}</p>
          {needsVi && !translationPending && (
            <p className="text-sm leading-relaxed text-muted">{t('news.translationFallback')}</p>
          )}
          <div className="whitespace-pre-line text-foreground/95">{summary}</div>

          {(!needsVi || !translationPending) && article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-cyan/40 bg-cyan/10 px-5 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/20 sm:w-auto"
            >
              {t('news.readAtSource')}
            </a>
          )}
        </div>
      </EditorialArticleLayout>
    </div>
  );
}
