export type TournamentRow = {
  id: string;
  year: number;
  name: string;
  host_countries_json: string | null;
  start_date: string | null;
  end_date: string | null;
  teams_count: number | null;
  status: string | null;
};

export type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  country_code: string | null;
  fifa_ranking: number | null;
  elo_rating: number | null;
  collective_strength_rating: number | null;
};

export type MatchRow = {
  id: string;
  tournament_id: string;
  stage: string | null;
  group_code: string | null;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  kickoff_utc: string | null;
  status: string;
  minute: number;
  home_score: number;
  away_score: number;
  home_xg: number;
  away_xg: number;
};

export type PlayerRow = {
  id: string;
  name: string;
  nationality: string | null;
  primary_team_id: string | null;
  club: string | null;
  position: string | null;
  age: number | null;
};

export type ProbabilitySnapshotRow = {
  id: string;
  match_id: string;
  minute: number;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  expected_home_goals: number;
  expected_away_goals: number;
  most_likely_score: string | null;
  scoreline_json: string | null;
  interval_json: string | null;
  confidence: number;
  model_version: string;
  input_hash: string | null;
  explanation_json: string | null;
  created_at?: string | null;
};
