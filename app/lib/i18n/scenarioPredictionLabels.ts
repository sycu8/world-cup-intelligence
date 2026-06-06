import type { DisplayMode } from './I18nContext';
import type { MatchPredictionScenario, MatchScenarioSet } from '../api';
import { pct } from '../format';

function pick(mode: DisplayMode, vi: string, en: string): string {
  return mode === 'en' ? en : vi;
}

export const PREDICTION_SCENARIO_LABELS: Record<string, { vi: string; en: string }> = {
  baseline_expected_flow: { vi: 'Trận diễn biến theo kế hoạch', en: 'Controlled possession match' },
  early_goal_swing: { vi: 'Bàn sớm làm lệch thế trận', en: 'Early transition swing' },
  low_event_controlled_match: { vi: 'Trận ít bàn, kiểm soát', en: 'Low-event controlled match' },
  high_event_open_match: { vi: 'Trận mở, nhiều cơ hội', en: 'High-event open match' },
  set_piece_decider: { vi: 'Tình huống cố định quyết định', en: 'Set-piece decider' },
  red_card_disruption: { vi: 'Thẻ đỏ làm đảo chiều', en: 'Red card disruption' },
  lineup_surprise: { vi: 'Đội hình bất ngờ', en: 'Lineup surprise' },
  key_player_absence: { vi: 'Vắng cầu thủ chủ chốt', en: 'Key player absence' },
  pressing_breakthrough: { vi: 'Ép sân tạo bước đột phá', en: 'Pressing breakthrough' },
  low_block_frustration: { vi: 'Phòng ngự sâu gây bế tắc', en: 'Low block frustration' },
  transition_dominance: { vi: 'Phản công chiếm ưu thế', en: 'Transition dominance' },
  late_bench_impact: { vi: 'Chiều sâu băng ghế cuối trận', en: 'Late bench impact' },
  extra_time_path: { vi: 'Khả năng hiệp phụ', en: 'Extra time path' },
  penalty_shootout_path: { vi: 'Khả năng loạt penalty', en: 'Penalty shootout path' },
};

const CONDITION_LABELS: Record<string, { vi: string; en: string }> = {
  'Home team uses strongest available XI': {
    vi: 'Đội chủ nhà ra sân đội hình mạnh nhất',
    en: 'Home team uses strongest available XI',
  },
  'Away team defends in mid/low block': {
    vi: 'Đội khách phòng ngự khối giữa/thấp',
    en: 'Away team defends in mid/low block',
  },
  'Match tempo remains medium': { vi: 'Nhịp trận ở mức trung bình', en: 'Match tempo remains medium' },
  'Possession advantage side': { vi: 'Phe kiểm soát bóng', en: 'Possession advantage side' },
  'Transition chances created': { vi: 'Cơ hội phản công được tạo ra', en: 'Transition chances created' },
  'Central possession volatility': { vi: 'Biến động kiểm soát bóng khu trung tuyến', en: 'Central possession volatility' },
  'First goal before minute 30': { vi: 'Bàn mở tỷ số trước phút 30', en: 'First goal before minute 30' },
  'Home possession share': { vi: 'Tỷ lệ kiểm soát bóng đội chủ nhà', en: 'Home possession share' },
  'Away xG after 30 minutes': { vi: 'xG đội khách sau 30 phút', en: 'Away xG after 30 minutes' },
  'Early red card': { vi: 'Thẻ đỏ sớm', en: 'Early red card' },
  'High-value transition sequence': {
    vi: 'Chuỗi phản công chất lượng cao',
    en: 'High-value transition sequence',
  },
  'Match tempo increase': { vi: 'Nhịp trận tăng', en: 'Match tempo increase' },
  'Early red card for transition side': {
    vi: 'Thẻ đỏ sớm cho phe phản công',
    en: 'Early red card for transition side',
  },
};

