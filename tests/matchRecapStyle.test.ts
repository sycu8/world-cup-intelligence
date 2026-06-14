import { describe, it, expect } from 'vitest';
import { needsBroadcastStyleRefresh } from '../src/ai/matchRecapStyle';

describe('needsBroadcastStyleRefresh', () => {
  it('flags literal FIFA English fragments in Vietnamese field', () => {
    expect(needsBroadcastStyleRefresh('H M SON attempts an effort on goal.', 'H M SON attempts an effort on goal.')).toBe(
      true,
    );
  });

  it('flags stiff machine summary copy', () => {
    expect(
      needsBroadcastStyleRefresh(
        'Brazil beat Morocco 1-0 at MetLife Stadium. Possession 58–42.',
        'Brazil beat Morocco 1-0',
      ),
    ).toBe(true);
  });

  it('accepts broadcast-style Vietnamese recap', () => {
    expect(
      needsBroadcastStyleRefresh(
        'Mexico thắng 2-0 trước Nam Phi tại Estadio Azteca. ⚽ BÀN THẮNG! Julián Quiñones mở tỷ số phút 9.',
        'Mexico beat South Africa 2-0',
      ),
    ).toBe(false);
  });

  it('flags goal lines missing broadcast goal wording', () => {
    expect(
      needsBroadcastStyleRefresh('SAIBARI (Morocco) ghi bàn!!', 'GOAL! SAIBARI (Morocco) scores'),
    ).toBe(true);
  });
});
