import type { AppEnv } from '../env';
import { parseEnv } from '../env';
import { nowIso } from '../utils/time';
import { logInfo } from '../utils/logger';
import { mockScoreAtMinute } from '../services/matchLifecycle';
import { processMatchCompletion } from '../services/tournamentProgression';
import { resolveMatchDataProvider } from './matchDataProvider';
import { syncFifaWc2026Matches } from './fifa/fifaLiveSync';
import { syncFifaLineupsForUpcomingMatches } from './fifa/fifaLineupSync';

export type RefreshMatchDataResult = {
  updatedIds: string[];
  completedIds: string[];
};

function fifaLiveEnabled(env: AppEnv): boolean {
  const cfg = parseEnv(env);
  return cfg.fifaLiveEnabled || !cfg.mockSources;
}

/** Near-real-time refresh: FIFA Match Centre sync or mock ticks, then progression + recompute. */
export async function refreshMatchData(env: AppEnv): Promise<RefreshMatchDataResult> {
  if (fifaLiveEnabled(env)) {
    const fifa = await syncFifaWc2026Matches(env);
    await syncFifaLineupsForUpcomingMatches(env).catch(() => undefined);
    await env.KV.put('meta:last_data_refresh', nowIso(), { expirationTtl: 86400 });
    return { updatedIds: fifa.updatedIds, completedIds: fifa.completedIds };
  }

  const updatedIds: string[] = [];
  const completedIds: string[] = [];
  const now = nowIso();
  const nowMs = Date.now();
  const provider = resolveMatchDataProvider(parseEnv(env).mockSources, mockScoreAtMinute);

  const { results: candidates } = await env.DB.prepare(
    `SELECT id, minute, home_score, away_score, status, kickoff_utc
     FROM matches
     WHERE tournament_id = 't-2026' AND status IN ('scheduled', 'live')
     ORDER BY kickoff_utc ASC`,
  ).all<{
    id: string;
    minute: number;
    home_score: number;
    away_score: number;
    status: string;
    kickoff_utc: string;
  }>();

  for (const m of candidates ?? []) {
    if (!m.kickoff_utc) continue;
    const tick = provider.getLiveTick(m.id, m.kickoff_utc, nowMs);
    if (!tick) continue;

    if (tick.status === 'completed') {
      await env.DB.prepare(
        `UPDATE matches
         SET status = 'completed', minute = 90,
             home_score = ?, away_score = ?,
             updated_at = ?
         WHERE id = ? AND status != 'completed'`,
      )
        .bind(tick.homeScore, tick.awayScore, now, m.id)
        .run();
      completedIds.push(m.id);
      logInfo('match finalized', { match_id: m.id, score: `${tick.homeScore}-${tick.awayScore}`, provider: provider.name });
      continue;
    }

    if (
      m.status === 'scheduled' ||
      m.minute !== tick.minute ||
      m.home_score !== tick.homeScore ||
      m.away_score !== tick.awayScore
    ) {
      await env.DB.prepare(
        `UPDATE matches
         SET status = 'live', minute = ?,
             home_score = ?, away_score = ?,
             home_xg = home_xg + 0.02, away_xg = away_xg + 0.01,
             updated_at = ?
         WHERE id = ?`,
      )
        .bind(tick.minute, tick.homeScore, tick.awayScore, now, m.id)
        .run();
      updatedIds.push(m.id);
    }
  }

  await env.KV.put('meta:last_data_refresh', now, { expirationTtl: 86400 });
  logInfo('minute refresh complete', {
    updated: updatedIds.length,
    completed: completedIds.length,
  });
  return { updatedIds, completedIds };
}

/** Finalize scores + advance bracket for matches that just ended. */
export async function handleCompletedMatches(env: AppEnv, matchIds: string[]): Promise<void> {
  for (const matchId of matchIds) {
    await processMatchCompletion(env, matchId);
  }
}
