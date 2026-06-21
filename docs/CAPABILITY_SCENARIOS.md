# Capability scenario suite

PitchIntel is validated with **22 realistic scenarios** covering every major product capability. Each scenario uses a **pass/fail rubric**: all listed criteria must be met.

## Evaluation method

| Item | Rule |
|------|------|
| **Verdict** | `PASS` only if every criterion is satisfied; otherwise `FAIL` |
| **Conditions** | Same `BASE_URL` (default production), same runner, same timeout behaviour |
| **Evidence** | JSON evidence object recorded per scenario |
| **Report** | `reports/capability-scenarios.json` written after each run |
| **Exit code** | `0` if all pass, `1` if any fail |

## Run

```bash
npm run test:scenarios
# or
BASE_URL=https://wcstat.orangecloud.vn node scripts/run-capability-scenarios.mjs
```

## Scenarios

| ID | Capability | Pass criteria (summary) |
|----|------------|-------------------------|
| S01 | Platform health | `/api/health` healthy, D1 up, production |
| S02 | Schedule completeness | 104 WC 2026 matches |
| S03 | Homepage API | dashboard + schedule + standings + probabilities |
| S04 | FIFA kickoff data | 104 fixtures with `kickoffUtc` + `fifaMatchId` |
| S05 | FIFA results seed | ≥6 completed fixtures with scores |
| S06 | Slug resolution | Mexico 2–0 SA via Vietnamese slug |
| S07 | Legacy match ID | `m-w26-ga-1v2` still resolves |
| S08 | FIFA linkage | `fifa_match_id` + kickoff match FIFA #1 |
| S09 | Probability engine | W/D/L ≈ 1, scoreline, `wc-prob-*` version |
| S10 | Favorite scorelines | Portugal favorite → tight win, not 1–1 |
| S11 | Match statistics | Completed match stats with home/away sides |
| S12 | Scenario predictions | ≥1 scenario incl. baseline |
| S13 | Group standings | 12 groups A–L |
| S14 | Knockout bracket | Non-empty bracket payload |
| S15 | News feed | ≥1 article or hot item |
| S16 | Site discovery | robots, sitemap, api-catalog |
| S17 | Public API security | 401 without key; error hints at API key |
| S18 | Preview & hints | Both endpoints 200 |
| S19 | SPA shell | `/` serves React root |
| S20 | Unit tests | `npm test` zero failures |
| S21 | Typecheck | `npm run typecheck` clean |
| S22 | FIFA lineup windows | `fifaLineupSync` vitest suite passes |

## Remediation loop

1. Run full suite → inspect `reports/capability-scenarios.json`
2. Fix root cause for each `FAIL`
3. Rerun failed scenarios, then rerun **complete** suite
4. Ship only when **22/22 PASS**
