import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import type { EngineSnapshot, GameEngine } from './types';

const tickUntil = (engine: GameEngine, pred: (s: EngineSnapshot) => boolean, maxMs = 80000): EngineSnapshot => {
  let snap = engine.snapshot();
  while (!pred(snap) && !snap.finished && snap.now < maxMs) snap = engine.tick(50);
  return snap;
};

/** «Бот»: тапает все полезные и вредные объекты на поле. */
const botTick = (engine: GameEngine, snap: EngineSnapshot): void => {
  for (const o of snap.objects) {
    if ((o.spec.kind === 'good' || o.spec.kind === 'bad') && !o.dead) {
      engine.tap(o.uid);
    }
  }
};

describe('движок: базовые действия', () => {
  it('тап по good: очки и комбо растут', () => {
    const engine = createEngine();
    const s = engine.start(1);
    const coffee = s.objects.find((o) => o.spec.id === 'coffee');
    expect(coffee).toBeDefined();
    const res = engine.tap(coffee!.uid);
    expect(res.handled).toBe(true);
    expect(res.scoreDelta).toBe(10);
    expect(res.reaction).toContain('+10');
    const snap = engine.snapshot();
    expect(snap.stats.score).toBe(10);
    expect(snap.stats.combo).toBe(1);
  });

  it('комбо-бонус: второй тап приносит больше очков', () => {
    const engine = createEngine();
    const s = engine.start(1);
    const coffee = s.objects.find((o) => o.spec.id === 'coffee')!;
    const nuTipa = s.objects.find((o) => o.spec.id === 'nu-tipa')!;
    engine.tap(coffee.uid);
    const res2 = engine.tap(nuTipa.uid);
    expect(res2.scoreDelta).toBe(12); // 10 + (2-1)*2
    expect(engine.snapshot().stats.combo).toBe(2);
  });

  it('пропущенный bad: деревня и терпение падают, комбо сбрасывается', () => {
    const engine = createEngine();
    const s0 = engine.start(3);
    const coffee = s0.objects.find((o) => o.spec.id === 'coffee')!;
    engine.tap(coffee.uid);
    expect(engine.snapshot().stats.combo).toBe(1);
    const snap = engine.tick(4100); // nu-tipa истекает на 4000 мс
    expect(snap.stats.villageHealth).toBe(94);
    expect(snap.stats.teacherPatience).toBe(94);
    expect(snap.stats.combo).toBe(0);
    expect(snap.stats.mistakes).toBe(1);
    expect(snap.announcements.some((a) => a.tone === 'warning')).toBe(true);
  });

  it('тап по несуществующему uid: handled=false', () => {
    const engine = createEngine();
    engine.start(2);
    const res = engine.tap('o-никогда-не-существовал');
    expect(res.handled).toBe(false);
  });
});

describe('движок: полная партия', () => {
  it('партия доигрывается до конца с событиями и в рамках инвариантов', () => {
    const engine = createEngine();
    engine.start(42);
    const eventIds = new Set<string>();
    let prevId: string | null = null;
    let snap = engine.snapshot();
    let steps = 0;
    while (!snap.finished && steps < 2000) {
      botTick(engine, snap);
      if (snap.activeEvent && snap.activeEvent.id !== prevId) {
        eventIds.add(snap.activeEvent.id);
        prevId = snap.activeEvent.id;
      }
      if (!snap.activeEvent) prevId = null;
      // Обычный лимит — 12; события могут временно добавить ещё до 5 объектов.
      expect(snap.objects.length).toBeLessThanOrEqual(17);
      expect(snap.stats.villageHealth).toBeGreaterThanOrEqual(0);
      expect(snap.stats.villageHealth).toBeLessThanOrEqual(100);
      expect(snap.stats.teacherPatience).toBeGreaterThanOrEqual(0);
      snap = engine.tick(50);
      steps += 1;
    }
    expect(snap.finished).toBe(true);
    expect(snap.stats.score).toBeGreaterThan(0);
    expect(snap.stats.taps).toBeGreaterThan(0);
    expect(eventIds.size).toBeGreaterThanOrEqual(3);
  });

  it('детерминизм: одинаковый seed — одинаковый результат', () => {
    const a = createEngine();
    const b = createEngine();
    a.start(7);
    b.start(7);
    let sa = a.snapshot();
    let sb = b.snapshot();
    while (!sa.finished) { sa = a.tick(50); sb = b.tick(50); }
    expect(sb.finished).toBe(true);
    expect(sa.stats).toEqual(sb.stats);
  });

  it('фазы: объявление приезда учеников и переход в хаос', () => {
    const engine = createEngine();
    engine.start(5);
    const seen: string[] = [];
    let snap = engine.snapshot();
    while (snap.now < 50200 && !snap.finished) {
      snap = engine.tick(50);
      seen.push(...snap.announcements.map((a) => a.text));
    }
    expect(seen.some((t) => t.includes('УЧЕНИКИ ВОШЛИ'))).toBe(true);
    expect(snap.phase).toBe('chaos');
  });

  it('спавн в хаосе чаще, чем в начале партии', () => {
    const engine = createEngine();
    engine.start(9);
    const seenUids = new Set<string>();
    const calmSpawns = new Set<string>();
    const chaosSpawns = new Set<string>();
    let snap = engine.snapshot();
    while (snap.now < 70000 && !snap.finished) {
      snap = engine.tick(50);
      for (const o of snap.objects) {
        if (seenUids.has(o.uid)) continue;
        seenUids.add(o.uid);
        if (snap.now < 5000) calmSpawns.add(o.uid);
        else if (snap.now >= 55000 && snap.now < 60000) chaosSpawns.add(o.uid);
      }
    }
    expect(chaosSpawns.size).toBeGreaterThan(calmSpawns.size);
  });
});

