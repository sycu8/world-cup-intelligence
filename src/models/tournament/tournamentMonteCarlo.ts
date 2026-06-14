import {
  BEST_THIRD_R32_SLOTS,
  computeGroupStandingsFromMatchRows,
  type GroupStageMatchRow,
  type GroupStanding,
} from '../../services/tournamentProgression';
import { resolveLoserTeamId, resolveWinnerTeamId, type MatchOutcome } from '../../services/matchLifecycle';

const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

const KNOCKOUT_STAGE_ORDER = [
  'Round of 32',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third place',
  'Final',
] as const;

export type MatchProbabilityTriple = { homeWin: number; draw: number; awayWin: number };

export type McGroupMatch = {
  id: string;
  groupCode: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: string;
};

export type McBracketLink = {
  sourceMatchId: string | null;
  targetMatchId: string;
  targetSlot: 'home' | 'away';
  ruleType: 'winner' | 'loser' | 'group_rank';
  group?: string;
  rank?: number;
};

export type McKnockoutMatch = {
  id: string;
  stage: string;
};

export type TournamentMonteCarloInput = {
  groupMatches: McGroupMatch[];
  knockoutMatches: McKnockoutMatch[];
  matchProbs: Record<string, MatchProbabilityTriple>;
  teamRatings: Record<string, number>;
  groupRankLinks: McBracketLink[];
  winnerLinks: McBracketLink[];
  simulations: number;
  rng?: () => number;
};

export type ChampionOddsEntry = {
  teamId: string;
  wins: number;
  prob: number;
};

export type TournamentMonteCarloResult = {
  simulations: number;
  championCounts: ChampionOddsEntry[];
};

function defaultRng(): () => number {
  return Math.random;
}

function normalizeTriple(t: MatchProbabilityTriple): MatchProbabilityTriple {
  const sum = t.homeWin + t.draw + t.awayWin;
  if (sum <= 0) return { homeWin: 0.33, draw: 0.34, awayWin: 0.33 };
  return { homeWin: t.homeWin / sum, draw: t.draw / sum, awayWin: t.awayWin / sum };
}

/** Elo-based W/D/L when no snapshot exists for this pairing. */
export function estimateTripleFromElo(
  homeTeamId: string,
  awayTeamId: string,
  ratings: Record<string, number>,
  knockout: boolean,
): MatchProbabilityTriple {
  const homeElo = ratings[homeTeamId] ?? 1500;
  const awayElo = ratings[awayTeamId] ?? 1500;
  const homeAdv = 65;
  const expHome = 1 / (1 + 10 ** ((awayElo - (homeElo + homeAdv)) / 400));
  const draw = knockout ? 0.2 : 0.26;
  const scale = 1 - draw;
  return normalizeTriple({
    homeWin: expHome * scale,
    draw,
    awayWin: (1 - expHome) * scale,
  });
}

function resolveTriple(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  knockout: boolean,
  matchProbs: Record<string, MatchProbabilityTriple>,
  ratings: Record<string, number>,
): MatchProbabilityTriple {
  const fromSnapshot = matchProbs[matchId];
  if (fromSnapshot) return normalizeTriple(fromSnapshot);
  return estimateTripleFromElo(homeTeamId, awayTeamId, ratings, knockout);
}

function sampleGroupScore(triple: MatchProbabilityTriple, rng: () => number): { home: number; away: number } {
  const r = rng();
  if (r < triple.homeWin) {
    return rng() < 0.35 ? { home: 2, away: 1 } : { home: 1, away: 0 };
  }
  if (r < triple.homeWin + triple.draw) {
    return rng() < 0.5 ? { home: 1, away: 1 } : { home: 0, away: 0 };
  }
  return rng() < 0.35 ? { home: 1, away: 2 } : { home: 0, away: 1 };
}

function sampleKnockoutScores(
  triple: MatchProbabilityTriple,
  rng: () => number,
): { home: number; away: number } {
  const r = rng();
  if (r < triple.homeWin) return { home: 1, away: 0 };
  if (r < triple.homeWin + triple.draw) return { home: 1, away: 1 };
  return { home: 0, away: 1 };
}

function compareThird(a: GroupStanding & { group: string }, b: GroupStanding & { group: string }): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.teamId.localeCompare(b.teamId);
}

function isFinished(status: string): boolean {
  return status === 'completed' || status === 'finished';
}

