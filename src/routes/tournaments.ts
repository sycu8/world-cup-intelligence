import { Hono } from 'hono';
import type { AppEnv } from '../env';
import * as tournamentsRepo from '../db/repositories/tournamentsRepo';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';

import { WC2026_TOURNAMENT_ID } from '../constants/tournament';
import * as probabilityRepo from '../db/repositories/probabilityRepo';

export const tournamentRoutes = new Hono<{ Bindings: AppEnv }>();

tournamentRoutes.get('/', async (c) => {
  const data = await tournamentsRepo.listTournaments(c.env.DB);
  return c.json({ data });
});

tournamentRoutes.get('/:year', async (c) => {
  const year = Number(c.req.param('year'));
  const tournament = await tournamentsRepo.getTournamentByYear(c.env.DB, year);
  if (!tournament) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: tournament });
});

tournamentRoutes.get('/:year/matches', async (c) => {
  const year = Number(c.req.param('year'));
  const tournament = await tournamentsRepo.getTournamentByYear(c.env.DB, year);
  if (!tournament) return c.json({ error: 'Not found' }, 404);
  const matches = await matchesRepo.getMatchesByTournament(c.env.DB, tournament.id);
  return c.json({ data: matches });
});

tournamentRoutes.get('/:year/teams', async (c) => {
  const year = Number(c.req.param('year'));
  const tournament = await tournamentsRepo.getTournamentByYear(c.env.DB, year);
  if (!tournament) return c.json({ error: 'Not found' }, 404);
  const teams = await teamsRepo.getTeamsByTournament(c.env.DB, tournament.id);
  return c.json({ data: teams });
});

tournamentRoutes.get('/:year/standings', async (c) => {
  const year = Number(c.req.param('year'));
  if (year !== 2026) return c.json({ error: 'Not found' }, 404);
  const { buildGroupStandingsPayload } = await import('../services/tournamentStandings');
  const data = await buildGroupStandingsPayload(c.env);
  return c.json({ data });
});

tournamentRoutes.get('/:year/match-probabilities', async (c) => {
  const year = Number(c.req.param('year'));
  if (year !== 2026) return c.json({ error: 'Not found' }, 404);
  const rows = await probabilityRepo.listLatestSnapshotsForTournament(c.env.DB, WC2026_TOURNAMENT_ID);
  const byMatchId: Record<string, { homeWin: number; draw: number; awayWin: number }> = {};
  for (const row of rows) {
    byMatchId[row.matchId] = {
      homeWin: row.homeWinProb,
      draw: row.drawProb,
      awayWin: row.awayWinProb,
    };
  }
  return c.json({ data: byMatchId });
});

tournamentRoutes.get('/:year/bracket', async (c) => {
  const year = Number(c.req.param('year'));
  if (year !== 2026) return c.json({ error: 'Not found' }, 404);
  const { buildBracketPayload } = await import('../services/bracketPayload');
  const data = await buildBracketPayload(c.env);
  return c.json({ data });
});
