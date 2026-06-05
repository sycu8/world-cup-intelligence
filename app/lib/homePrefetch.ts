import type { DashboardData, NewsArticle, ScheduleMatch } from './api';

export type HomePayload = {
  data: {
    schedule: {
      byDate: Record<string, ScheduleMatch[]>;
      matches: ScheduleMatch[];
      tournamentId: string;
      total: number;
    };
    scheduleMeta: {
      expectedMatches: number;
      year: number;
    };
    dashboard: DashboardData;
    hotNews: NewsArticle[];
  };
};

declare global {
  interface Window {
    __PITCHINTEL_HOME__?: Promise<HomePayload | null>;
  }
}

export function startHomePrefetch(): void {
  if (typeof window === 'undefined' || window.__PITCHINTEL_HOME__) return;
  window.__PITCHINTEL_HOME__ = fetch('/api/home')
    .then((r) => (r.ok ? (r.json() as Promise<HomePayload>) : Promise.reject()))
    .catch(() => null);
}

export async function consumeHomePrefetch(): Promise<HomePayload | null> {
  const pending = window.__PITCHINTEL_HOME__;
  window.__PITCHINTEL_HOME__ = undefined;
  if (!pending) return null;
  return pending;
}
