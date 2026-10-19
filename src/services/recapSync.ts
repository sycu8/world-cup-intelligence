import type { AppEnv } from '../env';
import { loadTeamMatchStatsCompleteness } from '../ingestion/fifa/teamMatchStatsComplete';
import { logError } from '../utils/logger';

/** One recap sync per match. A later GET waits until this claim expires. */
export const RECAP_SYNC_CLAIM_MS = 10 * 60_000;

export const RECAP_SYNC_CLAIMS_SQL = `CREATE TABLE IF NOT EXISTS recap_sync_claims (
  match_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  last_sync_at INTEGER
)`;

/** Take the claim only when it is missing or already expired. */
export const RECAP_SYNC_CLAIM_SQL = `INSERT INTO recap_sync_claims (match_id, expires_at, last_sync_at)
 VALUES (?, ?, NULL)
 ON CONFLICT(match_id) DO UPDATE SET expires_at = excluded.expires_at
 WHERE recap_sync_claims.expires_at <= ?
 RETURNING match_id`;

type RecapMatch = {
  id: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
};

async function ensureClaims(env: AppEnv): Promise<void> {
  await env.DB.prepare(RECAP_SYNC_CLAIMS_SQL).run();
}

/**
 * True only when team stats are incomplete and this match has not synced for
 * 10 minutes. A D1 error does not queue.
 */
export async function recapNeedsSync(env: AppEnv, match: RecapMatch, now = Date.now()): Promise<boolean> {
  if (match.status !== 'live' && match.status !== 'completed') return false;
  try {
    const { complete } = await loadTeamMatchStatsCompleteness(
      env.DB,
      match.id,
      match.home_team_id,
      match.away_team_id,
    );
    if (complete) return false;
    await ensureClaims(env);
    const row = await env.DB.prepare(`SELECT last_sync_at FROM recap_sync_claims WHERE match_id = ?`)
      .bind(match.id)
      .first<{ last_sync_at: number | null }>();
    const last = row?.last_sync_at;
    if (last == null || !Number.isFinite(Number(last))) return true;
    return now - Number(last) > RECAP_SYNC_CLAIM_MS;
  } catch (error) {
    logError('recap needs-sync failed', { matchId: match.id, error: String(error) });
    return false;
  }
}

/** True when this caller holds the 10 minute claim. */
export async function claimRecapSync(env: AppEnv, matchId: string, now = Date.now()): Promise<boolean> {
  const expiresAt = now + RECAP_SYNC_CLAIM_MS;
  try {
    await ensureClaims(env);
    const row = await env.DB.prepare(RECAP_SYNC_CLAIM_SQL)
      .bind(matchId, expiresAt, now)
      .first<{ match_id: string }>();
    return row?.match_id === matchId;
  } catch (error) {
    logError('recap sync claim failed', { matchId, error: String(error) });
    return false;
  }
}

export async function markRecapSynced(env: AppEnv, matchId: string, now = Date.now()): Promise<void> {
  try {
    await ensureClaims(env);
    await env.DB.prepare(
      `INSERT INTO recap_sync_claims (match_id, expires_at, last_sync_at) VALUES (?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
    )
      .bind(matchId, now + RECAP_SYNC_CLAIM_MS, now)
      .run();
  } catch (error) {
    logError('recap sync stamp failed', { matchId, error: String(error) });
  }
}
