import { describe, expect, it } from 'vitest';
import {
  conditionLabel,
  formatScenarioMetricValue,
  legacyFactorLabel,
  localizeScenarioSet,
  predictionScenarioLabel,
  PREDICTION_SCENARIO_LABELS,
  scenarioStatusLabel,
  thresholdLabel,
  translateComparisonDifference,
  translateComparisonSummary,
  translateScenarioDriver,
  translateScenarioRisk,
} from '../app/lib/i18n/scenarioPredictionLabels';
import type { MatchScenarioSet } from '../app/lib/api';
import { sampleScenarioSet } from './helpers/smokeFixtures';

describe('scenarioPredictionLabels VI', () => {
  it('translates Scenario likelihood explanation lines', () => {
    expect(
      translateScenarioDriver('Scenario likelihood 42.5% with model confidence 71%.', 'vi'),
    ).toBe('Xác suất kịch bản 42.5% · độ tin cậy mô hình 71%.');
    expect(translateScenarioDriver('Conditional W/D/L: 45/28/27.', 'vi')).toBe(
      'W/D/L có điều kiện: 45/28/27.',
    );
  });

  it('translates legacy collective strength via legacyFactorLabel', () => {
    expect(legacyFactorLabel('Argentina collective strength 88%', 'vi')).toBe(
      'Sức mạnh tập thể Argentina: 88%',
    );
    expect(legacyFactorLabel('High tempo increases early-phase chance volume.', 'vi')).toContain('Nhịp cao');
  });

  it('translates comparison summary and gap lines', () => {
    const scenarios = sampleScenarioSet.scenarios;

    expect(
      translateComparisonSummary(
        'Scenario likelihood is tightly balanced between controlled possession match and early transition swing.',
        scenarios,
        'vi',
        'Argentina',
        'France',
      ),
    ).toContain('Xác suất kịch bản cân bằng');

    expect(
      translateComparisonSummary(
        'Scenario likelihood remains more likely for baseline but early transition swing shifts away win probability.',
        scenarios,
        'vi',
        'Argentina',
        '',
      ),
    ).toContain('đội khách');

    expect(
      translateComparisonDifference('Scenario likelihood gap: 3.2 percentage points', 'vi', 'Argentina', 'France'),
    ).toBe('Chênh xác suất kịch bản: 3.2 điểm %');

    expect(translateComparisonDifference('Home win delta: 0.05 pp', 'vi', 'USA', 'Mexico')).toContain('USA');
    expect(translateComparisonDifference('Away win delta: -0.07 pp', 'vi', 'USA', 'Mexico')).toContain('Mexico');
    expect(translateComparisonDifference('Draw delta: 0.02 pp', 'vi', 'USA', 'Mexico')).toContain('Chênh hòa');
    expect(translateComparisonDifference('xG delta: 0.2 / -0.2', 'vi', 'USA', 'Mexico')).toContain('Chênh xG');
    expect(translateComparisonDifference('Most likely score: 1-1 vs 1-2', 'vi', 'USA', 'Mexico')).toContain('1-1');
  });

  it('localizes scenario set key drivers in VI mode', () => {
    const localized = localizeScenarioSet(sampleScenarioSet, 'vi', 'USA', 'Mexico');
    expect(localized.scenarios[0].keyDrivers[0]).toContain('Xác suất kịch bản');
    expect(localized.comparison.keyDifferences[0]).toContain('Chênh xác suất');
  });

  it('returns EN unchanged for comparison helpers', () => {
    const summary = 'Scenario likelihood is tightly balanced between a and b.';
    expect(translateComparisonSummary(summary, sampleScenarioSet.scenarios, 'en', 'A', 'B')).toBe(summary);
    expect(translateComparisonDifference('Scenario likelihood gap: 1.0 percentage points', 'en', 'A', 'B')).toBe(
      'Scenario likelihood gap: 1.0 percentage points',
    );
    expect(localizeScenarioSet(sampleScenarioSet, 'en', 'A', 'B')).toBe(sampleScenarioSet);
  });

  it('labels scenarios, conditions, thresholds, and metrics', () => {
    expect(predictionScenarioLabel('baseline_expected_flow', 'Fallback', 'vi')).toContain('kế hoạch');
    expect(predictionScenarioLabel('unknown_type', 'Fallback', 'vi')).toBe('Fallback');
    expect(conditionLabel('Home team uses strongest available XI', 'vi')).toContain('đội hình mạnh nhất');
    expect(thresholdLabel('before 60', 'vi')).toBe('trước phút 60');
    expect(scenarioStatusLabel('triggered', 'vi')).toBe('Đã kích hoạt');

    expect(formatScenarioMetricValue(undefined, 'vi')).toBe('—');
    expect(formatScenarioMetricValue(true, 'vi')).toBe('Có');
    expect(formatScenarioMetricValue(false, 'en')).toBe('No');
    expect(formatScenarioMetricValue(0.42, 'vi')).toBe('42.0%');
    expect(formatScenarioMetricValue('pending', 'vi')).toBe('Chờ dữ liệu');
    expect(formatScenarioMetricValue('42% proxy', 'vi')).toBe('42%');
    expect(formatScenarioMetricValue('12.5%', 'vi')).toBe('12.5%');
    expect(formatScenarioMetricValue(2, 'vi')).toBe('2');
  });

  it('translates key drivers, risk factors, and legacy labels', () => {
    expect(translateScenarioDriver('Mexico defensive compactness 72%', 'vi')).toContain('compact phòng ngự');
    expect(translateScenarioDriver('Engine xG 1.2-1.8', 'vi')).toContain('xG mô hình');
    expect(translateScenarioDriver('Missing inputs: lineup', 'vi')).toContain('Thiếu dữ liệu');
    expect(
      translateScenarioDriver('All required inputs available for baseline_expected_flow.', 'vi'),
    ).toContain('Đủ dữ liệu');
    expect(translateScenarioDriver('Missing inputs reduce model confidence: lineup', 'vi')).toContain(
      'Thiếu dữ liệu làm giảm',
    );

    expect(translateScenarioRisk('Lineups may still be projected rather than confirmed.', 'vi')).toContain(
      'dự kiến',
    );
    expect(translateScenarioRisk('Alternative path depends on early-phase game-state shifts.', 'vi')).toContain(
      'Nhánh thay thế',
    );
    expect(translateScenarioRisk('Unknown risk', 'en')).toBe('Unknown risk');
  });

  it('translates legacy factor catalog entries', () => {
    expect(legacyFactorLabel('Expected goals support first-half scoring.', 'vi')).toContain('hiệp 1');
    expect(legacyFactorLabel('Bench depth and game-state fatigue factor.', 'vi')).toContain('băng ghế');
    expect(legacyFactorLabel('Attack strengths suggest both sides can score.', 'vi')).toContain('ghi bàn');
    expect(legacyFactorLabel('Low combined xG implies fewer scoring events.', 'vi')).toContain('xG');
    expect(legacyFactorLabel('Elevated xG supports an open match profile.', 'vi')).toContain('mở');
    expect(legacyFactorLabel('Set-piece indices above baseline for one or both sides.', 'vi')).toContain('cố định');
    expect(legacyFactorLabel('High-event profile correlates with discipline volatility.', 'vi')).toContain('thẻ');
    expect(legacyFactorLabel('Knockout stage increases draw / ET path.', 'vi')).toContain('knock');
    expect(legacyFactorLabel('Group stage — ET rare.', 'vi')).toContain('Vòng bảng');
    expect(legacyFactorLabel('Tied knockout matches may reach penalties.', 'vi')).toContain('penalty');
    expect(legacyFactorLabel('Group matches rarely go to pens.', 'vi')).toContain('penalty');
  });

  it('translates home-side comparison summary shift', () => {
    const scenarios = sampleScenarioSet.scenarios;
    expect(
      translateComparisonSummary(
        'Scenario likelihood remains more likely for baseline but early transition swing shifts home win probability.',
        scenarios,
        'vi',
        'USA',
        'Mexico',
      ),
    ).toContain('USA');
  });

  it('covers all prediction scenario, condition, threshold, and status labels in VI', () => {
    for (const key of Object.keys(PREDICTION_SCENARIO_LABELS)) {
      expect(predictionScenarioLabel(key, 'Fallback', 'vi')).not.toBe('Fallback');
      expect(predictionScenarioLabel(key, 'Fallback', 'en')).toBeTruthy();
    }

    const conditions = [
      'Away team defends in mid/low block',
      'Match tempo remains medium',
      'Possession advantage side',
      'Transition chances created',
      'Central possession volatility',
      'First goal before minute 30',
      'Home possession share',
      'Away xG after 30 minutes',
      'Early red card',
      'High-value transition sequence',
      'Match tempo increase',
      'Early red card for transition side',
    ];
    for (const c of conditions) {
      expect(conditionLabel(c, 'vi')).not.toBe(c);
    }

    for (const th of ['> 56%', '< 0.35', 'xG swing >= 0.25', 'tempo > baseline', 'invalidates open shape']) {
      expect(thresholdLabel(th, 'vi')).toBeTruthy();
    }

    for (const st of ['not_triggered', 'partially_triggered', 'valid', 'at_risk', 'invalidated']) {
      expect(scenarioStatusLabel(st, 'vi')).not.toBe(st);
    }

    expect(translateComparisonDifference('Unknown delta line', 'vi', 'A', 'B')).toBe('Unknown delta line');
    expect(translateComparisonSummary('Some other summary text.', sampleScenarioSet.scenarios, 'vi', 'A', 'B')).toBe(
      'Some other summary text.',
    );
  });

  it('returns EN catalog labels and driver fallbacks', () => {
    expect(predictionScenarioLabel('baseline_expected_flow', 'Fallback', 'en')).toContain('Controlled');
    expect(conditionLabel('Home team uses strongest available XI', 'en')).toBe(
      'Home team uses strongest available XI',
    );
    expect(thresholdLabel('before 60', 'en')).toBe('before 60');
    expect(thresholdLabel(60, 'en')).toBe('60');
    expect(scenarioStatusLabel('triggered', 'en')).toBe('Triggered');
    expect(legacyFactorLabel('High tempo increases early-phase chance volume.', 'en')).toContain('High tempo');
    expect(legacyFactorLabel('Unknown custom factor line.', 'en')).toBe('Unknown custom factor line.');
    expect(formatScenarioMetricValue(true, 'en')).toBe('Yes');
    expect(formatScenarioMetricValue('pending', 'en')).toBe('Pending');
    expect(formatScenarioMetricValue(2, 'en')).toBe('2');
    expect(translateScenarioDriver('Mexico defensive compactness 72%', 'en')).toBe(
      'Mexico defensive compactness 72%',
    );
    expect(translateScenarioRisk('Lineups may still be projected rather than confirmed.', 'en')).toBe(
      'Lineups may still be projected rather than confirmed.',
    );
    expect(
      translateComparisonSummary(
        'Scenario likelihood remains more likely for baseline but early transition swing shifts home win probability.',
        sampleScenarioSet.scenarios,
        'en',
        'USA',
        'Mexico',
      ),
    ).toContain('remains more likely');
  });
});
