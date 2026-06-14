/**
 * Fetches WC 2026 fixtures from FIFA Match Centre API (scores-fixtures feed).
 * @see https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIFA_API =
  'https://api.fifa.com/api/v3/calendar/matches?from=2026-06-01T00:00:00Z&to=2026-07-20T23:59:59Z&count=500&language=en&IdSeason=285023';

const headers = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.fifa.com',
  Referer: 'https://www.fifa.com/',
  'User-Agent': 'wc-tactical-platform/1.0 (FIFA schedule sync)',
};

const res = await fetch(FIFA_API, { headers, signal: AbortSignal.timeout(30_000) });
if (!res.ok) {
  throw new Error(`FIFA calendar fetch failed: ${res.status} ${res.statusText}`);
}

const data = await res.json();
const wc = (data.Results ?? [])
  .filter((m) => m.IdCompetition === '17')
  .sort((a, b) => a.MatchNumber - b.MatchNumber);

if (wc.length !== 104) {
  throw new Error(`Expected 104 WC 2026 matches, got ${wc.length}`);
}

const rows = wc.map((m) => ({
  fifaNumber: m.MatchNumber,
  kickoffUtc: m.Date,
  localDate: m.LocalDate ?? null,
  fifaMatchId: m.IdMatch,
  home: m.Home?.IdCountry ?? null,
  away: m.Away?.IdCountry ?? null,
  homeScore: m.HomeTeamScore ?? m.Home?.Score ?? null,
  awayScore: m.AwayTeamScore ?? m.Away?.Score ?? null,
  matchStatus: m.MatchStatus,
  completed: m.MatchStatus === 0,
}));

const outPath = path.join(__dirname, 'wc2026-fifa-kickoffs.json');
writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath} (${rows.length} matches, ${rows.filter((r) => r.completed).length} completed)`);
