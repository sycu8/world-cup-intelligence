import { Hono } from 'hono';
import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as eventsRepo from '../db/repositories/eventsRepo';
import * as lineupsRepo from '../db/repositories/lineupsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { getHeadToHead } from '../services/matchHistory';
import { buildProbabilityHints } from '../services/matchHints';
import { getMatchPreviewAnalysis } from '../services/matchPreviewAnalysis';
import { getProjectedLineupForMatch } from '../services/matchLineupProjection';
import * as teamsRepo from '../db/repositories/teamsRepo';

export const matchRoutes = new Hono<{ Bindings: AppEnv }>();

matchRoutes.get('/', async (c) => {
  const data = await matchesRepo.listMatches(c.env.DB);
  return c.json({ data });
});

matchRoutes.get('/:matchId', async (c) => {
  const match = await matchesRepo.getMatch(c.env.DB, c.req.param('matchId'));
  if (!match) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: match });
});

matchRoutes.get('/:matchId/events', async (c) => {
  const data = await eventsRepo.getMatchEvents(c.env.DB, c.req.param('matchId'));
  return c.json({ data });
});

matchRoutes.get('/:matchId/lineups', async (c) => {
  const matchId = c.req.param('matchId');
  const match = await matchesRepo.getMatch(c.env.DB, matchId);
  if (!match) return c.json({ error: 'Not found' }, 404);

  const [homeTeam, awayTeam] = await Promise.all([
    teamsRepo.getTeam(c.env.DB, match.home_team_id),
    teamsRepo.getTeam(c.env.DB, match.away_team_id),
  ]);
  if (!homeTeam || !awayTeam) return c.json({ error: 'Teams not found' }, 404);

  const [home, away, raw] = await Promise.all([
    getProjectedLineupForMatch(c.env, matchId, homeTeam.id, homeTeam.name),
    getProjectedLineupForMatch(c.env, matchId, awayTeam.id, awayTeam.name),
    lineupsRepo.getMatchLineups(c.env.DB, matchId),
  ]);

  return c.json({
    data: {
      matchId,
      home: { teamId: homeTeam.id, teamName: homeTeam.name, ...home },
      away: { teamId: awayTeam.id, teamName: awayTeam.name, ...away },
      records: raw,
    },
  });
});

matchRoutes.get('/:matchId/history', async (c) => {
  const data = await getHeadToHead(c.env, c.req.param('matchId'));
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});

matchRoutes.get('/:matchId/preview', async (c) => {
  const data = await getMatchPreviewAnalysis(c.env, c.req.param('matchId'));
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});

matchRoutes.get('/:matchId/hints', async (c) => {
  const matchId = c.req.param('matchId');
  const h2h = await getHeadToHead(c.env, matchId);
  if (!h2h?.current) return c.json({ error: 'Not found' }, 404);

  const snap = await probabilityRepo.getLatestSnapshot(c.env.DB, matchId);
  const homeName = h2h.current.home_name;
  const awayName = h2h.current.away_name;

  const hints = buildProbabilityHints({
    homeName,
    awayName,
    homeWin: snap?.home_win_prob ?? 0.33,
    draw: snap?.draw_prob ?? 0.33,
    awayWin: snap?.away_win_prob ?? 0.33,
    xgHome: snap?.expected_home_goals ?? 1.2,
    xgAway: snap?.expected_away_goals ?? 1.2,
    mostLikelyScore: snap?.most_likely_score ?? undefined,
    confidence: snap?.confidence ?? undefined,
    h2h: {
      homeWins: h2h.summary.homeTeamWins,
      awayWins: h2h.summary.awayTeamWins,
      draws: h2h.summary.draws,
      total: h2h.summary.totalMatches,
    },
  });

  return c.json({
    data: {
      hints,
      probability: snap
        ? {
            homeWinProb: snap.home_win_prob,
            drawProb: snap.draw_prob,
            awayWinProb: snap.away_win_prob,
            mostLikelyScore: snap.most_likely_score,
          }
        : null,
    },
  });
});

matchRoutes.get('/:matchId/live', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }
  const matchId = c.req.param('matchId');
  const id = c.env.MATCH_ROOM.idFromName(matchId);
  const stub = c.env.MATCH_ROOM.get(id);
  return stub.fetch(c.req.raw);
});
