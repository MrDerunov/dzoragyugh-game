/**
 * Контракты сервисов приложения.
 *
 * Leaderboard: сейчас реализован поверх localStorage (MVP без backend),
 * но интерфейс допускает замену на API-реализацию (Vercel + Neon + Telegram,
 * см. геймдизайн, §40–61) без изменения игрового кода.
 */

export interface LeaderboardEntry {
  name: string;
  score: number;
  /** Сохранность деревни в лучшей партии, 0..100. */
  villageHealth: number;
  /** Timestamp лучшей партии, Date.now(). */
  date: number;
}

export interface SubmitOutcome {
  /** Полная таблица, отсортированная по убыванию score. */
  entries: LeaderboardEntry[];
  /** Место игрока в обновлённой таблице, 1-based. */
  rank: number;
  isPersonalBest: boolean;
  /** Личный рекорд до этой партии (0 — не было). */
  previousBest: number;
  /** Соперник, которого обогнали этой партией (если есть). */
  beaten?: LeaderboardEntry;
}

export interface LeaderboardService {
  get(): LeaderboardEntry[];
  submit(name: string, score: number, villageHealth: number): SubmitOutcome;
  clear(): void;
}

/** Похожее на localStorage хранилище (для тестов и нестандартных webview). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Локальный лидерборд: сохраняет лучший результат каждого имени.
 * seedEntries — стартовые «соседи», чтобы рейтинг был живым с первой партии.
 * Реализация — src/services/leaderboard.ts (createLocalLeaderboard).
 */
export type HapticKind = 'light' | 'medium' | 'success' | 'error' | 'warning';

export interface TelegramContext {
  /** true — приложение открыто внутри Telegram Mini App. */
  available: boolean;
  /** Имя пользователя Telegram (first + last). */
  userName?: string;
  /** Подписанные initData — пригодятся для будущего backend. */
  initData?: string;
}
