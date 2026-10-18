import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';
import { MatchScoreBreakdown } from '../../app/components/match/MatchScoreBreakdown';
import type { MatchScoreDetail } from '../../app/lib/api';

function renderBreakdown(
  detail: MatchScoreDetail | null | undefined,
  props?: Partial<Parameters<typeof MatchScoreBreakdown>[0]>,
) {
  return render(
    <I18nProvider>
      <MatchScoreBreakdown detail={detail} {...props} />
    </I18nProvider>,
  );
}

describe('MatchScoreBreakdown', () => {
  it('shows 0–0 half-time scores with stoppage time', () => {
    renderBreakdown(
      {
        ht: { home: 0, away: 0 },
        stoppage: { firstHalf: 11 },
      },
      { compact: true },
    );

    expect(screen.getByText(/H1 0–0 \(\+11'\)/)).toBeInTheDocument();
  });

  it('shows per-half stoppage and extra-time periods', () => {
    renderBreakdown(
      {
        ht: { home: 1, away: 0 },
        secondHalf: { home: 1, away: 1 },
        extraTime1: { home: 0, away: 1 },
        extraTime2: { home: 1, away: 0 },
        stoppage: { firstHalf: 2, secondHalf: 3, extraTimeFirst: 1, extraTimeSecond: 2 },
        penalties: { home: 4, away: 5 },
      },
      { compact: true },
    );

    expect(screen.getByText(/H1 1–0 \(\+2'\)/)).toBeInTheDocument();
    expect(screen.getByText(/H2 1–1 \(\+3'\)/)).toBeInTheDocument();
    expect(screen.getByText(/HP1 0–1 \(\+1'\)/)).toBeInTheDocument();
    expect(screen.getByText(/HP2 1–0 \(\+2'\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pen 4–5/)).toBeInTheDocument();
  });

  it('renders stoppage-only segment when period score is missing', () => {
    renderBreakdown(
      {
        stoppage: { secondHalf: 4 },
      },
      { compact: true },
    );

    expect(screen.getByText(/H2 \(\+4'\)/)).toBeInTheDocument();
  });

  it('returns null when detail is empty', () => {
    const { container } = renderBreakdown(null);
    expect(container).toBeEmptyDOMElement();
  });
});
