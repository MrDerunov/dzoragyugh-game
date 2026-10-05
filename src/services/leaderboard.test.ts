import { describe, expect, it } from 'vitest';
import type { StorageLike } from './types';
import { DEFAULT_SEED_ENTRIES, createLocalLeaderboard } from './leaderboard';

const makeStorage = (initial?: Record<string, string>): StorageLike => {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
};

describe('createLocalLeaderboard', () => {
  it('возвращает сид-таблицу при первом запуске', () => {
    const lb = createLocalLeaderboard('k1', undefined, makeStorage());
    const entries = lb.get();
    expect(entries).toHaveLength(DEFAULT_SEED_ENTRIES.length);
    expect(entries[0]?.score).toBeGreaterThanOrEqual(entries[entries.length - 1]!.score);
  });

  it('сохраняет только лучший результат игрока', () => {
    const lb = createLocalLeaderboard('k2', undefined, makeStorage());
    const first = lb.submit('Тест', 500, 50);
    const second = lb.submit('Тест', 700, 60);
    const third = lb.submit('Тест', 400, 90);

    expect(first.isPersonalBest).toBe(true);
    expect(second.isPersonalBest).toBe(true);
    expect(third.isPersonalBest).toBe(false);

    const entry = lb.get().find((e) => e.name === 'Тест');
    expect(entry?.score).toBe(700);
    expect(entry?.villageHealth).toBe(60);
  });

  it('считает место и находит обогнанного соперника', () => {
    const lb = createLocalLeaderboard('k3', undefined, makeStorage());
    const out = lb.submit('Новичок', 1800, 80);

    expect(out.rank).toBe(2); // Максим 1840 выше
    expect(out.beaten).toBeDefined();
    expect(out.beaten?.name).toBe('Сергей'); // 1710 — ближайший обойдённый
    expect(out.previousBest).toBe(0);
  });

  it('переживает повреждённые данные в хранилище', () => {
    const storage = makeStorage({ k4: '{not json' });
    const lb = createLocalLeaderboard('k4', undefined, storage);
    expect(lb.get().length).toBeGreaterThan(0);
  });

  it('clear() возвращает стартовую таблицу', () => {
    const lb = createLocalLeaderboard('k5', undefined, makeStorage());
    lb.submit('Тест', 9999, 100);
    lb.clear();
    expect(lb.get()).toEqual(DEFAULT_SEED_ENTRIES);
  });

  it('работает без localStorage (in-memory fallback)', () => {
    const lb = createLocalLeaderboard();
    expect(() => lb.submit('Офлайн', 100, 50)).not.toThrow();
  });
});