const THRESHOLD_LABELS: Record<string, { vi: string; en: string }> = {
  '> 56%': { vi: '> 56%', en: '> 56%' },
  '< 0.35': { vi: '< 0,35 xG', en: '< 0.35' },
  'before 60': { vi: 'trước phút 60', en: 'before 60' },
  'xG swing >= 0.25': { vi: 'biến động xG ≥ 0,25', en: 'xG swing >= 0.25' },
  'tempo > baseline': { vi: 'nhịp > mốc cơ sở', en: 'tempo > baseline' },
  'invalidates open shape': { vi: 'phá vỡ thế trận mở', en: 'invalidates open shape' },
};

const STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  not_triggered: { vi: 'Chưa kích hoạt', en: 'Not triggered' },
  partially_triggered: { vi: 'Kích hoạt một phần', en: 'Partially triggered' },
  triggered: { vi: 'Đã kích hoạt', en: 'Triggered' },
  valid: { vi: 'Hợp lệ', en: 'Valid' },
  at_risk: { vi: 'Có rủi ro', en: 'At risk' },
  invalidated: { vi: 'Đã vô hiệu', en: 'Invalidated' },
};

const LEGACY_FACTOR_LABELS: Record<string, { vi: string; en: string }> = {
  'High tempo increases early-phase chance volume.': {
    vi: 'Nhịp cao làm tăng cơ hội trong giai đoạn đầu.',
    en: 'High tempo increases early-phase chance volume.',
  },
  'Expected goals support first-half scoring.': {
    vi: 'xG hỗ trợ khả năng ghi bàn hiệp 1.',
    en: 'Expected goals support first-half scoring.',
  },
  'Bench depth and game-state fatigue factor.': {
    vi: 'Chiều sâu băng ghế và mệt mỏi ảnh hưởng cuối trận.',
    en: 'Bench depth and game-state fatigue factor.',
  },
  'Attack strengths suggest both sides can score.': {
    vi: 'Sức tấn công cho thấy cả hai đội đều có thể ghi bàn.',
    en: 'Attack strengths suggest both sides can score.',
  },
  'Low combined xG implies fewer scoring events.': {
    vi: 'Tổng xG thấp → ít tình huống ghi bàn.',
    en: 'Low combined xG implies fewer scoring events.',
  },
  'Elevated xG supports an open match profile.': {
    vi: 'xG cao → trận mở, nhiều cơ hội.',
    en: 'Elevated xG supports an open match profile.',
  },
  'Set-piece indices above baseline for one or both sides.': {
    vi: 'Chỉ số tình huống cố định trên mốc cơ sở.',
    en: 'Set-piece indices above baseline for one or both sides.',
  },
  'High-event profile correlates with discipline volatility.': {
    vi: 'Trận nhiều sự kiện → rủi ro thẻ cao hơn.',
    en: 'High-event profile correlates with discipline volatility.',
  },
  'Knockout stage increases draw / ET path.': {
    vi: 'Vòng knock-out tăng khả năng hòa / hiệp phụ.',
    en: 'Knockout stage increases draw / ET path.',
  },
  'Group stage — ET rare.': { vi: 'Vòng bảng — hiệp phụ hiếm.', en: 'Group stage — ET rare.' },
  'Tied knockout matches may reach penalties.': {
    vi: 'Trận knock-out hòa có thể đến loạt penalty.',
    en: 'Tied knockout matches may reach penalties.',
  },
  'Group matches rarely go to pens.': {
    vi: 'Trận vòng bảng hiếm khi đến penalty.',
    en: 'Group matches rarely go to pens.',
  },
};

export function predictionScenarioLabel(
  scenarioType: string,
  fallbackName: string,
  mode: DisplayMode,
): string {
  const row = PREDICTION_SCENARIO_LABELS[scenarioType];
  if (row) return pick(mode, row.vi, row.en);
  return fallbackName;
}

export function conditionLabel(condition: string, mode: DisplayMode): string {
  const row = CONDITION_LABELS[condition];
  if (row) return pick(mode, row.vi, row.en);
  return condition;
}

export function thresholdLabel(threshold: string | number, mode: DisplayMode): string {
  const key = String(threshold);
  const row = THRESHOLD_LABELS[key];
  if (row) return pick(mode, row.vi, row.en);
  return key;
}

