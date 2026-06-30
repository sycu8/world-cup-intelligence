/**
 * Compare internal WC 2026 schedule vs FIFA Match Centre kickoff data.
 * Run: node scripts/validate-fifa-schedule.mjs [--api https://wcstat.orangecloud.vn]
 */
import { GROUPS, KNOCKOUT_MATCHES } from './fifa-wc2026-official-data.mjs';
import { NATION_ISO } from './nationIsoCodes.mjs';
import { allFifaKickoffs } from './wc2026-fifa-kickoffs.mjs';
import { resolvedGroupMatches } from './fifa-wc2026-official-data.mjs';

const apiBase = process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : 'https://wcstat.orangecloud.vn';

/** @param {string} short */
function fifaShortToTeamId(short) {
  const nation = Object.entries(NATION_ISO).find(([, m]) => m.short === short)?.[0];
  if (!nation) return null;
  for (const [group, teams] of Object.entries(GROUPS)) {
    const slot = teams.indexOf(nation) + 1;
    if (slot > 0) return `team-w26-${group.toLowerCase()}${slot}`;
  }
  return null;
}

const byFifaNumber = new Map(allFifaKickoffs().map((r) => [r.fifaNumber, r]));
const internalById = new Map(
  [...resolvedGroupMatches(), ...KNOCKOUT_MATCHES].map((m) => [m.matchId, m]),
);

const res = await fetch(`${apiBase}/api/schedule`);
if (!res.ok) {
  console.error(`API fetch failed: ${res.status}`);
  process.exit(1);
}
const body = await res.json();
const byDate = body.data?.byDate ?? body.byDate ?? {};
const matches = Object.values(byDate).flat();

let mismatches = 0;
for (const m of matches) {
  const internal = internalById.get(m.id);
  if (!internal?.fifaNumber) continue;
  const fifa = byFifaNumber.get(internal.fifaNumber);
  if (!fifa?.home || !fifa?.away) continue;

  const expectedHome = fifaShortToTeamId(fifa.home);
  const expectedAway = fifaShortToTeamId(fifa.away);
  const homeOk = (m.home_team_id ?? m.homeTeamId) === expectedHome;
  const awayOk = (m.away_team_id ?? m.awayTeamId) === expectedAway;

  if (!homeOk || !awayOk) {
    mismatches += 1;
    const homeLabel = m.home_name ?? m.homeTeamName ?? m.home_team_id ?? m.homeTeamId;
    const awayLabel = m.away_name ?? m.awayTeamName ?? m.away_team_id ?? m.awayTeamId;
    console.log(
      `MISMATCH ${m.id} (FIFA #${internal.fifaNumber}):`,
      `prod ${homeLabel} vs ${awayLabel}`,
      `→ FIFA ${fifa.home} vs ${fifa.away}`,
    );
  }
}

if (mismatches === 0) {
  console.log(`OK — all ${matches.length} scheduled matches align with FIFA pairings`);
} else {
  console.error(`Found ${mismatches} pairing mismatch(es)`);
  process.exit(1);
}
