import type { AppEnv } from '../env';
import { getTeamFormSnapshot } from './teamFormStats';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Nudge collective strength after a single completed match using xG vs opponent prior. */
export async function applyPostMatchStrengthNudge(env: AppEnv, matchId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT m.status, m.home_team_id, m.away_team_id, m.home_xg, m.away_xg,
            ht.collective_strength_rating AS home_strength,
            at.collective_strength_rating AS away_strength
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.id = ?`,
  )
    .bind(matchId)
    .first<{
      status: string;
      home_team_id: string;
      away_team_id: string;
      home_xg: number;
      away_xg: number;
      home_strength: number | null;
      away_strength: number | null;
    }>();

  if (!row || row.status !== 'completed') return;

  const homeStrength = row.home_strength ?? 0.75;
  const awayStrength = row.away_strength ?? 0.75;
  const homeExpected = 1.15 * awayStrength;
  const awayExpected = 1.05 * homeStrength;
  const homeNudge = clamp((row.home_xg - homeExpected) * 0.012, -0.03, 0.03);
  const awayNudge = clamp((row.away_xg - awayExpected) * 0.012, -0.03, 0.03);
  const now = nowIso();

  await env.DB.prepare(
    `UPDATE teams SET collective_strength_rating = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(Number(clamp(homeStrength + homeNudge, 0.35, 0.98).toFixed(3)), now, row.home_team_id)
    .run();

  await env.DB.prepare(
    `UPDATE teams SET collective_strength_rating = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(Number(clamp(awayStrength + awayNudge, 0.35, 0.98).toFixed(3)), now, row.away_team_id)
    .run();

  logInfo('post-match strength nudge applied', {
    match_id: matchId,
    home_nudge: homeNudge,
    away_nudge: awayNudge,
  });
}

/** Recompute collective_strength_rating from recent completed-match form. */
export async function refreshTeamRatingsFromForm(env: AppEnv): Promise<number> {
  const { results: teams } = await env.DB.prepare(
    `SELECT id FROM teams WHERE collective_strength_rating IS NOT NULL`,
  ).all<{ id: string }>();

  let updated = 0;
  for (const t of teams ?? []) {
    const tournamentId = t.id.startsWith('team-w26-') ? 't-2026' : undefined;
    const form = await getTeamFormSnapshot(env.DB, t.id, 8, tournamentId);
    if (!form || form.matchesPlayed < 2) continue;

    const attack = Math.min(0.98, 0.45 + form.xgForPerGame * 0.22 + form.recentForm * 0.25);
    const defense = Math.max(0.35, 0.95 - form.xgAgainstPerGame * 0.18);
    const blended = Math.max(0.35, Math.min(0.98, attack * 0.55 + defense * 0.45));

    await env.DB.prepare(`UPDATE teams SET collective_strength_rating = ?, updated_at = ? WHERE id = ?`)
      .bind(Number(blended.toFixed(3)), nowIso(), t.id)
      .run();
    updated += 1;
  }

  logInfo('team ratings refreshed from form', { updated });
  return updated;
}
