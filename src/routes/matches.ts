import { Hono } from 'hono';
import type { AppEnv } from '../env';
import * as eventsRepo from '../db/repositories/eventsRepo';
import * as lineupsRepo from '../db/repositories/lineupsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { getHeadToHead } from '../services/matchHistory';
import { buildProbabilityHints } from '../services/matchHints';
import { getMatchPreviewAnalysis } from '../services/matchPreviewAnalysis';
import { getLineupDisplayForMatch } from '../services/lineupDisplay';
import { resolveMatchRef, listMatchesWithSlug } from '../services/matchRef';
import { getMatchStats } from '../services/matchStats';
import * as teamsRepo from '../db/repositories/teamsRepo';

export const matchRoutes = new Hono<{ Bindings: AppEnv }>();

async function loadMatch(c: { env: AppEnv; req: { param: (k: string) => string } }) {
  const resolved = await resolveMatchRef(c.env.DB, c.req.param('matchId'));
  return resolved;
}

matchRoutes.get('/', async (c) => {
  const data = await listMatchesWithSlug(c.env.DB);
  return c.json({ data });
});

matchRoutes.get('/:matchId', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: resolved });
});

matchRoutes.get('/:matchId/events', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await eventsRepo.getMatchEvents(c.env.DB, resolved.id);
  return c.json({ data });
});

matchRoutes.get('/:matchId/lineups', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const matchId = resolved.id;

  const [homeTeam, awayTeam] = await Promise.all([
    teamsRepo.getTeam(c.env.DB, resolved.home_team_id),
    teamsRepo.getTeam(c.env.DB, resolved.away_team_id),
  ]);
  if (!homeTeam || !awayTeam) return c.json({ error: 'Teams not found' }, 404);

  const [homeDisplay, awayDisplay, raw] = await Promise.all([
    getLineupDisplayForMatch(c.env, matchId, homeTeam.id),
    getLineupDisplayForMatch(c.env, matchId, awayTeam.id),
    lineupsRepo.getMatchLineups(c.env.DB, matchId),
  ]);

  return c.json({
    data: {
      matchId,
      slug: resolved.slug,
      home: {
        teamId: homeTeam.id,
        teamName: homeTeam.name,
        formation: homeDisplay.formation,
        players: homeDisplay.displayLines,
        lineupPlayers: homeDisplay.players,
        hasAccurateLineup: homeDisplay.hasAccurateLineup,
        source: homeDisplay.source,
      },
      away: {
        teamId: awayTeam.id,
        teamName: awayTeam.name,
        formation: awayDisplay.formation,
        players: awayDisplay.displayLines,
        lineupPlayers: awayDisplay.players,
        hasAccurateLineup: awayDisplay.hasAccurateLineup,
        source: awayDisplay.source,
      },
      records: raw,
    },
  });
});

matchRoutes.get('/:matchId/history', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getHeadToHead(c.env, resolved.id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});

matchRoutes.get('/:matchId/preview', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const data = await getMatchPreviewAnalysis(c.env, resolved.id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: { ...data, slug: resolved.slug } });
});

matchRoutes.get('/:matchId/hints', async (c) => {
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const matchId = resolved.id;
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

matchRoutes.get('/:matchId/stats', async (c) => {
  const data = await getMatchStats(c.env, c.req.param('matchId'));
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json({ data });
});

matchRoutes.get('/:matchId/live', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }
  const resolved = await loadMatch(c);
  if (!resolved) return c.json({ error: 'Not found' }, 404);
  const id = c.env.MATCH_ROOM.idFromName(resolved.id);
  const stub = c.env.MATCH_ROOM.get(id);
  return stub.fetch(c.req.raw);
});
