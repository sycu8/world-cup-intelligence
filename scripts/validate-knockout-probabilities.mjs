/**
 * Validate knockout-stage probabilities, data points, and W/D/L predictions (R32 → Final).
 *
 * Usage:
 *   node scripts/validate-knockout-probabilities.mjs
 *   BASE_URL=https://wcstat.orangecloud.vn node scripts/validate-knockout-probabilities.mjs
 *   node scripts/validate-knockout-probabilities.mjs --json > reports/knockout-validation.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.BASE_URL ?? 'https://wcstat.orangecloud.vn').replace(/\/$/, '');
const jsonOut = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

const STAGE_ORDER = [
  'Round of 32',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third place',
  'Final',
];

const STAGE_VI = {
  'Round of 32': 'Vòng 1/16',
  'Round of 16': 'Vòng 1/8',
  'Quarter-final': 'Tứ kết',
  'Semi-final': 'Bán kết',
  'Third place': 'Tranh hạng 3',
  Final: 'Chung kết',
};

const EXPECTED_COUNTS = {
  'Round of 32': 16,
  'Round of 16': 8,
  'Quarter-final': 4,
  'Semi-final': 2,
  'Third place': 1,
  Final: 1,
};

function isPlaceholderTeam(name) {
  if (!name) return true;
  return /TBD|Bảng .* · Đội|Winner of|Loser of/i.test(name);
}

function approxOne(n, tol = 0.02) {
  return typeof n === 'number' && Math.abs(n - 1) <= tol;
}

async function fetchJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function validateMatch(stage, match, triple) {
  const issues = [];
  const warnings = [];
  const home = match.homeName;
  const away = match.awayName;
  const placeholderHome = isPlaceholderTeam(home);
  const placeholderAway = isPlaceholderTeam(away);
  const resolved = !placeholderHome && !placeholderAway;

  if (!triple) {
    issues.push('missing_probability');
    return { issues, warnings, resolved, placeholderHome, placeholderAway };
  }

  const hw = triple.homeWin ?? triple.homeWinProb;
  const dr = triple.draw ?? triple.drawProb;
  const aw = triple.awayWin ?? triple.awayWinProb;
  const sum = hw + dr + aw;

  if (!approxOne(sum)) issues.push(`wdl_sum_${sum.toFixed(4)}`);
  if ([hw, dr, aw].some((v) => typeof v !== 'number' || v < 0 || v > 1)) {
    issues.push('prob_out_of_range');
  }
  if (resolved && Math.abs(hw - aw) < 0.02 && Math.abs(hw - dr) < 0.02) {
    warnings.push('flat_wdl_resolved_teams');
  }
  if ((placeholderHome || placeholderAway) && !resolved) {
    warnings.push('placeholder_team');
  }
  if (stage !== 'Group' && dr > 0.38) {
    warnings.push(`high_draw_${dr.toFixed(2)}`);
  }

  return {
    issues,
    warnings,
    resolved,
    placeholderHome,
    placeholderAway,
    hw,
    dr,
    aw,
    sum,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const [bracketRes, probRes, bulkMetaRes] = await Promise.all([
    fetchJson('/api/tournaments/2026/bracket'),
    fetchJson('/api/tournaments/2026/match-probabilities'),
    fetchJson('/api/tournaments/2026/match-probabilities'),
  ]);

  const report = {
    startedAt,
    baseUrl: BASE_URL,
    pass: true,
    stages: {},
    totals: {
      matches: 0,
      withProbability: 0,
      resolvedTeams: 0,
      placeholderTeams: 0,
      hardIssues: 0,
      warnings: 0,
      uniqueTriples: 0,
    },
    issues: [],
    warnings: [],
    samples: [],
  };

  if (bracketRes.status !== 200) {
    report.pass = false;
    report.issues.push(`bracket_http_${bracketRes.status}`);
  }
  if (probRes.status !== 200) {
    report.pass = false;
    report.issues.push(`probabilities_http_${probRes.status}`);
  }

  const rounds = bracketRes.body?.data?.rounds ?? [];
  const probMap = probRes.body?.data ?? {};
  const bulkMeta = bulkMetaRes.body?.meta ?? {};

  const tripleKeys = new Set();

  for (const stage of STAGE_ORDER) {
    const round = rounds.find((r) => r.stage === stage);
    const matches = round?.matches ?? [];
    const expected = EXPECTED_COUNTS[stage] ?? 0;
    const stageReport = {
      vi: STAGE_VI[stage] ?? stage,
      expected,
      actual: matches.length,
      withProbability: 0,
      resolvedTeams: 0,
      avgDraw: 0,
      avgHomeWin: 0,
      issues: [],
      warnings: [],
      matches: [],
    };

    if (matches.length !== expected) {
      stageReport.issues.push(`count_mismatch expected=${expected} actual=${matches.length}`);
      report.pass = false;
    }

    let drawSum = 0;
    let homeSum = 0;

    for (const m of matches) {
      report.totals.matches += 1;
      const triple = probMap[m.id];
      const v = validateMatch(stage, m, triple);
      if (triple) {
        stageReport.withProbability += 1;
        report.totals.withProbability += 1;
        drawSum += v.dr ?? 0;
        homeSum += v.hw ?? 0;
        tripleKeys.add(`${(v.hw ?? 0).toFixed(3)}|${(v.dr ?? 0).toFixed(3)}|${(v.aw ?? 0).toFixed(3)}`);
      }
      if (v.resolved) {
        stageReport.resolvedTeams += 1;
        report.totals.resolvedTeams += 1;
      } else {
        report.totals.placeholderTeams += 1;
      }

      for (const issue of v.issues) {
        const msg = `${m.id} (${stage}): ${issue}`;
        stageReport.issues.push(msg);
        report.issues.push(msg);
        report.totals.hardIssues += 1;
        report.pass = false;
      }
      for (const warn of v.warnings) {
        const msg = `${m.id} (${stage}): ${warn}`;
        stageReport.warnings.push(msg);
        report.warnings.push(msg);
        report.totals.warnings += 1;
        if (strict && warn === 'placeholder_team') report.pass = false;
      }

      stageReport.matches.push({
        id: m.id,
        home: m.homeName,
        away: m.awayName,
        status: m.status,
        resolved: v.resolved,
        wdl: triple
          ? {
              homeWin: Number((v.hw ?? 0).toFixed(3)),
              draw: Number((v.dr ?? 0).toFixed(3)),
              awayWin: Number((v.aw ?? 0).toFixed(3)),
            }
          : null,
      });
    }

    if (stageReport.withProbability > 0) {
      stageReport.avgDraw = drawSum / stageReport.withProbability;
      stageReport.avgHomeWin = homeSum / stageReport.withProbability;
    }

    report.stages[stage] = stageReport;
    report.samples.push(...stageReport.matches.slice(0, 2));
  }

  report.totals.uniqueTriples = tripleKeys.size;
  report.bulkMeta = bulkMeta;

  if (bulkMeta.total !== 104 || bulkMeta.withProbability !== 104) {
    report.warnings.push(
      `bulk_meta total=${bulkMeta.total} withProbability=${bulkMeta.withProbability}`,
    );
  }
  if (report.totals.resolvedTeams === 0) {
    report.warnings.push(
      'all_knockout_slots_placeholder — xác suất dựa trên TBD (elo 1500); sẽ cập nhật khi bảng kết thúc',
    );
  }
  if (report.totals.uniqueTriples <= report.totals.matches / 2) {
    report.warnings.push(
      `low_probability_diversity uniqueTriples=${report.totals.uniqueTriples}/${report.totals.matches}`,
    );
  }

  report.finishedAt = new Date().toISOString();

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Knockout probability validation — ${BASE_URL}`);
    console.log(`Result: ${report.pass ? 'PASS' : 'FAIL'} | matches ${report.totals.matches} | prob ${report.totals.withProbability}/${report.totals.matches} | resolved teams ${report.totals.resolvedTeams}/${report.totals.matches}`);
    console.log(`Unique W/D/L triples: ${report.totals.uniqueTriples} | warnings: ${report.totals.warnings} | hard issues: ${report.totals.hardIssues}`);
    for (const stage of STAGE_ORDER) {
      const s = report.stages[stage];
      if (!s) continue;
      console.log(
        `\n${s.vi} (${stage}): ${s.actual}/${s.expected} trận | xác suất ${s.withProbability}/${s.actual} | đội xác định ${s.resolvedTeams}/${s.actual} | draw TB ${s.avgDraw.toFixed(3)} | home TB ${s.avgHomeWin.toFixed(3)}`,
      );
      for (const m of s.matches.slice(0, 3)) {
        const w = m.wdl ? `${m.wdl.homeWin}/${m.wdl.draw}/${m.wdl.awayWin}` : '—';
        console.log(`  ${m.home.slice(0, 28).padEnd(28)} vs ${m.away.slice(0, 28).padEnd(28)} ${w}${m.resolved ? '' : ' [TBD]'}`);
      }
      if (s.matches.length > 3) console.log(`  … +${s.matches.length - 3} trận`);
    }
    if (report.issues.length) {
      console.log('\nHard issues:');
      for (const i of report.issues.slice(0, 15)) console.log(`  - ${i}`);
    }
    if (report.warnings.length) {
      console.log('\nWarnings:');
      for (const w of report.warnings.slice(0, 10)) console.log(`  - ${w}`);
    }
  }

  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'reports/knockout-validation.json'), JSON.stringify(report, null, 2));

  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
