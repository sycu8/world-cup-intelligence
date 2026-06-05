import type { PlayerImpact } from '../components/tactical/PlayerImpactCard';
import type { LocaleKey } from './i18n/locales';

type Event = { event_type?: string; xg?: number; player_id?: string };

export type ContributionSegmentDef = {
  labelKey: LocaleKey;
  value: number;
  color: string;
};

const DEMO: PlayerImpact[] = [
  { id: 'p1', name: 'Key forward', role: 'FW', team: 'home', xg: 0.42, impact: 0.78, tag: 'shot' },
  { id: 'p2', name: 'Playmaker', role: 'MF', team: 'home', xg: 0.18, impact: 0.62, tag: 'pass' },
  { id: 'p3', name: 'Wide threat', role: 'FW', team: 'away', xg: 0.35, impact: 0.71, tag: 'carry' },
];

export function derivePlayerImpact(events: Event[]): PlayerImpact[] {
  if (!events.length) return DEMO.slice(0, 2);

  const goals = events.filter((e) => e.event_type === 'goal').length;
  const shots = events.filter((e) => e.event_type === 'goal' || e.xg).length;
  if (goals + shots === 0) return DEMO;

  return DEMO.map((p, i) => ({
    ...p,
    impact: Math.min(0.95, 0.45 + (goals + shots) * 0.08 - i * 0.05),
    xg: p.xg != null ? p.xg + shots * 0.02 : undefined,
  }));
}

export function defaultContributionSegments(): ContributionSegmentDef[] {
  return [
    { labelKey: 'contribution.pressing', value: 22, color: '#00e5ff' },
    { labelKey: 'contribution.chanceCreation', value: 28, color: '#ec008c' },
    { labelKey: 'contribution.finishing', value: 18, color: '#d4ff00' },
    { labelKey: 'contribution.defensive', value: 20, color: '#22c55e' },
    { labelKey: 'contribution.transition', value: 12, color: '#a855f7' },
  ];
}
