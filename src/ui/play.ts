import { createEngine, getVerdict } from '../core/index';
import type { EngineSnapshot, GameEngine, GameStats, SpawnedObject, TapResult, Verdict } from '../core/index';
import type { LeaderboardService, SubmitOutcome } from '../services/types';
import { tgHaptic } from '../services/telegram';
import { appRoot, clear, el } from './dom';

export interface GameRunResult {
  name: string;
  stats: GameStats;
  verdict: Verdict;
  submit: SubmitOutcome;
}

interface Bar {
  root: HTMLElement;
  set: (value: number) => void;
}

const makeBar = (label: string): Bar => {
  const fill = el('div', { class: 'bar-fill' });
  const root = el('div', { class: 'bar' }, [
    el('span', { class: 'bar-label' }, [label]),
    el('div', { class: 'bar-track' }, [fill]),
  ]);
  return {
    root,
    set(value: number): void {
      fill.style.width = value + '%';
      fill.classList.toggle('mid', value < 60);
      fill.classList.toggle('low', value < 25);
    },
  };
};

const healthTier = (health: number): string => {
  if (health >= 70) return 'ok';
  if (health >= 40) return 'warn';
  if (health >= 10) return 'danger';
  return 'dead';
};

/**
 * Игровой экран: HUD, поле, цикл на requestAnimationFrame.
 * Вся логика — в ядре; здесь только рендер снимков и передача тапов.
 */
