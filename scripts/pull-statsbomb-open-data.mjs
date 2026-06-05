#!/usr/bin/env node
/**
 * Pull FIFA World Cup match data from StatsBomb open-data (GitHub) into remote D1.
 * @see https://github.com/statsbomb/open-data
 *
 * Usage: node scripts/pull-statsbomb-open-data.mjs [--local]
 */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const WC_COMPETITION_ID = 43;
const MIN_YEAR = 2006;

const TEAM_NAME_TO_ID = {
  Argentina: 'team-arg',
  Brazil: 'team-bra',
  France: 'team-fra',
  England: 'team-eng',
  'United States': 'team-usa',
  USA: 'team-usa',
  Mexico: 'team-mex',
  Germany: 'team-ger',
  Spain: 'team-esp',
  Portugal: 'team-por',
  Netherlands: 'team-ned',
  Belgium: 'team-bel',
  Croatia: 'team-cro',
  Morocco: 'team-mar',
  Japan: 'team-jpn',
  'South Korea': 'team-kor',
  'Korea Republic': 'team-kor',
  Uruguay: 'team-uru',
  Colombia: 'team-col',
  Switzerland: 'team-sui',
  Senegal: 'team-sen',
  Iran: 'team-irn',
  Denmark: 'team-den',
  Australia: 'team-aus',
  'Saudi Arabia': 'team-ksa',
  Ecuador: 'team-ecu',
  Canada: 'team-can',
  Poland: 'team-pol',
  Serbia: 'team-srb',
  Wales: 'team-wal',
  Ghana: 'team-gha',
  Cameroon: 'team-cmr',
  'Costa Rica': 'team-cri',
  Tunisia: 'team-tun',
  Qatar: 'team-qat',
  Russia: 'team-rus',
  Iceland: 'team-isl',
  Panama: 'team-pan',
  Peru: 'team-per',
  Sweden: 'team-swe',
  Nigeria: 'team-nga',
  Egypt: 'team-egy',
};

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function mapStage(name) {
  if (!name) return 'Group';
  const n = name.toLowerCase();
  if (n.includes('quarter')) return 'QF';
  if (n.includes('semi')) return 'SF';
  if (n.includes('final')) return 'Final';
  if (n.includes('round of 16') || n.includes('last 16')) return 'R16';
  if (n.includes('third')) return '3rd Place';
  return 'Group';
}

