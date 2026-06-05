import type { AppEnv } from '../env';
import { SOURCE_IDS } from './sourceRegistry';
import { resolveTeamId } from '../data/teamNameMap';
import {
  STATSBOMB_WC_COMPETITION_ID,
  discoverStatsbombWcSeasons,
  parseStatsbombMatches,
  statsbombMatchUrl,
  mapStatsbombStage,
  estimateXgFromGoals,
} from './adapters/statsbombOpenData';
import { nowIso } from '../utils/time';
import { logError, logInfo } from '../utils/logger';
import { newId } from '../utils/ids';
import { refreshTeamRatingsFromForm } from '../services/teamRatingRefresh';

export type StatsbombIngestResult = {
  seasonsProcessed: number;
  matchesInserted: number;
  matchesSkipped: number;
  teamsUpdated: number;
};

export async function ingestStatsbombWorldCup(env: AppEnv): Promise<StatsbombIngestResult> {
  let matchesInserted = 0;
  let matchesSkipped = 0;
  let seasonsProcessed = 0;

  const seasons = await discoverStatsbombWcSeasons(2006);
  await env.R2_RAW.put(
    'statsbomb/wc/seasons-discovered.json',
    JSON.stringify({ seasons, pulledAt: nowIso(), source: 'github.com/statsbomb/open-data' }),
    { httpMetadata: { contentType: 'application/json' } },
  );

  for (const season of seasons) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tournaments (id, year, name, host_countries_json, teams_count, status)
       VALUES (?, ?, ?, '[]', 32, 'completed')`,
    )
      .bind(season.tournamentId, season.year, `FIFA World Cup ${season.year}`)
      .run();
    try {
      const url = statsbombMatchUrl(STATSBOMB_WC_COMPETITION_ID, season.seasonId);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'wc-tactical-platform/1.0 (statsbomb-open-data)' },
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        logError('statsbomb fetch failed', { season: season.year, status: res.status });
        continue;
      }

      const raw = await res.text();
      const r2Key = `statsbomb/wc/${season.year}/${season.seasonId}.json`;
      await env.R2_RAW.put(r2Key, raw, {
        httpMetadata: { contentType: 'application/json' },
      });

      const matches = parseStatsbombMatches(JSON.parse(raw));
      seasonsProcessed += 1;

      for (const m of matches) {
        const homeId = resolveTeamId(m.home_team.home_team_name);
        const awayId = resolveTeamId(m.away_team.away_team_name);
        if (!homeId || !awayId) {
          matchesSkipped += 1;
          continue;
        }

        const matchId = `m-sb-${m.match_id}`;
        const existing = await env.DB.prepare('SELECT id FROM matches WHERE id = ?')
          .bind(matchId)
          .first();
        if (existing) {
          matchesSkipped += 1;
          continue;
        }

        const kickoff = `${m.match_date}T${m.kick_off.replace('.000', '')}Z`;
        const homeXg = estimateXgFromGoals(m.home_score);
        const awayXg = estimateXgFromGoals(m.away_score);
        const stage = mapStatsbombStage(m.competition_stage?.name);

        await env.DB.prepare(
          `INSERT INTO matches (
            id, tournament_id, stage, home_team_id, away_team_id, venue_id,
            kickoff_utc, status, minute, home_score, away_score, home_xg, away_xg, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'v-historic', ?, 'completed', 90, ?, ?, ?, ?, ?)`,
        )
          .bind(
            matchId,
            season.tournamentId,
            stage,
            homeId,
            awayId,
            kickoff,
            m.home_score,
            m.away_score,
            homeXg,
            awayXg,
            nowIso(),
          )
          .run();

        const homeStatsId = newId('tms');
        const awayStatsId = newId('tms');
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO team_match_stats (id, match_id, team_id, xg, shots, possession)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(homeStatsId, matchId, homeId, homeXg, m.home_score * 3, 50),
          env.DB.prepare(
            `INSERT INTO team_match_stats (id, match_id, team_id, xg, shots, possession)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(awayStatsId, matchId, awayId, awayXg, m.away_score * 3, 50),
        ]);

        matchesInserted += 1;
      }
    } catch (e) {
      logError('statsbomb season ingest error', { season: season.year, error: String(e) });
    }
  }

  const teamsUpdated = await refreshTeamRatingsFromForm(env);

  await env.DB.prepare(
    `UPDATE source_registry SET health_status = 'healthy', last_success_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(nowIso(), nowIso(), SOURCE_IDS.statsbomb)
    .run();

  logInfo('statsbomb wc ingest complete', { matchesInserted, matchesSkipped, seasonsProcessed });
  return { seasonsProcessed, matchesInserted, matchesSkipped, teamsUpdated };
}