export function startGame(opts: { name: string; lb: LeaderboardService; onFinished: (run: GameRunResult) => void }): void {
  const { name, lb, onFinished } = opts;
  const app = appRoot();
  clear(app);

  const screen = el('div', { class: 'screen screen-play' });

  const timerFill = el('div', { class: 'timer-fill' });
  const timer = el('div', { class: 'timer' }, [timerFill]);

  const scoreNum = el('b', {}, ['0']);
  const scoreBox = el('div', { class: 'hud-score' }, ['SCORE: ', scoreNum]);
  const comboBox = el('div', { class: 'hud-combo' }, ['COMBO x0']);
  const patienceBar = makeBar('Համբերություն');
  const villageBar = makeBar('Գյուղ');
  const hud = el('div', { class: 'hud' }, [
    scoreBox,
    comboBox,
    el('div', { class: 'hud-bars' }, [patienceBar.root, villageBar.root]),
  ]);

  const decor = el('div', { class: 'decor' });
  const banner = el('div', { class: 'banner', id: 'banner' });
  const field = el('div', { class: 'field', 'data-health': 'ok' });
  field.append(decor, banner);

  screen.append(timer, hud, field);
  app.append(screen);

  const engine: GameEngine = createEngine();
  const domById = new Map<string, HTMLElement>();
  let combo = -1;
  let raf = 0;
  let last = performance.now();
  let finished = false;
  let bannerTimer = 0;

  const showBanner = (text: string, tone: string): void => {
    banner.textContent = text;
    banner.dataset.tone = tone;
    banner.classList.add('visible');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => banner.classList.remove('visible'), 2200);
  };

  const showReaction = (res: TapResult, node: HTMLElement | undefined): void => {
    if (!res.reaction) return;
    const span = el('span', { class: 'reaction reaction-' + res.reactionTone }, [res.reaction]);
    if (node) {
      span.style.left = node.style.left;
      span.style.top = node.style.top;
    } else {
      span.style.left = '50%';
      span.style.top = '30%';
    }
    field.append(span);
    window.setTimeout(() => span.remove(), 950);
  };

  const hapticFor = (res: TapResult): void => {
    if (res.reactionTone === 'negative') tgHaptic('error');
    else if (res.reactionTone === 'weird') tgHaptic('warning');
    else tgHaptic('light');
    for (const a of res.announcements) {
      if (a.tone === 'success') tgHaptic('success');
    }
  };

  const updateBossHp = (uid: string, left: number, total: number): void => {
    const node = domById.get(uid);
    if (!node) return;
    const fill = node.querySelector('.obj-hp-fill') as HTMLElement | null;
    if (fill) fill.style.width = Math.max(0, (left / total) * 100) + '%';
  };

  const removeObjectDom = (uid: string): void => {
    const node = domById.get(uid);
    if (!node) return;
    node.classList.add('removing');
    window.setTimeout(() => node.remove(), 240);
    domById.delete(uid);
  };

  const createObjectDom = (o: SpawnedObject): void => {
    const btn = el('button', { class: 'obj obj-' + o.spec.kind, 'data-uid': o.uid });
    btn.type = 'button';
    btn.append(el('span', { class: 'obj-emoji' }, [o.spec.emoji]));
    btn.append(el('span', { class: 'obj-label' }, [o.spec.label]));
    if (o.spec.moving) {
      btn.classList.add('moving');
      btn.style.top = (o.y * 100) + '%';
    } else {
      btn.style.left = (o.x * 100) + '%';
      btn.style.top = (o.y * 100) + '%';
    }
    if (o.spec.hp && o.spec.hp > 1) {
      const fill = el('div', { class: 'obj-hp-fill' });
      btn.append(el('div', { class: 'obj-hp' }, [fill]));
      fill.style.width = (o.hp / o.spec.hp) * 100 + '%';
    }
    field.append(btn);
    domById.set(o.uid, btn);
  };

  field.addEventListener('pointerdown', (e) => {
    if (finished) return;
    const target = (e.target as HTMLElement | null)?.closest('.obj');
    if (!(target instanceof HTMLElement)) return;
    e.preventDefault();
    const uid = target.dataset.uid;
    if (!uid) return;
    const res = engine.tap(uid);
    if (!res.handled) return;
    hapticFor(res);
    showReaction(res, target);
    for (const a of res.announcements) showBanner(a.text, a.tone);
    if (res.resolved) {
      removeObjectDom(uid);
    } else if (res.bossHpLeft !== undefined && res.object) {
      updateBossHp(uid, res.bossHpLeft, res.object.spec.hp ?? res.bossHpLeft);
    }
  });

  const render = (snap: EngineSnapshot): void => {
    scoreNum.textContent = String(snap.stats.score);
    if (snap.stats.combo !== combo) {
      combo = snap.stats.combo;
      comboBox.textContent = 'COMBO x' + combo;
      comboBox.classList.remove('pulse');
      void comboBox.offsetWidth;
      comboBox.classList.add('pulse');
    }
    patienceBar.set(snap.stats.teacherPatience);
    villageBar.set(snap.stats.villageHealth);
    const timeLeft = Math.max(0, snap.durationMs - snap.now);
    timerFill.style.width = ((timeLeft / snap.durationMs) * 100) + '%';
    const tier = healthTier(snap.stats.villageHealth);
    app.dataset.health = tier;
    field.dataset.health = tier;
    field.classList.toggle('paused', snap.pausedUntil > snap.now);

    const live = new Set(snap.objects.map((o) => o.uid));
    for (const [uid] of domById) {
      if (!live.has(uid)) removeObjectDom(uid);
    }
    for (const o of snap.objects) {
      if (!domById.has(o.uid)) createObjectDom(o);
    }
    for (const a of snap.announcements) showBanner(a.text, a.tone);
  };

  const showOverlay = (text: string, ms: number, done: () => void): void => {
    const overlay = el('div', { class: 'overlay' }, [text]);
    app.append(overlay);
    window.setTimeout(() => {
      overlay.remove();
      done();
    }, ms);
  };

  const finishSequence = (): void => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    showOverlay('СТОП', 1000, () => {
      showOverlay('ДЕРЕВНЯ ПРОВОДИТ ОЦЕНКУ УЩЕРБА...', 1600, () => {
        const stats = engine.snapshot().stats;
        const verdict = getVerdict(stats);
        const submit = lb.submit(name, stats.score, stats.villageHealth);
        onFinished({ name, stats, verdict, submit });
      });
    });
  };

  const frame = (nowMs: number): void => {
    const dt = Math.min(100, nowMs - last);
    last = nowMs;
    const snap = engine.tick(dt);
    render(snap);
    if (snap.finished) {
      finishSequence();
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  engine.start();
  const first = engine.snapshot();
  render(first);
  raf = requestAnimationFrame(frame);
}
