import type { AppEnv } from '../env';
import * as matchesRepo from '../db/repositories/matchesRepo';
import * as teamsRepo from '../db/repositories/teamsRepo';
import * as probabilityRepo from '../db/repositories/probabilityRepo';
import { getHeadToHead } from './matchHistory';
import { getLineupDisplayForMatch, formatLineupPlayerLine, type LineupPlayerEntry } from './lineupDisplay';
import { getGroupContextForMatch } from './matchGroupContext';
import { recomputeMatchProbability } from './recomputeMatch';
import { isGatewayConfigured, gatewayChatJson } from '../ai/gatewayClient';
import { nowIso } from '../utils/time';

const CACHE_PREFIX = 'preview:v4:';

function parseScorelineJson(json: string | null): Record<string, number> | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as Record<string, number>;
    return Object.keys(parsed).length ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export type LocalizedLine = { vi: string; en: string };

const LINEUP_PENDING: LocalizedLine = {
  vi: 'Chưa có thông tin chính xác, sẽ cập nhật sau.',
  en: 'No confirmed lineup yet — will update when official teams are published.',
};

function describeSideLineup(side: TeamPreviewSide, mode: 'vi' | 'en'): string {
  if (!side.hasAccurateLineup) {
    return mode === 'vi' ? LINEUP_PENDING.vi : LINEUP_PENDING.en;
  }
  const src = mode === 'vi' ? 'chính thức' : 'official';
  return `${side.teamName} (${side.formation}, ${src}): ${side.fullLineup.join('; ')}`;
}

export type TeamPreviewSide = {
  teamId: string;
  teamName: string;
  shortName: string | null;
  elo: number | null;
  fifaRanking: number | null;
  collectiveStrength: number | null;
  formation: string | null;
  lineupSource: 'official' | 'unknown';
  hasAccurateLineup: boolean;
  lineupPlayers: LineupPlayerEntry[];
  keyPlayers: string[];
  fullLineup: string[];
  recentForm: string;
  formMatches: number;
};

export type MatchPreviewAnalysis = {
  matchId: string;
  generatedAt: string;
  matchLabel: LocalizedLine;
  stage: string | null;
  groupCode: string | null;
  kickoffUtc: string;
  home: TeamPreviewSide;
  away: TeamPreviewSide;
  summary: LocalizedLine;
  sections: {
    context: LocalizedLine;
    strength: LocalizedLine;
    lineup: LocalizedLine;
    form: LocalizedLine;
    tactical: LocalizedLine;
  };
  insights: LocalizedLine[];
  probabilityNote: LocalizedLine | null;
  scorelineTop3: { score: string; prob: number }[];
  dataSources: string[];
  dataHash: string;
};

type PreviewResponse = {
  summary: string;
  summaryVi: string;
  context: string;
  contextVi: string;
  strength: string;
  strengthVi: string;
  lineup: string;
  lineupVi: string;
  form: string;
  formVi: string;
  tactical: string;
  tacticalVi: string;
  insightsVi: string[];
  insights: string[];
};

function strengthLabel(strength: number | null): { vi: string; en: string } {
  const s = strength ?? 0.75;
  if (s >= 0.85) return { vi: 'rất cao', en: 'very high' };
  if (s >= 0.75) return { vi: 'cao', en: 'high' };
  if (s >= 0.65) return { vi: 'trung bình khá', en: 'above average' };
  return { vi: 'trung bình', en: 'average' };
}

function buildMatchLabel(
  stage: string | null,
  groupCode: string | null,
  home: string,
  away: string,
): LocalizedLine {
  if (stage === 'Group' && groupCode) {
    return {
      vi: `Bảng ${groupCode}: ${home} – ${away}`,
      en: `Group ${groupCode}: ${home} vs ${away}`,
    };
  }
  if (stage) {
    return { vi: `${stage}: ${home} – ${away}`, en: `${stage}: ${home} vs ${away}` };
  }
  return { vi: `${home} – ${away}`, en: `${home} vs ${away}` };
}

function topScorelines(dist: Record<string, number> | undefined, limit = 3) {
  if (!dist) return [];
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([score, prob]) => ({ score, prob }));
}

