import type { AppEnv } from '../../env';
import { parseEnv } from '../../env';
import {
  CLUB_LEAGUES,
  clubLeagueIds,
  clubMatchId,
  clubTeamId,
  type LeagueCatalogEntry,
} from '../../constants/leagues';
import { nowIso } from '../../utils/time';
import { logError, logInfo } from '../../utils/logger';
import { publishNewsArticle } from '../../services/newsPublish';
import { recomputeMatchProbability } from '../../services/recomputeMatch';
import {
  buildMockLeagueMatches,
  buildMockLeagueNews,
  buildMockLeagueScorers,
  buildMockLeagueStandings,
} from './mockLeagueData';
import {
  fetchEspnLeagueLeaders,
  fetchEspnLeagueNews,
  fetchEspnLeagueScoreboard,
  fetchEspnLeagueStandings,
  fetchTheSportsDbSeason,
} from './leagueApiClient';
import type {
  ParsedLeagueMatch,
  ParsedLeagueNews,
  ParsedLeagueScorer,
  ParsedLeagueStanding,
  ParsedLeagueTeam,
} from './parseLeagueSources';

export type LeagueSyncResult = {
  leagueId: string;
  matchesUpserted: number;
  standingsUpserted: number;
  scorersUpserted: number;
  newsInserted: number;
  source: 'espn' | 'thesportsdb' | 'mock' | 'empty';
};

function eloFromRank(rank: number): number {
  return Math.max(1200, 1850 - (rank - 1) * 18);
}

