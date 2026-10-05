/**
 * Публичный контракт игрового ядра.
 *
 * Ядро (src/core) — чистая логика без DOM и без внешних таймеров:
 * UI продвигает игровое время вызовами tick(dtMs) и рендерит возвращаемые
 * снимки. Благодаря этому партию можно «проиграть» в юнит-тесте
 * с фиксированным seed и без браузера.
 */

/** Категория объекта на игровом поле. */
export type ObjectKind = 'good' | 'bad' | 'weird';

/** Тон реакции — цвет и анимация всплывающего текста в UI. */
export type ReactionTone = 'positive' | 'negative' | 'weird';

/** Исход тапа по странному объекту (овца и компания). */
export interface WeirdOutcome {
  /** Текст реакции, например «ОВЦА УКРАЛА ԲԱՌԱՊԱՇԱՐԸ». */
  text: string;
  score: number;
  /** Изменение состояния деревни, % (положительное — восстановление). */
  village: number;
  /** Изменение терпения преподавательницы, %. */
  patience: number;
  tone: ReactionTone;
  /** Вероятность исхода (относительный вес). */
  weight: number;
  /** true — исход считается ошибкой: сбивает комбо и учитывается в mistakes. */
  comboBreak?: boolean;
  /** Дополнительные уровни комбо (редко). */
  comboBonus?: number;
  /** true — засчитать овцу спасённой (для статистики). */
  countsAsSheepSaved?: boolean;
}

/** Описание типа объекта (контент, а не экземпляр на поле). */
export interface ObjectSpec {
  /** Стабильный id, используется в контенте, событиях и тестах. */
  id: string;
  kind: ObjectKind;
  /** Короткий текст на объекте: «ну типа», «գաթա», «Ա». */
  label: string;
  /** Эмодзи-иконка объекта. */
  emoji: string;
  /** Базовые очки за правильное действие. */
  score: number;
  /** Обычное время жизни на поле, мс. */
  lifespanMs: number;
  /** Вес при случайном выборе в обычном спавне (по умолчанию 1). */
  weight?: number;
  /** Веса внутри конкретных событий: { mamaMode: 5, russianInvasion: 8 }. */
  eventWeights?: Record<string, number>;
  /** Объект движется по полю (например, опоздавший ученик). */
  moving?: boolean;
  /** HP босса: чтобы обработать объект, нужно тапнуть его hp раз. */
  hp?: number;
  /** Реакции на правильное действие (выбирается случайно). */
  reactions: string[];
}

/** Описание специального события (контент, геймдизайн §10). */
export interface EventDef {
  id: string;
  title: string;
  /** Окно старта на игровых часах, мс [from, to). */
  startWindowMs: [number, number];
  /** Длительность события, мс. */
  durationMs: number;
  /** Вес выбора события. */
  weight: number;
}

/** Экземпляр объекта на поле. */
export interface SpawnedObject {
  /** Уникальный id экземпляра — передаётся в tap(). */
  uid: string;
  spec: ObjectSpec;
  /** Момент появления на игровых часах, мс. */
  spawnedAt: number;
  /** Момент исчезновения, мс. */
  expiresAt: number;
  /** Нормализованная позиция 0..1 (UI сам позиционирует). */
  x: number;
  y: number;
  /** Текущее HP (для боссов). */
  hp: number;
  /** Объект уже обработан (тапнут или истёк). */
  dead: boolean;
}

/** Текущая игровая статистика. */
export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  /** Состояние деревни, 0..100. */
  villageHealth: number;
  /** Терпение преподавательницы, 0..100. */
  teacherPatience: number;
  russianismsDestroyed: number;
  sheepSaved: number;
  sheepTapped: number;
  gataCollected: number;
  mistakes: number;
  taps: number;
}

export type Phase = 'calm' | 'students' | 'chaos';

/** Активное специальное событие. */
export interface GameEvent {
  id: string;
  /** Заголовок-объявление: «⚠️ УЧЕНИКИ ВОШЛИ В ДЕРЕВНЮ». */
  title: string;
  startedAt: number;
  endsAt: number;
}

/** Объявление, порождённое с прошлого tick. */
export interface Announcement {
  text: string;
  tone: 'info' | 'warning' | 'success' | 'joke';
}

