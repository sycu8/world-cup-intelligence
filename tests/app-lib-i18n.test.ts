import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../app/lib/i18n/I18nContext';
import { messages, type LocaleKey } from '../app/lib/i18n/locales';
import {
  metricLabel,
  scenarioTypeLabel,
  tacticalIdentityLabel,
} from '../app/lib/i18n/termLabels';
import {
  formatLocalizedVersus,
  groupStageLabel,
  KNOCKOUT_STAGE_ORDER,
  matchStageLabel,
  matchVersusSeparator,
} from '../app/lib/i18n/stageLabels';

describe('locales messages', () => {
  it('has vi and en strings for every key', () => {
    const keys = Object.keys(messages) as LocaleKey[];
    expect(keys.length).toBeGreaterThan(200);

    for (const key of keys) {
      const entry = messages[key];
      expect(entry, key).toBeDefined();
      expect(typeof entry.vi, `${key}.vi`).toBe('string');
      expect(typeof entry.en, `${key}.en`).toBe('string');
      expect(entry.vi.trim().length, `${key}.vi`).toBeGreaterThan(0);
      expect(entry.en.trim().length, `${key}.en`).toBeGreaterThan(0);
    }
  });

  it('uses unique locale keys', () => {
    const keys = Object.keys(messages);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('I18nProvider', () => {
  it('translates with t() in default vi mode', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });
    expect(result.current.mode).toBe('vi');
    expect(result.current.t('nav.home')).toBe(messages['nav.home'].vi);
  });

  it('switches language with setMode', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });

    act(() => result.current.setMode('en'));
    expect(result.current.mode).toBe('en');
    expect(result.current.t('nav.home')).toBe(messages['nav.home'].en);
    expect(localStorage.getItem('wc-display-mode')).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    act(() => result.current.setMode('vi'));
    expect(result.current.t('nav.home')).toBe(messages['nav.home'].vi);
    expect(document.documentElement.lang).toBe('vi');
  });

  it('exposes pair() with both locales', () => {
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });
    expect(result.current.pair('nav.home')).toEqual(messages['nav.home']);
  });

  it('falls back to vi for legacy stored modes', () => {
    localStorage.setItem('wc-display-mode', 'bilingual');
    const { result } = renderHook(() => useI18n(), { wrapper: I18nProvider });
    expect(result.current.mode).toBe('vi');
  });

  it('throws when useI18n is used outside provider', () => {
    expect(() => renderHook(() => useI18n())).toThrow(/I18nProvider/);
  });
});

describe('termLabels', () => {
  it('localizes known scenario and metric keys', () => {
    expect(scenarioTypeLabel('early_goal_0_15', 'vi')).toContain('Bàn');
    expect(scenarioTypeLabel('early_goal_0_15', 'en')).toContain('Early goal');
    expect(tacticalIdentityLabel('high_press_collective', 'en')).toBe('High press collective');
    expect(metricLabel('Pressing', 'vi')).toBe('Ép sân');
  });

  it('falls back for unknown keys', () => {
    expect(scenarioTypeLabel('custom_scenario', 'en')).toBe('custom scenario');
    expect(metricLabel('Unknown', 'vi')).toBe('Unknown');
  });
});

describe('stageLabels', () => {
  const t = (key: LocaleKey) => messages[key].vi;

  it('exports knockout stage order', () => {
    expect(KNOCKOUT_STAGE_ORDER).toContain('Final');
    expect(KNOCKOUT_STAGE_ORDER.length).toBe(6);
  });

  it('localizes match stages', () => {
    expect(matchStageLabel('Final', t)).toBe(messages['history.stageFinal'].vi);
    expect(matchStageLabel(null, t)).toBe(messages['history.matchStage'].vi);
    expect(matchStageLabel('Playoff', t)).toBe('Playoff');
  });

  it('formats group and versus labels', () => {
    expect(groupStageLabel('A', t)).toContain('A');
    expect(matchVersusSeparator('vi')).toBe(' gặp ');
    expect(matchVersusSeparator('en')).toBe(' vs ');
    expect(formatLocalizedVersus('USA', 'Mexico', 'vi')).toBe('USA gặp Mexico');
    expect(formatLocalizedVersus('', 'Brazil', 'en')).toBe('Brazil');
  });
});