export function scenarioStatusLabel(status: string, mode: DisplayMode): string {
  const row = STATUS_LABELS[status];
  if (row) return pick(mode, row.vi, row.en);
  return status;
}

export function legacyFactorLabel(text: string, mode: DisplayMode): string {
  const row = LEGACY_FACTOR_LABELS[text];
  if (row) return pick(mode, row.vi, row.en);
  return translateKeyDriver(text, mode);
}

function translateScenarioLikelihoodLine(line: string, mode: DisplayMode): string {
  if (mode === 'en') return line;

  const likelihood = line.match(
    /^Scenario likelihood ([\d.]+)% with model confidence ([\d.]+)%\.$/,
  );
  if (likelihood) {
    return `Xác suất kịch bản ${likelihood[1]}% · độ tin cậy mô hình ${likelihood[2]}%.`;
  }

  const conditional = line.match(/^Conditional W\/D\/L: ([\d.]+)\/([\d.]+)\/([\d.]+)\.$/);
  if (conditional) {
    return `W/D/L có điều kiện: ${conditional[1]}/${conditional[2]}/${conditional[3]}.`;
  }

  return line;
}

/** Format scenario field values — ratios 0–1 as %, booleans as Có/Không. */
export function formatScenarioMetricValue(
  value: string | number | boolean | undefined,
  mode: DisplayMode,
): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') {
    return pick(mode, value ? 'Có' : 'Không', value ? 'Yes' : 'No');
  }
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1) return pct(value);
    return String(value);
  }
  const s = String(value);
  if (s === 'pending') return pick(mode, 'Chờ dữ liệu', 'Pending');
  const proxy = s.match(/^(\d+)% proxy$/);
  if (proxy) return `${proxy[1]}%`;
  if (/^\d+(\.\d+)?%$/.test(s)) return s;
  return s;
}

function translateKeyDriver(line: string, mode: DisplayMode): string {
  if (mode === 'en') return line;

  const scenarioLine = translateScenarioLikelihoodLine(line, mode);
  if (scenarioLine !== line) return scenarioLine;

  const collective = line.match(/^(.+) collective strength (\d+)%$/);
  if (collective) return `Sức mạnh tập thể ${collective[1]}: ${collective[2]}%`;

  const compact = line.match(/^(.+) defensive compactness (\d+)%$/);
  if (compact) return `Độ compact phòng ngự ${compact[1]}: ${compact[2]}%`;

  const xg = line.match(/^Engine xG ([\d.]+)[–-]([\d.]+)$/);
  if (xg) return `xG mô hình: ${xg[1]}–${xg[2]}`;

  if (line.startsWith('Missing inputs:')) {
    return line.replace('Missing inputs:', 'Thiếu dữ liệu:');
  }
  if (line.startsWith('All required inputs available for ')) {
    const type = line.replace('All required inputs available for ', '').replace(/\.$/, '');
    const label = PREDICTION_SCENARIO_LABELS[type]?.vi ?? type;
    return `Đủ dữ liệu cho kịch bản ${label}.`;
  }
  if (line.startsWith('Missing inputs reduce model confidence:')) {
    return line.replace(
      'Missing inputs reduce model confidence:',
      'Thiếu dữ liệu làm giảm độ tin cậy mô hình:',
    );
  }

  return line;
}

function translateRiskFactor(line: string, mode: DisplayMode): string {
  if (mode === 'en') return line;
  if (line === 'Lineups may still be projected rather than confirmed.') {
    return 'Đội hình có thể vẫn là dự kiến, chưa xác nhận chính thức.';
  }
  if (line === 'Alternative path depends on early-phase game-state shifts.') {
    return 'Nhánh thay thế phụ thuộc diễn biến sớm của trận.';
  }
  return line;
}

export function translateScenarioDriver(text: string, mode: DisplayMode): string {
  return translateKeyDriver(text, mode);
}

export function translateScenarioRisk(text: string, mode: DisplayMode): string {
  return translateRiskFactor(text, mode);
}

