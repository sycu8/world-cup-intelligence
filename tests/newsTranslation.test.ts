import { describe, expect, it, vi } from 'vitest';
import {
  backfillNewsTranslations,
  countUntranslatedNews,
  ensureNewsArticleTranslated,
} from '../src/services/newsTranslation';
import { translateNewsHeadline } from '../src/ai/translateNews';
import { createMockDb, createMockEnv } from './helpers/mockEnv';

vi.mock('../src/ai/translateNews', () => ({
  translateNewsHeadline: vi.fn(async () => ({
    titleVi: 'Tiêu đề dịch',
    summaryVi: 'Tóm tắt dịch',
  })),
}));

describe('newsTranslation', () => {
  const untranslated = {
    id: 'doc-1',
    title: 'English headline',
    summary: 'English summary',
    title_vi: null,
    summary_vi: null,
  };

  it('ensureNewsArticleTranslated updates D1 when translation succeeds', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    const patched = await ensureNewsArticleTranslated(env, untranslated);
    expect(patched?.title_vi).toBe('Tiêu đề dịch');
  });

  it('returns null when article already translated', async () => {
    const env = createMockEnv({ DB: createMockDb() });
    const result = await ensureNewsArticleTranslated(env, {
      ...untranslated,
      title_vi: 'Đã dịch',
      summary_vi: 'Đã dịch',
    });
    expect(result).toBeNull();
  });

  it('countUntranslatedNews scans recent documents', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({
          results: [
            untranslated,
            {
              ...untranslated,
              id: 'doc-2',
              title_vi: 'Tiêu đề đã dịch đầy đủ cho bài viết',
              summary_vi: 'Tóm tắt đã dịch đầy đủ cho bài viết thể thao',
            },
          ],
        }),
      }),
    });
    expect(await countUntranslatedNews(env)).toBe(1);
  });

  it('returns null when translation provider returns null', async () => {
    vi.mocked(translateNewsHeadline).mockResolvedValueOnce(null);
    const env = createMockEnv({ DB: createMockDb() });
    expect(await ensureNewsArticleTranslated(env, untranslated)).toBeNull();
  });

  it('countUntranslatedNews handles missing results array', async () => {
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({}) }),
    });
    expect(await countUntranslatedNews(env)).toBe(0);
  });

  it('backfillNewsTranslations handles missing results array', async () => {
    const env = createMockEnv({
      DB: createMockDb({ all: () => ({}) }),
    });
    expect(await backfillNewsTranslations(env, 5)).toBe(0);
  });

  it('backfillNewsTranslations processes limited batch', async () => {
    const env = createMockEnv({
      DB: createMockDb({
        all: () => ({ results: [untranslated] }),
        run: () => ({ success: true, meta: { changes: 1 } }),
      }),
    });
    expect(await backfillNewsTranslations(env, 5)).toBe(1);
  });
});