export function simulateTournamentOnce(input: TournamentMonteCarloInput, rng: () => number): string | null {
  const groupRows: GroupStageMatchRow[] = [];

  for (const m of input.groupMatches) {
    if (isFinished(m.status)) {
      groupRows.push({
        group_code: m.groupCode,
        home_team_id: m.homeTeamId,
        away_team_id: m.awayTeamId,
        home_score: m.homeScore,
        away_score: m.awayScore,
        status: 'completed',
      });
      continue;
    }

    const triple = resolveTriple(m.id, m.homeTeamId, m.awayTeamId, false, input.matchProbs, input.teamRatings);
    const score = sampleGroupScore(triple, rng);
    groupRows.push({
      group_code: m.groupCode,
      home_team_id: m.homeTeamId,
      away_team_id: m.awayTeamId,
      home_score: score.home,
      away_score: score.away,
      status: 'completed',
    });
  }

  const standingsByGroup = new Map<string, GroupStanding[]>();
  for (const code of GROUP_CODES) {
    standingsByGroup.set(code, computeGroupStandingsFromMatchRows(groupRows, code));
  }

  const slots = new Map<string, { home?: string; away?: string }>();

  for (const link of input.groupRankLinks) {
    if (link.ruleType !== 'group_rank' || !link.group || !link.rank) continue;
    const standings = standingsByGroup.get(link.group);
    const team = standings?.[link.rank - 1];
    if (!team) continue;
    const slot = slots.get(link.targetMatchId) ?? {};
    slot[link.targetSlot] = team.teamId;
    slots.set(link.targetMatchId, slot);
  }

  const thirdCandidates: (GroupStanding & { group: string })[] = [];
  for (const code of GROUP_CODES) {
    const third = standingsByGroup.get(code)?.[2];
    if (third) thirdCandidates.push({ ...third, group: code });
  }
  thirdCandidates.sort(compareThird);
  for (let i = 0; i < Math.min(8, thirdCandidates.length); i += 1) {
    const { matchId, slot } = BEST_THIRD_R32_SLOTS[i];
    const entry = slots.get(matchId) ?? {};
    entry[slot] = thirdCandidates[i].teamId;
    slots.set(matchId, entry);
  }

  const outcomes = new Map<string, MatchOutcome>();

  for (const stage of KNOCKOUT_STAGE_ORDER) {
    const stageMatches = input.knockoutMatches.filter((m) => m.stage === stage);
    for (const match of stageMatches) {
      const pairing = slots.get(match.id);
      const homeTeamId = pairing?.home;
      const awayTeamId = pairing?.away;
      if (!homeTeamId || !awayTeamId) continue;

      const triple = resolveTriple(
        match.id,
        homeTeamId,
        awayTeamId,
        true,
        input.matchProbs,
        input.teamRatings,
      );
      const score = sampleKnockoutScores(triple, rng);
      const outcome: MatchOutcome = {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: score.home,
        away_score: score.away,
        stage: match.stage,
      };
      outcomes.set(match.id, outcome);

      for (const link of input.winnerLinks) {
        if (link.sourceMatchId !== match.id) continue;
        const teamId =
          link.ruleType === 'winner'
            ? resolveWinnerTeamId(outcome)
            : link.ruleType === 'loser'
              ? resolveLoserTeamId(outcome)
              : null;
        if (!teamId) continue;
        const target = slots.get(link.targetMatchId) ?? {};
        target[link.targetSlot] = teamId;
        slots.set(link.targetMatchId, target);
      }
    }
  }

  const final = outcomes.get('m-w26-final-01');
  if (!final) return null;
  return resolveWinnerTeamId(final);
}

export function runTournamentMonteCarlo(input: TournamentMonteCarloInput): TournamentMonteCarloResult {
  const rng = input.rng ?? defaultRng();
  const counts = new Map<string, number>();
  const n = Math.max(1, Math.floor(input.simulations));

  for (let i = 0; i < n; i += 1) {
    const championId = simulateTournamentOnce(input, rng);
    if (!championId) continue;
    counts.set(championId, (counts.get(championId) ?? 0) + 1);
  }

  const championCounts: ChampionOddsEntry[] = [...counts.entries()]
    .map(([teamId, wins]) => ({ teamId, wins, prob: wins / n }))
    .sort((a, b) => b.prob - a.prob);

  return { simulations: n, championCounts };
}