describe('движок: специальные события (forced)', () => {
  it('russianInvasion: при уничтожении русизмов — бонус +150', () => {
    const engine = createEngine({ forceEventIds: ['russianInvasion'] });
    let snap = engine.start(11);
    const seen: string[] = [];
    while (!snap.finished && snap.now < 80000) {
      for (const o of snap.objects) {
        if (o.spec.kind === 'bad' && !o.dead) {
          const res = engine.tap(o.uid);
          if (res.handled) seen.push(res.reaction);
        }
      }
      snap = engine.tick(50);
      seen.push(...snap.announcements.map((a) => a.text));
    }
    expect(seen.some((t) => t.includes('Русский отброшен'))).toBe(true);
  });

  it('homeworkCheck: тетрадь даёт +100, овца — только шутку', () => {
    const engine = createEngine({ forceEventIds: ['homeworkCheck'] });
    engine.start(21);
    const snap = tickUntil(engine, (s) => s.activeEvent?.id === 'homeworkCheck');
    expect(snap.activeEvent?.id).toBe('homeworkCheck');
    const notebook = snap.objects.find((o) => o.spec.id === 'notebook');
    expect(notebook).toBeDefined();
    const scoreBefore = snap.stats.score;
    const resN = engine.tap(notebook!.uid);
    expect(resN.reaction).toContain('Домашка существует');
    expect(resN.scoreDelta).toBe(100);
    const sheep = snap.objects.find((o) => o.spec.id === 'sheep');
    expect(sheep).toBeDefined();
    const resS = engine.tap(sheep!.uid);
    expect(resS.reaction).toContain('Это не домашнее задание');
    const after = engine.snapshot();
    expect(after.stats.score).toBe(scoreBefore + 100);
  });

  it('armenianBoss: 8 тапов до победы, на последнем — +150', () => {
    const engine = createEngine({ forceEventIds: ['armenianBoss'] });
    engine.start(31);
    const snap = tickUntil(engine, (s) => s.activeEvent?.id === 'armenianBoss');
    const boss = snap.objects.find((o) => o.spec.hp && o.spec.hp > 1);
    expect(boss).toBeDefined();
    const res1 = engine.tap(boss!.uid);
    expect(res1.resolved).toBe(false);
    expect(res1.bossHpLeft).toBe(7);
    let last = res1;
    for (let i = 0; i < 6; i++) last = engine.tap(boss!.uid);
    expect(last.resolved).toBe(false);
    const res8 = engine.tap(boss!.uid);
    expect(res8.resolved).toBe(true);
    expect(res8.scoreDelta).toBeGreaterThanOrEqual(150);
    expect(res8.announcements.some((a) => a.text.includes('СЛОВО ПРОИЗНЕСЕНО'))).toBe(true);
  });

  it('grammarQuestion: пауза, шаги, объекты заморожены, потом продолжение', () => {
    const engine = createEngine({ forceEventIds: ['grammarQuestion'] });
    engine.start(41);
    let snap = tickUntil(engine, (s) => s.pausedUntil > s.now);
    expect(snap.pausedUntil).toBeGreaterThan(snap.now);
    const seen: string[] = [];
    const countAtPause = snap.objects.length;
    while (snap.pausedUntil > snap.now && !snap.finished) {
      snap = engine.tick(500);
      seen.push(...snap.announcements.map((a) => a.text));
      // Пока пауза активна — объекты заморожены (не исчезают и не появляются).
      if (snap.pausedUntil > snap.now) expect(snap.objects.length).toBe(countAtPause);
    }
    expect(seen.some((t) => t.includes('Преподавательница думает'))).toBe(true);
    expect(seen.some((t) => t.includes('забыл'))).toBe(true);
    expect(snap.pausedUntil).toBe(0);
    expect(snap.finished).toBe(false);
  });
});
