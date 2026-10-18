import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EditorialArticleLayout } from '../../app/components/editorial/EditorialArticleLayout';
import { TacticalBriefingPanel } from '../../app/components/tactical/TacticalBriefingPanel';
import { visibleBriefingLines } from '../../app/lib/briefingText';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import type { TacticalBriefing } from '../../app/lib/api';
import { fallbackBriefing } from '../../src/ai/tacticalBriefing';

const englishOnly: TacticalBriefing = {
  summary: { vi: '', en: 'Home side are favourites.' },
  probabilityExplanation: [
    { vi: '', en: 'Away win chance is 26.2%.' },
    { vi: '', en: '' },
  ],
  uncertaintyNotes: [
    { vi: '', en: 'Lineups may shift.' },
    { vi: '', en: '' },
  ],
  citations: [],
};

const blank: TacticalBriefing = {
  summary: { vi: '', en: '' },
  probabilityExplanation: [
    { vi: '', en: '' },
    { vi: ' ', en: ' ' },
  ],
  uncertaintyNotes: [{ vi: '', en: '' }],
  citations: [],
};

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function renderVi(ui: ReactNode, width: number) {
  return render(
    <I18nProvider>
      <div style={{ width }}>{ui}</div>
    </I18nProvider>,
  );
}

describe('Vietnamese briefing at desktop and mobile widths', () => {
  beforeEach(() => {
    localStorage.setItem('wc-display-mode', 'vi');
  });

  it.each([
    [1366, 768],
    [390, 844],
  ])('falls back per field and hides empty items at %ix%i', (width, height) => {
    setViewport(width, height);
    expect(window.innerWidth).toBe(width);

    const view = renderVi(
      <>
        <TacticalBriefingPanel briefing={englishOnly} />
        <EditorialArticleLayout
          title="Mexico vs South Africa"
          subtitle="Home side are favourites."
          takeaways={[
            ...visibleBriefingLines(englishOnly.probabilityExplanation, 'vi'),
            '',
            ' ',
          ]}
        >
          <p>Home side are favourites.</p>
        </EditorialArticleLayout>
      </>,
      width,
    );

    const text = view.container.textContent ?? '';
    expect(text).toContain('Home side are favourites.');
    expect(text).toContain('Away win chance is 26.2%.');
    expect(text).toContain('Lineups may shift.');
    expect(text).not.toMatch(/Điểm chính\s*•\s*•/);

    const items = [...view.container.querySelectorAll('li')];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textContent?.replace('•', '').trim().length).toBeGreaterThan(0);
    }
    const note = view.container.querySelector('[role="note"]');
    expect(note?.textContent?.trim()).toBe('Lineups may shift.');
    expect(view.container.querySelectorAll('[role="note"] p')).toHaveLength(1);

    view.unmount();

    const empty = renderVi(
      <>
        <TacticalBriefingPanel briefing={blank} />
        <EditorialArticleLayout title="Mexico vs South Africa" takeaways={['', ' ']}>
          <p>body</p>
        </EditorialArticleLayout>
      </>,
      width,
    );
    expect(empty.container.querySelector('li')).toBeNull();
    expect(empty.container.querySelector('[role="note"]')).toBeNull();
    expect(empty.container.textContent).not.toContain('•');
    expect(empty.container.textContent).not.toContain('Điểm chính');
  });

  it.each([1366, 390])('labels the statistical draft at width %i', (width) => {
    setViewport(width, width === 390 ? 844 : 768);
    const draft = fallbackBriefing({
      matchId: 'm-draft',
      aiFallback: true,
      probability: { homeWinProb: 0.4, drawProb: 0.3, awayWinProb: 0.3 },
    });
    const view = renderVi(<TacticalBriefingPanel briefing={draft} generating={false} />, width);
    const text = view.container.textContent ?? '';
    expect(text).toContain('Bản thống kê — phân tích AI chưa có.');
    expect(text).toContain('Phân tích chiến thuật từ mô hình thống kê');
    expect(text).not.toContain('Phần phân tích AI — số liệu là chuẩn');
    expect(text).not.toContain('AI analysis layer');
  });
});
