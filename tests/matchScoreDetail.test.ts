import { describe, expect, it } from 'vitest';
import {
  deriveScoreDetailFromFifa,
  deriveScoreDetailFromGoalRows,
  parseScoreDetailJson,
} from '../src/services/matchScoreDetail';
import type { FifaMatchInfo } from '../src/ingestion/fifa/fifaApiClient';

describe('matchScoreDetail', () => {
  it('derives half-time and second-half goals from FIFA periods', () => {
    const info = {
      HomeTeam: {
        Goals: [
          { Period: 3, Minute: "9'" },
          { Period: 5, Minute: "67'" },
        ],
      },
      AwayTeam: {
        Goals: [{ Period: 3, Minute: "44'" }],
      },
    } as FifaMatchInfo;

    const detail = deriveScoreDetailFromFifa(info);
    expect(detail?.ht).toEqual({ home: 1, away: 1 });
    expect(detail?.secondHalf).toEqual({ home: 1, away: 0 });
    expect(detail?.ft90).toEqual({ home: 2, away: 1 });
  });

  it('captures extra time, penalties, and stoppage', () => {
    const info = {
      HomeTeam: {
        Goals: [
          { Period: 3, Minute: "10'" },
          { Period: 5, Minute: "88'" },
          { Period: 6, Minute: "106'" },
          { Period: 8, Minute: "1'" },
          { Period: 8, Minute: "2'" },
          { Period: 8, Minute: "3'" },
          { Period: 8, Minute: "4'" },
        ],
      },
      AwayTeam: {
        Goals: [
          { Period: 5, Minute: "90+3'" },
          { Period: 7, Minute: "120+1'" },
          { Period: 8, Minute: "1'" },
          { Period: 8, Minute: "2'" },
          { Period: 8, Minute: "3'" },
          { Period: 8, Minute: "4'" },
          { Period: 8, Minute: "5'" },
        ],
      },
    } as FifaMatchInfo;

    const detail = deriveScoreDetailFromFifa(info);
    expect(detail?.extraTime).toEqual({ home: 1, away: 1 });
    expect(detail?.penalties).toEqual({ home: 4, away: 5 });
    expect(detail?.stoppage?.secondHalf).toBe(3);
    expect(detail?.stoppage?.extraTimeSecond).toBe(1);
  });

  it('derives from stored goal event rows', () => {
    const detail = deriveScoreDetailFromGoalRows(
      [
        { team_id: 'h', minute: 9, period: '1H', event_type: 'goal' },
        { team_id: 'h', minute: 67, period: '2H', event_type: 'goal' },
        { team_id: 'a', minute: 92, period: '2H', event_type: 'red_card' },
      ],
      'h',
      'a',
    );
    expect(detail?.ht).toEqual({ home: 1, away: 0 });
    expect(detail?.secondHalf).toEqual({ home: 1, away: 0 });
    expect(detail?.stoppage?.secondHalf).toBe(2);
  });

  it('parses stored JSON', () => {
    const raw = '{"ht":{"home":1,"away":0},"stoppage":{"secondHalf":2}}';
    expect(parseScoreDetailJson(raw)?.ht).toEqual({ home: 1, away: 0 });
    expect(parseScoreDetailJson('bad')).toBeNull();
  });
});
