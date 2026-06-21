import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageMeta } from '../app/lib/usePageMeta';

describe('usePageMeta', () => {
  afterEach(() => {
    document.title = '';
    document.head.querySelectorAll('meta').forEach((el) => el.remove());
  });

  it('sets and restores document meta tags', async () => {
    const { unmount } = renderHook(() =>
      usePageMeta({
        title: 'Test Match — PitchIntel',
        description: 'Test description',
        image: '/custom-og.jpg',
        url: 'https://example.com/match',
      }),
    );

    await waitFor(() => {
      expect(document.title).toBe('Test Match — PitchIntel');
    });

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Test description',
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'Test Match — PitchIntel',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://example.com/match',
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      '/custom-og.jpg',
    );

    unmount();

    await waitFor(() => {
      expect(document.title).toContain('PitchIntel');
    });
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'World Cup 2026',
    );
  });

  it('skips updates when meta is null', () => {
    const originalTitle = document.title;
    renderHook(() => usePageMeta(null));
    expect(document.title).toBe(originalTitle);
  });
});