function ruleBasedPreview(
  matchId: string,
  meta: {
    stage: string | null;
    groupCode: string | null;
    kickoffUtc: string;
    groupFixtures: { home: string; away: string }[];
  },
  home: TeamPreviewSide,
  away: TeamPreviewSide,
  prob: {
    homeWin: number;
    draw: number;
    awayWin: number;
    xgHome: number;
    xgAway: number;
    mostLikely?: string;
    scorelineDistribution?: Record<string, number>;
  } | null,
): MatchPreviewAnalysis {
  const hStr = strengthLabel(home.collectiveStrength);
  const aStr = strengthLabel(away.collectiveStrength);
  const eloGap = (home.elo ?? 1700) - (away.elo ?? 1700);
  const fav =
    prob && prob.homeWin > prob.awayWin + 0.08
      ? home.teamName
      : prob && prob.awayWin > prob.homeWin + 0.08
        ? away.teamName
        : null;

  const context: LocalizedLine = {
    vi:
      meta.groupCode && meta.groupFixtures.length
        ? `Bảng ${meta.groupCode}: còn ${meta.groupFixtures.length} trận khác (vd. ${meta.groupFixtures[0].home}–${meta.groupFixtures[0].away}). Trận này ảnh hưởng trực tiếp thứ hạng bảng.`
        : meta.stage && meta.stage !== 'Group'
          ? `Vòng ${meta.stage} — một trận loại trực tiếp, không có điểm hòa mang lại.`
          : `Trận thuộc World Cup 2026 · kickoff ${new Date(meta.kickoffUtc).toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    en:
      meta.groupCode && meta.groupFixtures.length
        ? `Group ${meta.groupCode}: ${meta.groupFixtures.length} other fixtures remain (e.g. ${meta.groupFixtures[0].home}–${meta.groupFixtures[0].away}). This match directly affects the table.`
        : meta.stage && meta.stage !== 'Group'
          ? `${meta.stage} — knockout football, no safety net from a draw.`
          : `World Cup 2026 fixture · kickoff ${new Date(meta.kickoffUtc).toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
  };

  const strength: LocalizedLine = {
    vi: `${home.teamName}: Elo ${Math.round(home.elo ?? 0)}, FIFA #${home.fifaRanking ?? '—'}, sức mạnh tập thể ${hStr.vi} (${((home.collectiveStrength ?? 0) * 100).toFixed(0)}%). ${away.teamName}: Elo ${Math.round(away.elo ?? 0)}, FIFA #${away.fifaRanking ?? '—'}, ${aStr.vi} (${((away.collectiveStrength ?? 0) * 100).toFixed(0)}%). ${
      eloGap > 35
        ? 'Chủ nhà nhỉnh hơn trên chỉ số nền.'
        : eloGap < -35
          ? 'Khách nhỉnh hơn trên chỉ số nền.'
          : 'Hai đội rất sát nhau về chỉ số nền.'
    }`,
    en: `${home.teamName}: Elo ${Math.round(home.elo ?? 0)}, FIFA #${home.fifaRanking ?? '—'}, collective ${hStr.en} (${((home.collectiveStrength ?? 0) * 100).toFixed(0)}%). ${away.teamName}: Elo ${Math.round(away.elo ?? 0)}, FIFA #${away.fifaRanking ?? '—'}, ${aStr.en} (${((away.collectiveStrength ?? 0) * 100).toFixed(0)}%). ${
      eloGap > 35
        ? 'Home side edges underlying metrics.'
        : eloGap < -35
          ? 'Away side edges underlying metrics.'
          : 'Underlying metrics are tightly matched.'
    }`,
  };

  const lineupVi = [
    home.hasAccurateLineup ? describeSideLineup(home, 'vi') : `${home.teamName}: ${LINEUP_PENDING.vi}`,
    away.hasAccurateLineup ? describeSideLineup(away, 'vi') : `${away.teamName}: ${LINEUP_PENDING.vi}`,
  ].join(' ');
  const lineupEn = [
    home.hasAccurateLineup ? describeSideLineup(home, 'en') : `${home.teamName}: ${LINEUP_PENDING.en}`,
    away.hasAccurateLineup ? describeSideLineup(away, 'en') : `${away.teamName}: ${LINEUP_PENDING.en}`,
  ].join(' ');
  const lineup: LocalizedLine =
    home.hasAccurateLineup || away.hasAccurateLineup
      ? { vi: lineupVi, en: lineupEn }
      : LINEUP_PENDING;

  const homeShape = home.formation ?? '—';
  const awayShape = away.formation ?? '—';

  const form: LocalizedLine = {
    vi:
      home.formMatches > 0 || away.formMatches > 0
        ? `Phong độ WC 2026 (${home.formMatches}/${away.formMatches} trận H2H): ${home.teamName} ${home.recentForm} · ${away.teamName} ${away.recentForm}.`
        : `Chưa có đối đầu hoàn thành tại WC 2026 giữa hai đội — phong độ bảng sẽ được cập nhật sau các lượt trận đầu.`,
    en:
      home.formMatches > 0 || away.formMatches > 0
        ? `WC 2026 H2H form (${home.formMatches}/${away.formMatches} games): ${home.teamName} ${home.recentForm} · ${away.teamName} ${away.recentForm}.`
        : `No completed WC 2026 H2H yet — form will update after earlier group games.`,
  };

  const tactical: LocalizedLine = {
    vi: fav
      ? `Mô hình nghiêng về ${fav}. xG kỳ vọng ${prob ? `${prob.xgHome.toFixed(2)}–${prob.xgAway.toFixed(2)}` : '—'} — ${homeShape} đấu ${awayShape} sẽ quyết định khoảng trống giữa các tuyến.`
      : `Thế trận cân bằng: ${homeShape} trước ${awayShape}; ai kiểm soát giữa sân sẽ kéo xG về phía mình.`,
    en: fav
      ? `Model leans ${fav}. Expected xG ${prob ? `${prob.xgHome.toFixed(2)}–${prob.xgAway.toFixed(2)}` : '—'} — ${homeShape} vs ${awayShape} should decide central space.`
      : `Balanced shape battle: ${homeShape} against ${awayShape}; midfield control should sway chance quality.`,
  };

  const versus = `${home.teamName} vs ${away.teamName}`;
  let probabilityNote: LocalizedLine | null = null;
  const insights: LocalizedLine[] = [];
  if (prob) {
    const hw = (prob.homeWin * 100).toFixed(1);
    const dr = (prob.draw * 100).toFixed(1);
    const aw = (prob.awayWin * 100).toFixed(1);
    probabilityNote = {
      vi: `Xác suất mô hình (${versus}): ${home.teamName} ${hw}% · Hòa ${dr}% · ${away.teamName} ${aw}% · xG ${prob.xgHome.toFixed(2)}–${prob.xgAway.toFixed(2)}${prob.mostLikely ? ` · Tỉ số ML ${prob.mostLikely}` : ''}.`,
      en: `Model probability (${versus}): ${home.teamName} ${hw}% · Draw ${dr}% · ${away.teamName} ${aw}% · xG ${prob.xgHome.toFixed(2)}–${prob.xgAway.toFixed(2)}${prob.mostLikely ? ` · ML ${prob.mostLikely}` : ''}.`,
    };
    insights.push({
      vi: `Tỉ số có khả năng cao: ${topScorelines(prob.scorelineDistribution).map((s) => `${s.score} (${(s.prob * 100).toFixed(1)}%)`).join(', ') || prob.mostLikely || '—'}.`,
      en: `Likely scores: ${topScorelines(prob.scorelineDistribution).map((s) => `${s.score} (${(s.prob * 100).toFixed(1)}%)`).join(', ') || prob.mostLikely || '—'}.`,
    });
  }

  const summary: LocalizedLine = {
    vi: `Phân tích ${versus}: ${home.teamName}${home.hasAccurateLineup ? ` (${homeShape})` : ''} gặp ${away.teamName}${away.hasAccurateLineup ? ` (${awayShape})` : ''}. ${fav ? `${fav} được mô hình ưu tiên.` : 'Cân tài về xác suất.'}`,
    en: `Analysis for ${versus}: ${home.teamName}${home.hasAccurateLineup ? ` (${homeShape})` : ''} vs ${away.teamName}${away.hasAccurateLineup ? ` (${awayShape})` : ''}. ${fav ? `Model favours ${fav}.` : 'Probabilities are tight.'}`,
  };

  return {
    matchId,
    generatedAt: nowIso(),
    matchLabel: buildMatchLabel(meta.stage, meta.groupCode, home.teamName, away.teamName),
    stage: meta.stage,
    groupCode: meta.groupCode,
    kickoffUtc: meta.kickoffUtc,
    home,
    away,
    summary,
    sections: { context, strength, lineup, form, tactical },
    insights,
    probabilityNote,
    scorelineTop3: topScorelines(prob?.scorelineDistribution),
    dataSources: ['teams', 'lineups', 'squads', 'h2h', 'probability_engine', 'group_fixtures'],
    dataHash: matchId,
  };
}

export async function buildMatchPreviewContext(env: AppEnv, matchId: string) {
  const match = await matchesRepo.getMatch(env.DB, matchId);
  if (!match) return null;

  const home = await teamsRepo.getTeam(env.DB, match.home_team_id);
  const away = await teamsRepo.getTeam(env.DB, match.away_team_id);
  if (!home || !away) return null;

  let snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
  if (!snap) {
    await recomputeMatchProbability(env, matchId);
    snap = await probabilityRepo.getLatestSnapshot(env.DB, matchId);
  }

  const h2h = await getHeadToHead(env, matchId);
  const groupCtx = await getGroupContextForMatch(env, matchId, match.group_code);

  const [homeDisplay, awayDisplay] = await Promise.all([
    getLineupDisplayForMatch(env, matchId, home.id),
    getLineupDisplayForMatch(env, matchId, away.id),
  ]);

  const homeSide: TeamPreviewSide = {
    teamId: home.id,
    teamName: home.name,
    shortName: home.short_name,
    elo: home.elo_rating,
    fifaRanking: home.fifa_ranking,
    collectiveStrength: home.collective_strength_rating,
    formation: homeDisplay.formation,
    lineupSource: homeDisplay.hasAccurateLineup ? 'official' : 'unknown',
    hasAccurateLineup: homeDisplay.hasAccurateLineup,
    lineupPlayers: homeDisplay.players,
    keyPlayers: homeDisplay.players.slice(0, 5).map(formatLineupPlayerLine),
    fullLineup: homeDisplay.displayLines,
    recentForm: h2h?.summary.recentFormHome ?? '—',
    formMatches: h2h?.summary.totalMatches ?? 0,
  };

  const awaySide: TeamPreviewSide = {
    teamId: away.id,
    teamName: away.name,
    shortName: away.short_name,
    elo: away.elo_rating,
    fifaRanking: away.fifa_ranking,
    collectiveStrength: away.collective_strength_rating,
    formation: awayDisplay.formation,
    lineupSource: awayDisplay.hasAccurateLineup ? 'official' : 'unknown',
    hasAccurateLineup: awayDisplay.hasAccurateLineup,
    lineupPlayers: awayDisplay.players,
    keyPlayers: awayDisplay.players.slice(0, 5).map(formatLineupPlayerLine),
    fullLineup: awayDisplay.displayLines,
    recentForm: h2h?.summary.recentFormAway ?? '—',
    formMatches: h2h?.summary.totalMatches ?? 0,
  };

  const prob = snap
    ? {
        homeWin: snap.home_win_prob,
        draw: snap.draw_prob,
        awayWin: snap.away_win_prob,
        xgHome: snap.expected_home_goals,
        xgAway: snap.expected_away_goals,
        mostLikely: snap.most_likely_score ?? undefined,
        scorelineDistribution: parseScorelineJson(snap.scoreline_json),
      }
    : null;

  const dataHash = snap?.input_hash ?? `${matchId}:${home.id}:${away.id}`;

  return {
    matchId,
    homeSide,
    awaySide,
    prob,
    dataHash,
    meta: {
      stage: match.stage,
      groupCode: match.group_code,
      kickoffUtc: match.kickoff_utc ?? '2026-06-11T19:00:00Z',
      groupFixtures: groupCtx.fixtures,
    },
  };
}

async function getCached(env: AppEnv, matchId: string, dataHash: string) {
  const raw = await env.KV.get(`${CACHE_PREFIX}${matchId}:${dataHash}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatchPreviewAnalysis;
  } catch {
    return null;
  }
}

async function aiEnhancePreview(env: AppEnv, base: MatchPreviewAnalysis): Promise<MatchPreviewAnalysis> {
  if (!isGatewayConfigured(env)) return base;

  try {
    const parsed = await gatewayChatJson<PreviewResponse>(env, 'tactical_briefing', [
      {
        role: 'system',
        content:
          'Detailed match preview for analysts. Use ONLY provided facts for THIS matchId. Unique analysis per match. JSON with vi/en fields. 3-4 sentences per section. insights: 3 short bullets each vi+en array. No betting advice.',
      },
      {
        role: 'user',
        content: `matchId=${base.matchId} stage=${base.stage} group=${base.groupCode} kickoff=${base.kickoffUtc}
Home ${base.home.teamName} elo=${base.home.elo} fifa=${base.home.fifaRanking} str=${base.home.collectiveStrength} form=${base.home.recentForm} formation=${base.home.formation} lineup=${base.home.fullLineup.join(';')}
Away ${base.away.teamName} elo=${base.away.elo} fifa=${base.away.fifaRanking} str=${base.away.collectiveStrength} form=${base.away.recentForm} formation=${base.away.formation} lineup=${base.away.fullLineup.join(';')}
${base.probabilityNote?.en ?? ''}
scorelines=${base.scorelineTop3.map((s) => `${s.score}:${s.prob}`).join(',')}
context hint: ${base.sections.context.en}

JSON keys: summaryVi, summary, contextVi, context, strengthVi, strength, lineupVi, lineup, formVi, form, tacticalVi, tactical, insightsVi[], insights[]`,
      },
    ]);

    if (parsed?.summaryVi) {
      return {
        ...base,
        summary: { vi: parsed.summaryVi.trim(), en: (parsed.summary ?? base.summary.en).trim() },
        sections: {
          context: {
            vi: (parsed.contextVi ?? base.sections.context.vi).trim(),
            en: (parsed.context ?? base.sections.context.en).trim(),
          },
          strength: {
            vi: (parsed.strengthVi ?? base.sections.strength.vi).trim(),
            en: (parsed.strength ?? base.sections.strength.en).trim(),
          },
          lineup: {
            vi: (parsed.lineupVi ?? base.sections.lineup.vi).trim(),
            en: (parsed.lineup ?? base.sections.lineup.en).trim(),
          },
          form: {
            vi: (parsed.formVi ?? base.sections.form.vi).trim(),
            en: (parsed.form ?? base.sections.form.en).trim(),
          },
          tactical: {
            vi: (parsed.tacticalVi ?? base.sections.tactical.vi).trim(),
            en: (parsed.tactical ?? base.sections.tactical.en).trim(),
          },
        },
        insights:
          parsed.insightsVi?.length && parsed.insights?.length
            ? parsed.insightsVi.map((vi, i) => ({
                vi: vi.trim(),
                en: (parsed.insights?.[i] ?? vi).trim(),
              }))
            : base.insights,
      };
    }
  } catch {
    /* rule-based */
  }

  return base;
}

export async function getMatchPreviewAnalysis(
  env: AppEnv,
  matchId: string,
): Promise<MatchPreviewAnalysis | null> {
  const ctx = await buildMatchPreviewContext(env, matchId);
  if (!ctx) return null;

  const cached = await getCached(env, matchId, ctx.dataHash);
  if (cached) return cached;

  let analysis = ruleBasedPreview(matchId, ctx.meta, ctx.homeSide, ctx.awaySide, ctx.prob);
  analysis.dataHash = ctx.dataHash;
  analysis = await aiEnhancePreview(env, analysis);

  await env.KV.put(`${CACHE_PREFIX}${matchId}:${ctx.dataHash}`, JSON.stringify(analysis), {
    expirationTtl: 3600,
  });

  return analysis;
}
