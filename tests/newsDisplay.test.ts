import { describe, expect, it } from 'vitest';
import { pickNewsTitle, pickNewsSummary } from '../app/lib/newsDisplay';
import type { NewsArticle } from '../app/lib/api';

const article: NewsArticle = {
  id: 'doc-1',
  title: 'Vietnamese default from API',
  titleEn: 'England win',
  titleVi: 'Anh thắng',
  source_url: 'https://example.com',
  summary: 'VI summary default',
  summaryEn: 'Short EN',
  summaryVi: 'Tóm tắt VI',
  published_at: '2026-06-01T00:00:00Z',
  reliability_score: 0.8,
};

describe('newsDisplay', () => {
  it('prefers Vietnamese in vi mode', () => {
    expect(pickNewsTitle(article, 'vi')).toBe('Anh thắng');
    expect(pickNewsSummary(article, 'vi')).toBe('Tóm tắt VI');
  });

  it('falls back to title when translated article lacks vi fields', () => {
    expect(
      pickNewsTitle({ ...article, translated: true, titleVi: undefined }, 'vi'),
    ).toBe('Vietnamese default from API');
    expect(
      pickNewsSummary({ ...article, translated: true, summaryVi: undefined }, 'vi'),
    ).toBe('VI summary default');
  });
});
