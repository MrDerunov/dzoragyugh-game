import { mulberry32 } from './rng';
import {
  BOSS_WIN_LINES,
  COMBO_LINES,
  EVENTS,
  MISS_REACTIONS,
  OBJECTS,
  PHASE_CHAOS_LINES,
  SYSTEM_LINES,
  WEIRD_OUTCOMES,
} from './content';
import type {
  Announcement,
  EngineSnapshot,
  EventDef,
  GameConfig,
  GameEngine,
  GameEvent,
  GameStats,
  ObjectKind,
  ObjectSpec,
  Phase,
  SpawnedObject,
  TapResult,
} from './types';

/** Конфиг движка: все поля обязательны, кроме тестового forceEventIds. */
type EngineConfig = Omit<Required<GameConfig>, 'forceEventIds'> & Pick<GameConfig, 'forceEventIds'>;

const DEFAULT_CONFIG: EngineConfig = {
  durationMs: 75000,
  calmUntilMs: 15000,
  chaosFromMs: 50000,
  baseSpawnIntervalMs: 1700,
  minSpawnIntervalMs: 550,
  spawnAccelerationMsPerSec: 16,
  maxConcurrentObjects: 12,
  badMissVillagePenalty: 6,
  badMissPatiencePenalty: 6,
  eventCooldownMs: 6000,
};

/** Уровни комбо, отсортированные по возрастанию (для проверки вех). */
const COMBO_LEVELS_SORTED = [...COMBO_LINES].sort((a, b) => a.level - b.level);

interface ScheduledEvent {
  def: EventDef;
  startAt: number;
}

interface ActiveEventData {
  destroyed?: number;
  found?: boolean;
  lateTapped?: boolean;
  bossDone?: boolean;
  pauseSteps?: { at: number; text: string; tone: Announcement['tone'] }[];
  pauseStepIdx?: number;
}

type ActiveEvent = GameEvent & { data: ActiveEventData };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const pick = <T,>(rng: () => number, items: T[], weightOf: (item: T) => number): T => {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
};

/**
 * Чистое игровое ядро без DOM и таймеров: UI продвигает время через tick(dtMs).
 * Детерминированность (seed) позволяет «проигрывать» партию в тестах.
 */
