import { WC2026_TOURNAMENT_ID } from '../../src/constants/tournament';
import type { MatchRow, PlayerRow, ProbabilitySnapshotRow, TeamRow, TournamentRow } from '../../src/db/schema';

export const FIXTURE_TOURNAMENT: TournamentRow = {
  id: WC2026_TOURNAMENT_ID,
  year: 2026,
  name: 'FIFA World Cup 2026',
  host_countries_json: '["United States","Mexico","Canada"]',
  start_date: '2026-06-11',
  end_date: '2026-07-19',
  teams_count: 48,
  status: 'upcoming',
};

export const FIXTURE_TEAMS: TeamRow[] = [
  {
    id: 'team-w26-a1',
    name: 'Mexico',
    short_name: 'MEX',
    country_code: 'MEX',
    fifa_ranking: 14,
    elo_rating: 1820,
    collective_strength_rating: 0.78,
  },
  {
    id: 'team-w26-a2',
    name: 'South Africa',
    short_name: 'RSA',
    country_code: 'RSA',
    fifa_ranking: 59,
    elo_rating: 1650,
    collective_strength_rating: 0.62,
  },
];

export const FIXTURE_MATCH: MatchRow = {
  id: 'm-w26-ga-1v2',
  tournament_id: WC2026_TOURNAMENT_ID,
  stage: 'Group',
  group_code: 'A',
  home_team_id: 'team-w26-a1',
  away_team_id: 'team-w26-a2',
  venue_id: null,
  kickoff_utc: '2026-06-11T19:00:00Z',
  status: 'scheduled',
  minute: 0,
  home_score: 0,
  away_score: 0,
  home_xg: 0,
  away_xg: 0,
  fifa_match_id: null,
  updated_at: '2026-01-01T00:00:00Z',
};

export type MatchWithNames = MatchRow & {
  home_name: string;
  away_name: string;
  home_short: string | null;
  away_short: string | null;
  home_country_code: string | null;
  away_country_code: string | null;
  match_date?: string;
};

export function matchWithNames(match = FIXTURE_MATCH): MatchWithNames {
  const home = FIXTURE_TEAMS.find((t) => t.id === match.home_team_id)!;
  const away = FIXTURE_TEAMS.find((t) => t.id === match.away_team_id)!;
  return {
    ...match,
    home_name: home.name,
    away_name: away.name,
    home_short: home.short_name,
    away_short: away.short_name,
    home_country_code: home.country_code,
    away_country_code: away.country_code,
    match_date: match.kickoff_utc?.slice(0, 10),
  };
}

export const FIXTURE_PLAYER: PlayerRow = {
  id: 'p-test-1',
  name: 'Test Player',
  nationality: 'MEX',
  primary_team_id: 'team-w26-a1',
  club: 'Club FC',
  position: 'FW',
  age: 25,
};

export const FIXTURE_SNAPSHOT: ProbabilitySnapshotRow = {
  id: 'ps-test-1',
  match_id: FIXTURE_MATCH.id,
  minute: 0,
  home_win_prob: 0.55,
  draw_prob: 0.25,
  away_win_prob: 0.2,
  expected_home_goals: 1.8,
  expected_away_goals: 0.9,
  most_likely_score: '2-1',
  scoreline_json: JSON.stringify({ '2-1': 0.12, '1-0': 0.1, '1-1': 0.09 }),
  interval_json: JSON.stringify({ firstHalf: 0.45, secondHalf: 0.55 }),
  confidence: 0.72,
  model_version: 'v1-test',
  input_hash: 'hash1',
  explanation_json: JSON.stringify({ factors: [{ label: 'Home advantage' }] }),
  created_at: '2026-01-01T00:00:00Z',
};

export const FIXTURE_NEWS = {
  id: 'news-1',
  title: 'Test headline',
  title_vi: 'Tiêu đề thử',
  source_url: 'https://example.com/1',
  summary: 'Summary text',
  summary_vi: 'Tóm tắt thử',
  published_at: '2026-01-15T12:00:00Z',
  reliability_score: 0.9,
  thumbnail_url: null as string | null,
  thumbnail_r2_key: null as string | null,
  hot_score: 0.95,
  source_name: 'Test Source',
  impact_level: null as string | null,
  impact_summary_vi: null as string | null,
  affected_match_ids_json: null as string | null,
};

export const FIXTURE_SOURCE = {
  id: 'src-1',
  source_name: 'Test Source',
  source_type: 'rss',
  health_status: 'healthy',
};
