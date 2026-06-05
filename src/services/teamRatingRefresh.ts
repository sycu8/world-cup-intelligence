import type { AppEnv } from '../env';
import { getTeamFormSnapshot } from './teamFormStats';
import { logInfo } from '../utils/logger';
import { nowIso } from '../utils/time';

/** Recompute collective_strength_rating from recent completed-match form. */
export async function refreshTeamRatingsFromForm(env: AppEnv): Promise<number> {
  const { results: teams } = await env.DB.prepare(
    `SELECT id FROM teams WHERE collective_strength_rating IS NOT NULL AND id NOT LIKE 'team-w26-%'`,
  ).all<{ id: string }>();

  let updated = 0;
  for (const t of teams ?? []) {
    const form = await getTeamFormSnapshot(env.DB, t.id, 8);
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