async function upsertTeam(
  env: AppEnv,
  league: LeagueCatalogEntry,
  team: ParsedLeagueTeam,
  rankHint: number,
): Promise<string> {
  const id = clubTeamId(league, team.sourceId);
  const elo = eloFromRank(rankHint);
  await env.DB.prepare(
    `INSERT INTO teams (id, name, short_name, country_code, crest_url, elo_rating, collective_strength_rating, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       short_name = excluded.short_name,
       crest_url = COALESCE(excluded.crest_url, teams.crest_url),
       elo_rating = excluded.elo_rating,
       collective_strength_rating = excluded.collective_strength_rating,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      team.name,
      team.shortName,
      team.countryCode ?? league.countryCode,
      team.crestUrl,
      elo,
      Math.max(0.35, 0.92 - (rankHint - 1) * 0.03),
      nowIso(),
    )
    .run();
  return id;
}

async function upsertMatch(env: AppEnv, league: LeagueCatalogEntry, match: ParsedLeagueMatch): Promise<string> {
  const id = clubMatchId(league, match.sourceEventId);
  const homeId = await upsertTeam(env, league, match.home, 10);
  const awayId = await upsertTeam(env, league, match.away, 10);
  await env.DB.prepare(
    `INSERT INTO matches (
       id, tournament_id, stage, group_code, home_team_id, away_team_id,
       kickoff_utc, status, minute, home_score, away_score, source_event_id, matchweek, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       stage = excluded.stage,
       group_code = excluded.group_code,
       kickoff_utc = excluded.kickoff_utc,
       status = excluded.status,
       minute = excluded.minute,
       home_score = excluded.home_score,
       away_score = excluded.away_score,
       source_event_id = excluded.source_event_id,
       matchweek = excluded.matchweek,
       updated_at = excluded.updated_at`,
  )
    .bind(
      id,
      league.id,
      match.stage,
      match.groupCode,
      homeId,
      awayId,
      match.kickoffUtc,
      match.status,
      match.minute,
      match.homeScore,
      match.awayScore,
      match.sourceEventId,
      match.matchweek,
      nowIso(),
    )
    .run();
  return id;
}

async function persistStandings(
  env: AppEnv,
  league: LeagueCatalogEntry,
  rows: ParsedLeagueStanding[],
): Promise<number> {
  if (!rows.length) return 0;
  await env.DB.prepare('DELETE FROM league_table_rows WHERE tournament_id = ?').bind(league.id).run();
  for (const row of rows) {
    const teamId = await upsertTeam(env, league, row.team, row.rank);
    await env.DB.prepare(
      `INSERT INTO league_table_rows (
         tournament_id, team_id, group_code, rank, played, won, drawn, lost, gf, ga, gd, points, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        league.id,
        teamId,
        row.groupCode || '',
        row.rank,
        row.played,
        row.won,
        row.drawn,
        row.lost,
        row.gf,
        row.ga,
        row.gd,
        row.points,
        nowIso(),
      )
      .run();
  }
  return rows.length;
}

async function persistScorers(
  env: AppEnv,
  league: LeagueCatalogEntry,
  scorers: ParsedLeagueScorer[],
): Promise<number> {
  if (!scorers.length) return 0;
  await env.DB.prepare('DELETE FROM league_scorers WHERE tournament_id = ?').bind(league.id).run();
  for (const scorer of scorers) {
    const playerId = `player-${league.slug}-${scorer.sourcePlayerId}`;
    const teamId = scorer.sourceTeamId ? clubTeamId(league, scorer.sourceTeamId) : null;
    await env.DB.prepare(
      `INSERT INTO players (id, name, primary_team_id, club, profile_status)
       VALUES (?, ?, ?, ?, 'active')
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, club = excluded.club, primary_team_id = excluded.primary_team_id`,
    )
      .bind(playerId, scorer.playerName, teamId, scorer.teamName)
      .run();
    await env.DB.prepare(
      `INSERT INTO league_scorers (
         tournament_id, player_id, team_id, player_name, team_name, goals, rank, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(league.id, playerId, teamId, scorer.playerName, scorer.teamName, scorer.goals, scorer.rank, nowIso())
      .run();
  }
  return scorers.length;
}

async function persistNews(
  env: AppEnv,
  league: LeagueCatalogEntry,
  articles: ParsedLeagueNews[],
): Promise<number> {
  let inserted = 0;
  const feed = {
    id: `espn-${league.slug}`,
    name: `ESPN ${league.shortName}`,
    publisher: 'ESPN',
    url: `https://www.espn.com/soccer/${league.espnSlug ?? league.slug}`,
    reliability: 0.8,
    tournamentId: league.id,
  };
  for (const article of articles.slice(0, 8)) {
    const docId = await publishNewsArticle(env, feed, {
      title: article.title,
      link: article.url,
      description: article.description,
      pubDate: article.publishedAt,
      imageUrl: article.imageUrl,
    });
    if (docId) inserted++;
  }
  return inserted;
}

async function loadRemoteLeague(league: LeagueCatalogEntry): Promise<{
  matches: ParsedLeagueMatch[];
  standings: ParsedLeagueStanding[];
  scorers: ParsedLeagueScorer[];
  news: ParsedLeagueNews[];
  source: LeagueSyncResult['source'];
}> {
  if (league.espnSlug) {
    const [matches, standings, scorers, news] = await Promise.all([
      fetchEspnLeagueScoreboard(league.espnSlug),
      fetchEspnLeagueStandings(league.espnSlug),
      fetchEspnLeagueLeaders(league.espnSlug),
      fetchEspnLeagueNews(league.espnSlug),
    ]);
    if (matches.length || standings.length) {
      return { matches, standings, scorers, news, source: 'espn' };
    }
  }

  if (league.theSportsDbId) {
    const remote = await fetchTheSportsDbSeason(league.theSportsDbId, league.season);
    if (remote.matches.length || remote.standings.length) {
      return { ...remote, scorers: [], news: [], source: 'thesportsdb' };
    }
  }

  return { matches: [], standings: [], scorers: [], news: [], source: 'empty' };
}

export async function syncLeague(env: AppEnv, league: LeagueCatalogEntry): Promise<LeagueSyncResult> {
  const mockSources = parseEnv(env).mockSources;
  const data = mockSources
    ? {
        matches: buildMockLeagueMatches(league),
        standings: buildMockLeagueStandings(league),
        scorers: buildMockLeagueScorers(league),
        news: buildMockLeagueNews(league),
        source: 'mock' as const,
      }
    : await loadRemoteLeague(league);

  const useMockFallback = !mockSources && data.source === 'empty';
  const payload = useMockFallback
    ? {
        matches: buildMockLeagueMatches(league),
        standings: buildMockLeagueStandings(league),
        scorers: buildMockLeagueScorers(league),
        news: buildMockLeagueNews(league),
        source: 'mock' as const,
      }
    : data;

  let matchesUpserted = 0;
  for (const match of payload.matches) {
    await upsertMatch(env, league, match);
    matchesUpserted++;
  }
  const standingsUpserted = await persistStandings(env, league, payload.standings);
  const scorersUpserted = await persistScorers(env, league, payload.scorers);
  const newsInserted = await persistNews(env, league, payload.news).catch(() => 0);

  logInfo('league sync', {
    league: league.slug,
    source: payload.source,
    matchesUpserted,
    standingsUpserted,
    scorersUpserted,
    newsInserted,
  });

  return {
    leagueId: league.id,
    matchesUpserted,
    standingsUpserted,
    scorersUpserted,
    newsInserted,
    source: payload.source,
  };
}

/** Queue W/D/L + scoreline recompute for scheduled/live club-league matches (WC parity). */
export async function queueClubLeagueProbabilities(env: AppEnv, limit = 32): Promise<number> {
  const ids = clubLeagueIds();
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const matchIds =
    (
      await env.DB.prepare(
        `SELECT id FROM matches
         WHERE tournament_id IN (${placeholders})
           AND status IN ('scheduled', 'live')
         ORDER BY kickoff_utc ASC
         LIMIT ?`,
      )
        .bind(...ids, limit)
        .all<{ id: string }>()
    ).results?.map((r) => r.id) ?? [];

  if (!matchIds.length) return 0;

  if (env.MODEL_QUEUE) {
    await env.MODEL_QUEUE.send({ type: 'recompute_all', matchIds });
  } else {
    for (const id of matchIds.slice(0, 12)) {
      await recomputeMatchProbability(env, id).catch(() => undefined);
    }
  }
  logInfo('club league probabilities queued', { count: matchIds.length });
  return matchIds.length;
}

export async function syncAllClubLeagues(env: AppEnv): Promise<LeagueSyncResult[]> {
  const results: LeagueSyncResult[] = [];
  for (const league of CLUB_LEAGUES) {
    try {
      results.push(await syncLeague(env, league));
    } catch (error) {
      logError('league sync failed', { league: league.slug, error: String(error) });
      results.push({
        leagueId: league.id,
        matchesUpserted: 0,
        standingsUpserted: 0,
        scorersUpserted: 0,
        newsInserted: 0,
        source: 'empty',
      });
    }
  }
  await env.KV.put('meta:last_league_sync', nowIso(), { expirationTtl: 86400 }).catch(() => undefined);
  await queueClubLeagueProbabilities(env).catch((error) => {
    logError('club league probability queue failed', { error: String(error) });
  });
  return results;
}