export function createEngine(config: Partial<GameConfig> = {}): GameEngine {
  const cfg: EngineConfig = { ...DEFAULT_CONFIG, ...config };

  let rng: () => number = Math.random;
  let now = 0;
  let phase: Phase = 'calm';
  let objects: SpawnedObject[] = [];
  let stats: GameStats = freshStats();
  let activeEvent: ActiveEvent | null = null;
  let pausedUntil = 0;
  let finished = false;
  let lastSpawnAt = -Infinity;
  let nextJokeAt = 6000;
  let uidCounter = 0;
  let announcements: Announcement[] = [];
  let scheduled: ScheduledEvent[] = [];
  let eventCursor = 0;
  let calmAnnounced = false;
  let chaosAnnounced = false;

  function freshStats(): GameStats {
    return {
      score: 0, combo: 0, maxCombo: 0,
      villageHealth: 100, teacherPatience: 100,
      russianismsDestroyed: 0, sheepSaved: 0, sheepTapped: 0,
      gataCollected: 0, mistakes: 0, taps: 0,
    };
  }

  const randomOf = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

  function scheduleEvents(): void {
    scheduled = [];
    const forced = cfg.forceEventIds && cfg.forceEventIds.length > 0;
    if (forced) {
      const ids = cfg.forceEventIds!;
      const first = cfg.calmUntilMs + 1500;
      const last = cfg.durationMs - 9000;
      ids.forEach((id, i) => {
        const def = EVENTS.find((e) => e.id === id);
        if (!def) return;
        const startAt = ids.length === 1 ? first : first + Math.round((i * (last - first)) / (ids.length - 1));
        scheduled.push({ def, startAt });
      });
    } else {
      const pool = [...EVENTS];
      const chosen: EventDef[] = [];
      while (chosen.length < 4 && pool.length > 0) {
        const def = pick(rng, pool, (d) => d.weight);
        chosen.push(def);
        pool.splice(pool.indexOf(def), 1);
      }
      let prevEnd = cfg.calmUntilMs + 1000;
      for (const def of chosen) {
        const [from, to] = def.startWindowMs;
        const lo = Math.max(from, prevEnd + cfg.eventCooldownMs);
        const hi = Math.min(to, cfg.durationMs - 9000);
        if (hi < lo) continue;
        const startAt = lo + Math.floor(rng() * (hi - lo + 1));
        scheduled.push({ def, startAt });
        prevEnd = startAt + def.durationMs;
      }
    }
    scheduled.sort((a, b) => a.startAt - b.startAt);
    eventCursor = 0;
  }

  function spawnOne(spec: ObjectSpec, opts?: { lifespanOverride?: number; x?: number; y?: number }): SpawnedObject {
    let x = opts?.x;
    let y = opts?.y;
    if (x === undefined || y === undefined) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const cx = 0.06 + rng() * 0.88;
        const cy = 0.16 + rng() * 0.7;
        const overlap = objects.some((o) => !o.dead && Math.abs(o.x - cx) < 0.11 && Math.abs(o.y - cy) < 0.11);
        if (!overlap) { x = cx; y = cy; break; }
      }
      if (x === undefined || y === undefined) { x = 0.06 + rng() * 0.88; y = 0.16 + rng() * 0.7; }
    }
    const lifespan = opts?.lifespanOverride ?? spec.lifespanMs;
    const obj: SpawnedObject = {
      uid: 'o' + uidCounter++,
      spec,
      spawnedAt: now,
      expiresAt: now + lifespan,
      x, y,
      hp: spec.hp ?? 0,
      dead: false,
    };
    objects.push(obj);
    return obj;
  }

  function poolForEvent(id: string): ObjectSpec[] {
    return OBJECTS.filter((o) => (o.eventWeights?.[id] ?? 0) > 0);
  }

  const weightFor = (id: string) => (o: ObjectSpec): number => o.eventWeights?.[id] ?? 1;

  function pickKind(): ObjectKind {
    const table: Record<Phase, [ObjectKind, number][]> = {
      calm: [['good', 0.55], ['bad', 0.35], ['weird', 0.10]],
      students: [['good', 0.40], ['bad', 0.45], ['weird', 0.15]],
      chaos: [['good', 0.30], ['bad', 0.50], ['weird', 0.20]],
    };
    const entries = table[phase];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = rng() * total;
    for (const [kind, w] of entries) {
      roll -= w;
      if (roll <= 0) return kind;
    }
    return entries[entries.length - 1]![0];
  }

  function regularPool(): ObjectSpec[] {
    return OBJECTS.filter((o) => o.id !== 'lateStudent' && o.id !== 'bossWord');
  }

  function spawnBatch(): void {
    const alive = objects.filter((o) => !o.dead).length;
    if (alive >= cfg.maxConcurrentObjects) return;
    const overrideId = activeEvent && ['mamaMode', 'russianInvasion', 'sheepChaos'].includes(activeEvent.id)
      ? activeEvent.id
      : null;
    const doSpawn = (): void => {
      if (overrideId) {
        const pool = poolForEvent(overrideId);
        if (pool.length > 0) spawnOne(pick(rng, pool, weightFor(overrideId)));
        return;
      }
      const kind = pickKind();
      const pool = regularPool().filter((o) => o.kind === kind);
      spawnOne(pick(rng, pool, (o) => o.weight ?? 1));
    };
    doSpawn();
    if (phase === 'chaos' && rng() < 0.35) {
      const alive2 = objects.filter((o) => !o.dead).length;
      if (alive2 < cfg.maxConcurrentObjects) doSpawn();
    }
  }

  function activateEvent(se: ScheduledEvent): void {
    const def = se.def;
    activeEvent = { id: def.id, title: def.title, startedAt: now, endsAt: now + def.durationMs, data: {} };
    if (def.id !== 'grammarQuestion') {
      announcements.push({ text: def.title, tone: 'warning' });
    }
    switch (def.id) {
      case 'russianInvasion': {
        activeEvent.data.destroyed = 0;
        const pool = poolForEvent('russianInvasion');
        for (let i = 0; i < 3; i++) spawnOne(pick(rng, pool, weightFor('russianInvasion')));
        break;
      }
      case 'sheepChaos': {
        const pool = poolForEvent('sheepChaos');
        for (let i = 0; i < 3; i++) spawnOne(pick(rng, pool, weightFor('sheepChaos')));
        break;
      }
      case 'lateStudent': {
        activeEvent.data.lateTapped = false;
        const spec = OBJECTS.find((o) => o.id === 'lateStudent');
        if (spec) spawnOne(spec, { lifespanOverride: 2600 });
        break;
      }
      case 'homeworkCheck': {
        activeEvent.data.found = false;
        const ids = ['phone', 'coffee', 'sheep', 'notebook', 'gata'];
        ids.forEach((id, i) => {
          const spec = OBJECTS.find((o) => o.id === id);
          if (spec) spawnOne(spec, { lifespanOverride: def.durationMs, x: 0.12 + i * 0.19, y: 0.5 });
        });
        break;
      }
      case 'armenianBoss': {
        activeEvent.data.bossDone = false;
        const spec = OBJECTS.find((o) => o.id === 'bossWord');
        if (spec) spawnOne(spec, { lifespanOverride: def.durationMs });
        break;
      }
      case 'grammarQuestion': {
        activeEvent.data.pauseSteps = [
          { at: 0, text: 'УЧЕНИК ЗАДАЛ ВОПРОС ПО ГРАММАТИКЕ', tone: 'info' },
          { at: 1200, text: 'Преподавательница думает.', tone: 'joke' },
          { at: 2400, text: 'Ученик уже забыл, что спрашивал.', tone: 'joke' },
        ];
        activeEvent.data.pauseStepIdx = 0;
        pausedUntil = now + 3500;
        break;
      }
      default:
        break;
    }
  }

  function emitPauseSteps(): void {
    const ev = activeEvent;
    if (!ev) return;
    const steps = ev.data.pauseSteps ?? [];
    while ((ev.data.pauseStepIdx ?? 0) < steps.length && now - ev.startedAt >= steps[ev.data.pauseStepIdx ?? 0]!.at) {
      const step = steps[ev.data.pauseStepIdx ?? 0]!;
      announcements.push({ text: step.text, tone: step.tone });
      ev.data.pauseStepIdx = (ev.data.pauseStepIdx ?? 0) + 1;
    }
  }

  function finalizeEvent(): void {
    const ev = activeEvent;
    if (!ev) return;
    switch (ev.id) {
      case 'russianInvasion': {
        if ((ev.data.destroyed ?? 0) >= 4) {
          stats.score += 150;
          announcements.push({ text: 'Русский отброшен за пределы деревни. +150', tone: 'success' });
        } else {
          stats.villageHealth = clamp(stats.villageHealth - 12, 0, 100);
          announcements.push({ text: 'Русский закрепился в центре.', tone: 'warning' });
        }
        break;
      }
      case 'homeworkCheck': {
        if (ev.data.found) {
          announcements.push({ text: 'Домашка существует. Ситуация под контролем.', tone: 'success' });
        } else {
          stats.villageHealth = clamp(stats.villageHealth - 10, 0, 100);
          announcements.push({ text: 'ДОМАШНЕЕ ЗАДАНИЕ НЕ ОБНАРУЖЕНО', tone: 'warning' });
        }
        break;
      }
      case 'lateStudent': {
        if (!ev.data.lateTapped) announcements.push({ text: 'Он написал: «Я уже почти».', tone: 'joke' });
        break;
      }
      case 'mamaMode': {
        announcements.push({ text: 'Ты сказал, что больше не можешь есть. Тебе положили ещё.', tone: 'joke' });
        break;
      }
      case 'sheepChaos': {
        announcements.push({ text: 'Овцы разбрелись. Часть всё ещё в деревне.', tone: 'joke' });
        break;
      }
      case 'armenianBoss': {
        if (!ev.data.bossDone) {
          stats.villageHealth = clamp(stats.villageHealth - 8, 0, 100);
          announcements.push({ text: 'Слово победило. Его больше не будут спрашивать.', tone: 'joke' });
        }
        break;
      }
      default:
        break;
    }
    activeEvent = null;
  }

  function expireObjects(): void {
    for (const obj of objects) {
      if (obj.dead || obj.expiresAt > now) continue;
      obj.dead = true;
      if (obj.spec.kind === 'bad' && activeEvent?.id !== 'homeworkCheck') {
        stats.villageHealth = clamp(stats.villageHealth - cfg.badMissVillagePenalty, 0, 100);
        stats.teacherPatience = clamp(stats.teacherPatience - cfg.badMissPatiencePenalty, 0, 100);
        stats.combo = 0;
        stats.mistakes += 1;
        const line = randomOf(MISS_REACTIONS);
        announcements.push({ text: line + ' −' + cfg.badMissVillagePenalty, tone: 'warning' });
      }
    }
    objects = objects.filter((o) => !o.dead);
  }

  function bumpCombo(delta: number): void {
    stats.combo += delta;
    if (stats.combo > stats.maxCombo) stats.maxCombo = stats.combo;
  }

  function announceComboMilestones(before: number): void {
    let bestLevel = -1;
    let bestText = '';
    for (const line of COMBO_LEVELS_SORTED) {
      if (before < line.level && stats.combo >= line.level && line.level > bestLevel) {
        bestLevel = line.level;
        bestText = line.text;
      }
    }
    if (bestLevel >= 0) announcements.push({ text: bestText, tone: 'joke' });
  }

  function snapshot(): EngineSnapshot {
    const snap: EngineSnapshot = {
      now,
      durationMs: cfg.durationMs,
      phase,
      objects: objects.filter((o) => !o.dead).map((o) => ({ ...o })),
      stats: { ...stats },
      activeEvent: activeEvent
        ? { id: activeEvent.id, title: activeEvent.title, startedAt: activeEvent.startedAt, endsAt: activeEvent.endsAt }
        : null,
      announcements: announcements.splice(0),
      pausedUntil,
      finished,
    };
    return snap;
  }

  function tap(uid: string): TapResult {
    const acc: Announcement[] = [];
    const base: TapResult = {
      handled: false, reaction: '', reactionTone: 'weird',
      scoreDelta: 0, villageDelta: 0, patienceDelta: 0, resolved: false, announcements: acc,
    };
    if (finished) return base;
    const obj = objects.find((o) => o.uid === uid && !o.dead);
    if (!obj) return base;
    base.handled = true;
    base.object = obj;
    const spec = obj.spec;

    // Армянский босс: несколько тапов до победы
    if (spec.hp && spec.hp > 0) {
      obj.hp -= 1;
      stats.taps += 1;
      bumpCombo(1);
      stats.score += 5;
      base.scoreDelta = 5;
      if (obj.hp === 0) {
        obj.dead = true;
        base.resolved = true;
        stats.score += 150;
        base.scoreDelta += 150;
        base.reaction = 'СЛОВО ПРОИЗНЕСЕНО';
        base.reactionTone = 'positive';
        acc.push({ text: 'СЛОВО ПРОИЗНЕСЕНО', tone: 'success' });
        acc.push({ text: randomOf(BOSS_WIN_LINES), tone: 'joke' });
        if (activeEvent?.id === 'armenianBoss') activeEvent.data.bossDone = true;
      } else {
        base.bossHpLeft = obj.hp;
        base.reaction = 'СЛОВО СОПРОТИВЛЯЕТСЯ. ЕЩЁ ' + obj.hp;
        base.reactionTone = 'weird';
      }
      announceComboMilestones(stats.combo - 1);
      return base;
    }

    // Проверка домашнего задания перекрывает обычную логику
    if (activeEvent?.id === 'homeworkCheck') {
      stats.taps += 1;
      obj.dead = true;
      base.resolved = true;
      if (spec.id === 'notebook') {
        activeEvent.data.found = true;
        bumpCombo(1);
        stats.score += 100;
        base.scoreDelta = 100;
        base.reaction = 'Домашка существует. +100';
        base.reactionTone = 'positive';
        acc.push({ text: 'ЭВАКУАЦИЯ ОТМЕНЕНА: домашнее задание обнаружено.', tone: 'success' });
      } else if (spec.id === 'sheep') {
        stats.sheepTapped += 1;
        base.reaction = 'Это не домашнее задание. Пока.';
        base.reactionTone = 'weird';
      } else {
        stats.mistakes += 1;
        stats.teacherPatience = clamp(stats.teacherPatience - 5, 0, 100);
        base.patienceDelta = -5;
        base.reaction = 'Это не тетрадь. Учительница ищет дальше.';
        base.reactionTone = 'negative';
      }
      return base;
    }

    if (spec.kind === 'good') {
      stats.taps += 1;
      const before = stats.combo;
      bumpCombo(1);
      const comboBonus = stats.combo >= 2 ? Math.min((stats.combo - 1) * 2, 40) : 0;
      const total = spec.score + comboBonus;
      stats.score += total;
      stats.villageHealth = clamp(stats.villageHealth + 3, 0, 100);
      stats.teacherPatience = clamp(stats.teacherPatience + 2, 0, 100);
      if (spec.id === 'gata') stats.gataCollected += 1;
      if (spec.id === 'lateStudent' && activeEvent?.id === 'lateStudent') activeEvent.data.lateTapped = true;
      obj.dead = true;
      base.resolved = true;
      base.scoreDelta = total;
      base.villageDelta = 3;
      base.patienceDelta = 2;
      base.reaction = randomOf(spec.reactions) + ' +' + total;
      base.reactionTone = 'positive';
      announceComboMilestones(before);
      return base;
    }

    if (spec.kind === 'bad') {
      stats.taps += 1;
      const before = stats.combo;
      bumpCombo(1);
      const comboBonus = stats.combo >= 2 ? Math.min((stats.combo - 1) * 2, 40) : 0;
      const total = spec.score + comboBonus;
      stats.score += total;
      stats.villageHealth = clamp(stats.villageHealth + 2, 0, 100);
      stats.teacherPatience = clamp(stats.teacherPatience + 1, 0, 100);
      stats.russianismsDestroyed += 1;
      if (activeEvent?.id === 'russianInvasion') activeEvent.data.destroyed = (activeEvent.data.destroyed ?? 0) + 1;
      obj.dead = true;
      base.resolved = true;
      base.scoreDelta = total;
      base.villageDelta = 2;
      base.patienceDelta = 1;
      base.reaction = randomOf(spec.reactions) + ' +' + total;
      base.reactionTone = 'positive';
      announceComboMilestones(before);
      return base;
    }

    // weird: случайный исход из взвешенного пула
    stats.taps += 1;
    if (spec.id === 'sheep') stats.sheepTapped += 1;
    const outcome = pick(rng, WEIRD_OUTCOMES, (o) => o.weight);
    base.scoreDelta = outcome.score;
    stats.score = Math.max(0, stats.score + outcome.score);
    stats.villageHealth = clamp(stats.villageHealth + outcome.village, 0, 100);
    stats.teacherPatience = clamp(stats.teacherPatience + outcome.patience, 0, 100);
    base.villageDelta = outcome.village;
    base.patienceDelta = outcome.patience;
    const before = stats.combo;
    if (outcome.comboBreak) {
      stats.combo = 0;
      stats.mistakes += 1;
    } else {
      bumpCombo(1 + (outcome.comboBonus ?? 0));
    }
    if (outcome.countsAsSheepSaved) stats.sheepSaved += 1;
    obj.dead = true;
    base.resolved = true;
    base.reaction = outcome.text;
    base.reactionTone = outcome.tone;
    announceComboMilestones(before);
    return base;
  }

  return {
    config: cfg as Required<GameConfig>,
    start(seed?: number): EngineSnapshot {
      const seedValue = seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
      rng = mulberry32(seedValue);
      now = 0;
      phase = 'calm';
      pausedUntil = 0;
      finished = false;
      stats = freshStats();
      objects = [];
      announcements = [];
      activeEvent = null;
      lastSpawnAt = -Infinity;
      nextJokeAt = 6000;
      uidCounter = 0;
      calmAnnounced = false;
      chaosAnnounced = false;
      scheduleEvents();
      const coffee = OBJECTS.find((o) => o.id === 'coffee');
      const nuTipa = OBJECTS.find((o) => o.id === 'nu-tipa');
      if (coffee) spawnOne(coffee, { x: 0.3, y: 0.55 });
      if (nuTipa) spawnOne(nuTipa, { x: 0.7, y: 0.55 });
      return snapshot();
    },
    tick(dtMs: number): EngineSnapshot {
      if (finished) return snapshot();
      now += dtMs;
      if (now >= cfg.durationMs) {
        finished = true;
        for (const o of objects) o.dead = true;
        objects = [];
        announcements.push({ text: 'СТОП', tone: 'info' });
        return snapshot();
      }
      if (!calmAnnounced && now >= cfg.calmUntilMs) {
        calmAnnounced = true;
        phase = 'students';
        announcements.push({ text: '⚠️ УЧЕНИКИ ВОШЛИ В ДЕРЕВНЮ', tone: 'warning' });
      }
      if (!chaosAnnounced && now >= cfg.chaosFromMs) {
        chaosAnnounced = true;
        phase = 'chaos';
        announcements.push({ text: randomOf(PHASE_CHAOS_LINES), tone: 'warning' });
      }
      if (pausedUntil > now) {
        emitPauseSteps();
        return snapshot();
      }
      if (pausedUntil > 0 && now >= pausedUntil) pausedUntil = 0;

      expireObjects();

      if (!activeEvent && eventCursor < scheduled.length && now >= scheduled[eventCursor]!.startAt) {
        activateEvent(scheduled[eventCursor]!);
        eventCursor += 1;
      }
      if (activeEvent && now >= activeEvent.endsAt) finalizeEvent();

      const elapsedSec = Math.floor(now / 1000);
      const interval = Math.max(cfg.minSpawnIntervalMs, cfg.baseSpawnIntervalMs - elapsedSec * cfg.spawnAccelerationMsPerSec);
      if (now - lastSpawnAt >= interval) {
        spawnBatch();
        lastSpawnAt = now;
      }

      if (now >= nextJokeAt) {
        announcements.push({ text: randomOf(SYSTEM_LINES), tone: 'joke' });
        nextJokeAt = now + 7000 + rng() * 4000;
      }

      return snapshot();
    },
    tap,
    snapshot,
    finish(): EngineSnapshot {
      finished = true;
      for (const o of objects) o.dead = true;
      objects = [];
      announcements.push({ text: 'СТОП', tone: 'info' });
      return snapshot();
    },
    random: () => rng(),
  };
}