export function translateComparisonSummary(
  summary: string,
  scenarios: MatchPredictionScenario[],
  mode: DisplayMode,
  homeName: string,
  awayName: string,
): string {
  if (mode === 'en') return summary;

  const baseline = scenarios.find((s) => s.isBaseline) ?? scenarios[0];
  const alternative = scenarios.find((s) => s.id !== baseline?.id) ?? scenarios[1];
  const altLabel = alternative
    ? predictionScenarioLabel(alternative.scenarioType, alternative.scenarioName, mode)
    : '';
  const baseLabel = baseline
    ? predictionScenarioLabel(baseline.scenarioType, baseline.scenarioName, mode)
    : '';

  if (summary.includes('remains more likely')) {
    const awayShift = summary.includes('away win');
    const side = awayShift ? awayName || 'đội khách' : homeName || 'đội chủ nhà';
    return `Kịch bản cơ sở vẫn có khả năng cao hơn, nhưng ${altLabel.toLowerCase()} làm lệch đáng kể xác suất thắng ${side}.`;
  }
  if (summary.includes('tightly balanced') || summary.includes('Scenario likelihood is tightly balanced')) {
    return `Xác suất kịch bản cân bằng giữa ${baseLabel.toLowerCase()} và ${altLabel.toLowerCase()}.`;
  }
  return summary;
}

export function translateComparisonDifference(
  line: string,
  mode: DisplayMode,
  homeName: string,
  awayName: string,
): string {
  if (mode === 'en') return line;

  const gap = line.match(/^Scenario likelihood gap: ([\d.]+) percentage points$/);
  if (gap) return `Chênh xác suất kịch bản: ${gap[1]} điểm %`;

  const homeDelta = line.match(/^Home win delta: ([\d.-]+) pp$/);
  if (homeDelta) {
    const name = homeName || 'Chủ nhà';
    return `Chênh thắng ${name}: ${homeDelta[1]} điểm %`;
  }

  const awayDelta = line.match(/^Away win delta: ([\d.-]+) pp$/);
  if (awayDelta) {
    const name = awayName || 'Khách';
    return `Chênh thắng ${name}: ${awayDelta[1]} điểm %`;
  }

  const drawDelta = line.match(/^Draw delta: ([\d.-]+) pp$/);
  if (drawDelta) return `Chênh hòa: ${drawDelta[1]} điểm %`;

  const xgDelta = line.match(/^xG delta: ([\d.-]+) \/ ([\d.-]+)$/);
  if (xgDelta) return `Chênh xG: ${xgDelta[1]} / ${xgDelta[2]}`;

  const score = line.match(/^Most likely score: (.+) vs (.+)$/);
  if (score) return `Tỉ số khả dĩ nhất: ${score[1]} so với ${score[2]}`;

  return line;
}

export function localizeScenarioSet(
  data: MatchScenarioSet,
  mode: DisplayMode,
  homeName: string,
  awayName: string,
): MatchScenarioSet {
  if (mode === 'en') return data;

  return {
    ...data,
    scenarios: data.scenarios.map((s) => ({
      ...s,
      scenarioName: predictionScenarioLabel(s.scenarioType, s.scenarioName, mode),
      initialConditions: s.initialConditions.map((c) => ({
        ...c,
        condition: conditionLabel(c.condition, mode),
      })),
      triggerConditions: s.triggerConditions.map((t) => ({
        ...t,
        condition: conditionLabel(t.condition, mode),
        threshold: thresholdLabel(t.threshold, mode),
      })),
      invalidationConditions: s.invalidationConditions.map((t) => ({
        ...t,
        condition: conditionLabel(t.condition, mode),
        threshold: thresholdLabel(t.threshold, mode),
      })),
      keyDrivers: s.keyDrivers.map((d) => translateKeyDriver(d, mode)),
      riskFactors: s.riskFactors.map((r) => translateRiskFactor(r, mode)),
    })),
    comparison: {
      ...data.comparison,
      summary: translateComparisonSummary(data.comparison.summary, data.scenarios, mode, homeName, awayName),
      keyDifferences: data.comparison.keyDifferences.map((d) =>
        translateComparisonDifference(d, mode, homeName, awayName),
      ),
    },
  };
}
