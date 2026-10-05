import type {
  LeaderboardEntry,
  LeaderboardService,
  StorageLike,
  SubmitOutcome,
} from './types';

const DEFAULT_STORAGE_KEY = 'dzoragyugh.leaderboard.v1';

/** Стартовые «соседи» из геймдизайна, §2.1 — рейтинг живой с первой партии. */
export const DEFAULT_SEED_ENTRIES: LeaderboardEntry[] = [
  { name: 'Максим', score: 1840, villageHealth: 82, date: 0 },
  { name: 'Сергей', score: 1710, villageHealth: 76, date: 0 },
  { name: 'Аня', score: 1230, villageHealth: 58, date: 0 },
  { name: 'Арман', score: 870, villageHealth: 41, date: 0 },
];

const memoryFallback = (): StorageLike => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
};

const resolveStorage = (storage: StorageLike | undefined): StorageLike => {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* приватный режим и т.п. */
  }
  return memoryFallback();
};

export function createLocalLeaderboard(
  storageKey: string = DEFAULT_STORAGE_KEY,
  seedEntries: LeaderboardEntry[] = DEFAULT_SEED_ENTRIES,
  storage?: StorageLike,
): LeaderboardService {
  const store = resolveStorage(storage);
  let cache: LeaderboardEntry[] | null = null;

  const read = (): LeaderboardEntry[] => {
    if (cache) return cache;
    try {
      const raw = store.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every(
            (e): e is LeaderboardEntry =>
              typeof e === 'object' && e !== null &&
              typeof (e as LeaderboardEntry).name === 'string' &&
              typeof (e as LeaderboardEntry).score === 'number',
          )
        ) {
          cache = parsed;
          return cache;
        }
      }
    } catch {
      /* повреждённые данные — пересоздаём */
    }
    cache = [...seedEntries];
    write();
    return cache;
  };

  const write = (): void => {
    try {
      store.setItem(storageKey, JSON.stringify(cache ?? []));
    } catch {
      /* quota / приватный режим — игра продолжает работать без сохранения */
    }
  };

  const sortEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
    [...entries].sort(
      (a, b) => b.score - a.score || b.villageHealth - a.villageHealth || a.name.localeCompare(b.name),
    );

  return {
    get(): LeaderboardEntry[] {
      return sortEntries(read());
    },

    submit(name: string, score: number, villageHealth: number): SubmitOutcome {
      const trimmed = name.trim();
      const entries = read();
      const mine = entries.find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
      const previousBest = mine?.score ?? 0;

      if (!mine) {
        entries.push({ name: trimmed, score, villageHealth, date: Date.now() });
      } else if (score > mine.score) {
        mine.score = score;
        mine.villageHealth = villageHealth;
        mine.date = Date.now();
      }

      const sorted = sortEntries(entries);
      const rank = sorted.findIndex((e) => e.name.toLowerCase() === trimmed.toLowerCase()) + 1;

      // Соперник, которого обогнали: был выше личного рекорда, теперь ниже нового.
      const beaten = entries
        .filter((e) => e.name.toLowerCase() !== trimmed.toLowerCase())
        .filter((e) => e.score < score && e.score > previousBest)
        .sort((a, b) => b.score - a.score)[0];

      write();
      return {
        entries: sorted,
        rank,
        isPersonalBest: score > previousBest,
        previousBest,
        beaten,
      };
    },

    clear(): void {
      cache = null;
      try {
        store.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
  };
}