function estimateXg(goals) {
  return Math.max(0.15, goals * 0.85 + 0.35);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'wc-tactical-platform/1.0 (statsbomb-open-data-pull)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function main() {
  const local = process.argv.includes('--local');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outFile = join(root, 'tmp-statsbomb-pull.sql');

  console.log('Fetching competitions.json from StatsBomb open-data...');
  const competitions = await fetchJson(`${BASE}/competitions.json`);
  const seasons = competitions
    .filter(
      (r) =>
        r.competition_id === WC_COMPETITION_ID &&
        r.competition_name === 'FIFA World Cup' &&
        r.competition_gender === 'male' &&
        !r.competition_youth &&
        r.match_available != null &&
        /^\d{4}$/.test(r.season_name) &&
        Number(r.season_name) >= MIN_YEAR,
    )
    .map((r) => ({
      seasonId: r.season_id,
      year: Number(r.season_name),
      tournamentId: `t-${r.season_name}`,
    }))
    .sort((a, b) => b.year - a.year);

  console.log(`World Cup seasons to pull: ${seasons.map((s) => s.year).join(', ')}`);

  const header = [
    '-- StatsBomb open-data pull — https://github.com/statsbomb/open-data',
    `UPDATE source_registry SET health_status = 'healthy', last_success_at = datetime('now'), updated_at = datetime('now') WHERE id = 'src-statsbomb';`,
  ];
  const matchGroups = [];

  let inserted = 0;
  let skipped = 0;
  const teamsNeeded = new Set();

  for (const season of seasons) {
    header.push(
      `INSERT OR IGNORE INTO tournaments (id, year, name, host_countries_json, teams_count, status) VALUES ('${season.tournamentId}', ${season.year}, 'FIFA World Cup ${season.year}', '[]', 32, 'completed');`,
    );

    const url = `${BASE}/matches/${WC_COMPETITION_ID}/${season.seasonId}.json`;
    console.log(`Pulling ${season.year} (${url})...`);
    const matches = await fetchJson(url);

    for (const m of matches) {
      const homeName = m.home_team?.home_team_name;
      const awayName = m.away_team?.away_team_name;
      const homeId = TEAM_NAME_TO_ID[homeName];
      const awayId = TEAM_NAME_TO_ID[awayName];
      if (!homeId || !awayId) {
        skipped += 1;
        continue;
      }

      teamsNeeded.add(homeId);
      teamsNeeded.add(awayId);

      const matchId = `m-sb-${m.match_id}`;
      const kickoff = `${m.match_date}T${String(m.kick_off).replace('.000', '')}Z`;
      const stage = mapStage(m.competition_stage?.name);
      const homeXg = estimateXg(m.home_score);
      const awayXg = estimateXg(m.away_score);

      matchGroups.push([
        `INSERT OR IGNORE INTO matches (id, tournament_id, stage, home_team_id, away_team_id, venue_id, kickoff_utc, status, minute, home_score, away_score, home_xg, away_xg, updated_at) VALUES ('${matchId}', '${season.tournamentId}', '${sqlEscape(stage)}', '${homeId}', '${awayId}', 'v-historic', '${kickoff}', 'completed', 90, ${m.home_score}, ${m.away_score}, ${homeXg.toFixed(3)}, ${awayXg.toFixed(3)}, datetime('now'));`,
        `INSERT OR IGNORE INTO team_match_stats (id, match_id, team_id, xg, shots, possession) VALUES ('tms-sb-${m.match_id}-h', '${matchId}', '${homeId}', ${homeXg.toFixed(3)}, ${m.home_score * 3}, 50);`,
        `INSERT OR IGNORE INTO team_match_stats (id, match_id, team_id, xg, shots, possession) VALUES ('tms-sb-${m.match_id}-a', '${matchId}', '${awayId}', ${awayXg.toFixed(3)}, ${m.away_score * 3}, 50);`,
      ]);
      inserted += 1;
    }
  }

  const lines = [...header];
  writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
  console.log(`SQL written: ${outFile} (${inserted} matches, ${skipped} skipped, ${teamsNeeded.size} teams)`);

  const flag = local ? '' : '--remote';
  const groupsPerBatch = 12;
  const allGroups = matchGroups;
  for (let i = 0; i < allGroups.length; i += groupsPerBatch) {
    const chunk = [
      ...header,
      ...allGroups.slice(i, i + groupsPerBatch).flat(),
    ];
    const chunkFile = join(root, `tmp-statsbomb-pull-${i}.sql`);
    writeFileSync(chunkFile, chunk.join('\n') + '\n', 'utf8');
    const cmd = `npx wrangler d1 execute wc-tactical-db ${flag} --file="${chunkFile}"`.trim();
    console.log(`Applying batch ${Math.floor(i / groupsPerBatch) + 1}/${Math.ceil(allGroups.length / groupsPerBatch)}...`);
    execSync(cmd, { cwd: root, stdio: 'inherit' });
  }

  const countCmd = `npx wrangler d1 execute wc-tactical-db ${flag} --command "SELECT COUNT(*) AS n FROM matches WHERE id LIKE 'm-sb-%'"`;
  execSync(countCmd, { cwd: root, stdio: 'inherit' });

  if (inserted > 0) {
    const kvCmd =
      `npx wrangler kv key put bulk_recompute_wc2026 "statsbomb-pull-script" --namespace-id=fe99c19c60a542ea9771111b5ae050da ${flag}`.trim();
    console.log('Scheduling WC 2026 bulk recompute...');
    execSync(kvCmd, { cwd: root, stdio: 'inherit' });
  }

  console.log('StatsBomb open-data pull complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