/** Снимок состояния игры после start/tick/finish. */
export interface EngineSnapshot {
  /** Текущее игровое время, мс. */
  now: number;
  durationMs: number;
  phase: Phase;
  objects: SpawnedObject[];
  stats: GameStats;
  activeEvent: GameEvent | null;
  /** Объявления, появившиеся с прошлого tick (баннеры/тосты). */
  announcements: Announcement[];
  /** > now — игра заморожена до этого момента (вопрос по грамматике). */
  pausedUntil: number;
  finished: boolean;
}

/** Результат тапа по объекту. */
export interface TapResult {
  /** false — объект уже мёртв или не существует. */
  handled: boolean;
  /** Объект, по которому тапнули (отсутствует, если объект не найден). */
  object?: SpawnedObject;
  /** Текст реакции: «РУСИЗМ УНИЧТОЖЕН +10». */
  reaction: string;
  reactionTone: ReactionTone;
  scoreDelta: number;
  villageDelta: number;
  patienceDelta: number;
  /** Оставшееся HP босса (если объект — босс). */
  bossHpLeft?: number;
  /** true — объект полностью обработан этим тапом (у босса — только последний). */
  resolved: boolean;
  /** Объявления, порождённые тапом (например, «СЛОВО ПРОИЗНЕСЕНО»). */
  announcements: Announcement[];
}

export interface GameConfig {
  /** Общая длительность партии, мс. По умолчанию 75_000. */
  durationMs: number;
  /** Конец первой фазы («пока всё нормально»). */
  calmUntilMs: number;
  /** Начало третьей фазы («педагогическая катастрофа»). */
  chaosFromMs: number;
  /** Начальный интервал между спавнами, мс. */
  baseSpawnIntervalMs: number;
  /** Минимальный интервал между спавнами в хаосе, мс. */
  minSpawnIntervalMs: number;
  /** На сколько мс в секунду ускоряется спавн. */
  spawnAccelerationMsPerSec: number;
  /** Максимум одновременно живых объектов. */
  maxConcurrentObjects: number;
  /** Урон деревне за пропущенный плохой объект, %. */
  badMissVillagePenalty: number;
  /** Урон терпению за пропущенный плохой объект, %. */
  badMissPatiencePenalty: number;
  /** Минимальная пауза между специальными событиями, мс. */
  eventCooldownMs: number;
  /** Тестовый режим: запустить только эти события (все, по очереди). */
  forceEventIds?: string[];
}

export interface GameEngine {
  readonly config: Required<GameConfig>;
  /** Начать партию. seed — зерно ГПСЧ (воспроизводимость, тесты). */
  start(seed?: number): EngineSnapshot;
  /** Продвинуть игровое время на dtMs и вернуть снимок. */
  tick(dtMs: number): EngineSnapshot;
  /** Тап по живому объекту по uid. */
  tap(uid: string): TapResult;
  /** Снимок без продвижения времени. */
  snapshot(): EngineSnapshot;
  /** Принудительно завершить партию. */
  finish(): EngineSnapshot;
  /** Случайное число из ГПСЧ ядра [0, 1). */
  random(): number;
}

/** Уровни вердикта по состоянию деревни (см. геймдизайн, §26). */
export type VerdictTier = 'saved' | 'survived' | 'repair' | 'gata' | 'dead';

export interface Verdict {
  /** Например: «ДЕРЕВНЯ ВЫЖИЛА». */
  title: string;
  /** Смешной диагноз: «Дом стоит. Армянский — частично.» */
  diagnosis: string;
  tier: VerdictTier;
}

/**
 * Фабрика движка — реализована в src/core/engine.ts:
 *   export function createEngine(config?: Partial<GameConfig>): GameEngine
 * Вердикт — в src/core/verdicts.ts:
 *   export function getVerdict(stats: GameStats, random?: () => number): Verdict
 * Контент — в src/core/content.ts (OBJECTS, EVENTS, WEIRD_OUTCOMES,
 *   COMBO_LINES, comboLine(), SYSTEM_LINES, PHASE_ANNOUNCEMENTS и др.).
 */
