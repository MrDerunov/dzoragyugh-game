import { describe, expect, it } from 'vitest';
import { getVerdict } from './verdicts';
import type { GameStats } from './types';

const stats = (over: Partial<GameStats> = {}): GameStats => ({
  score: 500, combo: 0, maxCombo: 0,
  villageHealth: 100, teacherPatience: 100,
  russianismsDestroyed: 0, sheepSaved: 0, sheepTapped: 0,
  gataCollected: 0, mistakes: 0, taps: 10,
  ...over,
});

describe('getVerdict', () => {
  it('пороги здоровья деревни', () => {
    const cases: [number, string][] = [
      [100, 'saved'], [75, 'saved'],
      [74, 'survived'], [40, 'survived'],
      [39, 'repair'], [15, 'repair'],
      [14, 'gata'], [1, 'gata'],
      [0, 'dead'],
    ];
    for (const [health, tier] of cases) {
      const v = getVerdict(stats({ villageHealth: health }), () => 0);
      expect(v.tier).toBe(tier);
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.diagnosis.length).toBeGreaterThan(0);
    }
  });

  it('нулевая активность — «Наблюдатель ОБСЕ»', () => {
    const v = getVerdict(stats({ taps: 0, villageHealth: 0 }), () => 0);
    expect(v.title).toBe('Наблюдатель ОБСЕ');
  });

  it('идеальный результат', () => {
    const v = getVerdict(stats({ villageHealth: 100, mistakes: 0, taps: 5 }), () => 0);
    expect(v.title).toBe('НЕВОЗМОЖНЫЙ РЕЗУЛЬТАТ');
  });

  it('детерминирован при фиксированном random', () => {
    const s = stats({ villageHealth: 50 });
    expect(getVerdict(s, () => 0.3)).toEqual(getVerdict(s, () => 0.3));
  });
});
