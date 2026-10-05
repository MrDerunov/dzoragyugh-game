import { describe, expect, it } from 'vitest';
import { COMBO_LINES, EVENTS, OBJECTS, WEIRD_OUTCOMES, comboLine } from './content';

describe('контент: объекты', () => {
  it('уникальные id', () => {
    const ids = OBJECTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('валидные kind', () => {
    for (const o of OBJECTS) expect(['good', 'bad', 'weird']).toContain(o.kind);
  });

  it('label, emoji и reactions непустые', () => {
    for (const o of OBJECTS) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.emoji.length).toBeGreaterThan(0);
      expect(o.reactions.length).toBeGreaterThan(0);
      for (const r of o.reactions) expect(r.length).toBeGreaterThan(0);
    }
  });

  it('eventWeights положительные и ссылаются на известные события', () => {
    const eventIds = new Set(EVENTS.map((e) => e.id));
    for (const o of OBJECTS) {
      for (const [key, w] of Object.entries(o.eventWeights ?? {})) {
        expect(w).toBeGreaterThan(0);
        expect(eventIds.has(key)).toBe(true);
      }
    }
  });
});

describe('контент: комбо и события', () => {
  it('COMBO_LINES отсортированы по уровню', () => {
    const levels = COMBO_LINES.map((c) => c.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('comboLine', () => {
    expect(comboLine(2)).toBeNull();
    expect(comboLine(3)).toBe('ԼԱՎ Է');
    expect(comboLine(7)).toBe('ՇԱՏ ԼԱՎ');
  });

  it('WEIRD_OUTCOMES имеют положительные веса', () => {
    for (const o of WEIRD_OUTCOMES) expect(o.weight).toBeGreaterThan(0);
  });

  it('события валидны', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
    for (const e of EVENTS) {
      expect(e.weight).toBeGreaterThan(0);
      expect(e.durationMs).toBeGreaterThan(0);
      expect(e.startWindowMs[0]).toBeLessThan(e.startWindowMs[1]);
    }
  });

  it('специальные объекты существуют', () => {
    const late = OBJECTS.find((o) => o.id === 'lateStudent');
    expect(late?.moving).toBe(true);
    const boss = OBJECTS.find((o) => o.id === 'bossWord');
    expect(boss?.hp).toBeGreaterThan(1);
  });
});
