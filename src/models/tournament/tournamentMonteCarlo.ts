import {
  BEST_THIRD_R32_SLOTS,
  computeGroupStandingsFromMatchRows,
  type GroupStageMatchRow,
  type GroupStanding,
} from '../../services/tournamentProgression';
import { resolveLoserTeamId, resolveWinnerTeamId, type MatchOutcome } from '../../services/matchLifecycle';
import { blendTriples, pairKey, type MatchProbabilityTriple as H2hTriple } from '../../services/tournamentMcSignals';
import type { TeamStrengthProfile } from '../../services/tournamentTeamStrength';
import { estimateTripleFromTeamStrength } from '../../services/tournamentTeamStrength';

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
  teamStrength: Record<string, TeamStrengthProfile>;
  h2hTriples?: Map<string, H2hTriple>;
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

function defaultStrength(teamId: string): TeamStrengthProfile {
  return {
    teamId,
    elo: 1500,
    collectiveStrength: 0.75,
    recentForm: 0.5,
    fifaRanking: 40,
    lineupModifier: 0.97,
    countryCode: null,
    isHost: false,
    effectiveRating: 1500,
    attackRate: 1.0,
    defenseRate: 1.0,
    firstHalfLeadRate: 0.22,
  };
}

function resolveTriple(
  homeTeamId: string,
  awayTeamId: string,
  knockout: boolean,
  teamStrength: Record<string, TeamStrengthProfile>,
  h2hTriples?: Map<string, H2hTriple>,
): MatchProbabilityTriple {
  const home = teamStrength[homeTeamId] ?? defaultStrength(homeTeamId);
  const away = teamStrength[awayTeamId] ?? defaultStrength(awayTeamId);
  const base = estimateTripleFromTeamStrength(home, away, knockout);
  const overlay = h2hTriples?.get(pairKey(homeTeamId, awayTeamId));
  return blendTriples(base, overlay, overlay ? 0.32 : 0);
}

function poissonSample(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function expectedGoals(
  home: TeamStrengthProfile,
  away: TeamStrengthProfile,
  knockout: boolean,
): { home: number; away: number } {
  const base = knockout ? 1.05 : 1.28;
  const homeHtBoost = 1 + (home.firstHalfLeadRate - 0.22) * 0.35;
  const homeLambda = base * home.attackRate * homeHtBoost / Math.max(0.48, away.defenseRate);
  const awayLambda = (base * 0.94 * away.attackRate) / Math.max(0.48, home.defenseRate);
  return {
    home: Math.max(0.28, Math.min(3.4, homeLambda)),
    away: Math.max(0.22, Math.min(3.0, awayLambda)),
  };
}

function sampleScoreForOutcome(
  homeLambda: number,
  awayLambda: number,
  outcome: 'home' | 'draw' | 'away',
  rng: () => number,
): { home: number; away: number } {
  let home = poissonSample(homeLambda, rng);
  let away = poissonSample(awayLambda, rng);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (outcome === 'home' && home > away) break;
    if (outcome === 'away' && away > home) break;
    if (outcome === 'draw' && home === away) break;
    home = poissonSample(homeLambda, rng);
    away = poissonSample(awayLambda, rng);
  }

  if (outcome === 'home') {
    if (home <= away) {
      away = Math.max(0, home - 1);
      if (home === 0 && away === 0) home = 1;
      if (home === away) home = away + 1;
    }
    if (home - away > 2 && rng() < 0.72) {
      const tight = rng() < 0.58 ? 1 : 2;
      away = Math.max(0, tight - 1);
      home = tight;
    }
  } else if (outcome === 'away') {
    if (away <= home) {
      home = Math.max(0, away - 1);
      if (home === 0 && away === 0) away = 1;
      if (home === away) away = home + 1;
    }
    if (away - home > 2 && rng() < 0.72) {
      const tight = rng() < 0.58 ? 1 : 2;
      home = Math.max(0, tight - 1);
      away = tight;
    }
  } else {
    if (home !== away) {
      const avg = Math.min(3, Math.round((home + away) / 2));
      home = avg;
      away = avg;
    }
  }

  return { home, away };
}

function sampleGroupScore(
  triple: MatchProbabilityTriple,
  home: TeamStrengthProfile,
  away: TeamStrengthProfile,
  rng: () => number,
): { home: number; away: number } {
  const lambdas = expectedGoals(home, away, false);
  const r = rng();
  if (r < triple.homeWin) return sampleScoreForOutcome(lambdas.home, lambdas.away, 'home', rng);
  if (r < triple.homeWin + triple.draw) return sampleScoreForOutcome(lambdas.home, lambdas.away, 'draw', rng);
  return sampleScoreForOutcome(lambdas.home, lambdas.away, 'away', rng);
}

function sampleKnockoutScores(
  triple: MatchProbabilityTriple,
  home: TeamStrengthProfile,
  away: TeamStrengthProfile,
  rng: () => number,
): { home: number; away: number } {
  const lambdas = expectedGoals(home, away, true);
  const r = rng();
  if (r < triple.homeWin) return sampleScoreForOutcome(lambdas.home, lambdas.away, 'home', rng);
  if (r < triple.homeWin + triple.draw) return sampleScoreForOutcome(lambdas.home, lambdas.away, 'draw', rng);
  return sampleScoreForOutcome(lambdas.home, lambdas.away, 'away', rng);
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

    const home = input.teamStrength[m.homeTeamId] ?? defaultStrength(m.homeTeamId);
    const away = input.teamStrength[m.awayTeamId] ?? defaultStrength(m.awayTeamId);
    const triple = resolveTriple(m.homeTeamId, m.awayTeamId, false, input.teamStrength, input.h2hTriples);
    const score = sampleGroupScore(triple, home, away, rng);
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

      const home = input.teamStrength[homeTeamId] ?? defaultStrength(homeTeamId);
      const away = input.teamStrength[awayTeamId] ?? defaultStrength(awayTeamId);
      const triple = resolveTriple(homeTeamId, awayTeamId, true, input.teamStrength, input.h2hTriples);
      const score = sampleKnockoutScores(triple, home, away, rng);
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

/** @deprecated Use estimateTripleFromTeamStrength */
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
  const sum = expHome * scale + draw + (1 - expHome) * scale;
  return {
    homeWin: (expHome * scale) / sum,
    draw: draw / sum,
    awayWin: ((1 - expHome) * scale) / sum,
  };
}
