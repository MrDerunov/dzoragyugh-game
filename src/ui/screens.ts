import type { GameStats, Verdict } from '../core/index';
import type { LeaderboardService, SubmitOutcome } from '../services/types';
import { appRoot, clear, el } from './dom';

const STATUSES = [
  'Спаситель деревни',
  'Почётный ученик',
  'Грамматика под контролем',
  'Опасен, но обучаем',
  'Требуется словарь',
  'Под наблюдением',
  'Въезд ограничен',
  'Обнаружен русский',
  'Овцы обеспокоены',
];

const statusOf = (rank: number): string => STATUSES[Math.min(rank - 1, STATUSES.length - 1)]!;

export interface StartOptions {
  tgAvailable: boolean;
  initialName: string;
  lb: LeaderboardService;
  onStart: (name: string) => void;
}

/** Стартовый экран: заголовок, имя, рекорд, большая кнопка, пасхалка-овца. */
export function showStart(opts: StartOptions): void {
  const app = appRoot();
  clear(app);
  app.removeAttribute('data-health');

  const screen = el('div', { class: 'screen screen-start' });
  if (!opts.tgAvailable) {
    screen.append(el('div', { class: 'dev-badge' }, ['DEV MODE']));
  }

  const top = opts.lb.get()[0];
  const recordLine = top ? 'Рекорд: ' + top.name + ' — ' + top.score : 'Рекордов пока нет. Пока.';

  const sheep = el('span', { class: 'm sheep', title: 'ոչխար' }, ['🐑']);

  const input = el('input', {
    class: 'name-input',
    type: 'text',
    placeholder: 'Кто сегодня представляет угрозу?',
    maxlength: '24',
  }) as HTMLInputElement;
  input.value = opts.initialName;

  const startBtn = el('button', { class: 'btn btn-primary' }, ['ՓՐԿԵԼ ԳՅՈՒՂԸ / СПАСТИ ДЕРЕВНЮ']);
  startBtn.addEventListener('click', () => {
    const name = input.value.trim() || 'Ученик';
    opts.onStart(name);
  });

  screen.append(
    el('h1', { class: 'title' }, ['ԳՅՈՒՂԸ ԿԴԻՄԱՆԱ՞']),
    el('p', { class: 'subtitle' }, ['Выживет ли деревня после приезда учеников?']),
    el('div', { class: 'scene' }, [
      el('span', { class: 'm' }, ['☀️']),
      el('span', { class: 'm' }, ['🏔️']),
      el('span', { class: 'm' }, ['🏠']),
      sheep,
      el('span', { class: 'm' }, ['🌳']),
    ]),
    el('p', { class: 'record' }, [recordLine]),
    input,
    startBtn,
    el('p', { class: 'footnote' }, ['Предыдущий год деревня пережила.']),
  );
  app.append(screen);

  // Пасхалка: 5 тапов по овце → карточка персонажа ՈՉԽԱՐ
  let sheepTaps = 0;
  sheep.addEventListener('click', () => {
    sheepTaps += 1;
    if (sheepTaps < 5) return;
    sheepTaps = 0;
    const overlay = el('div', { class: 'sheep-card' }, [
      el('div', { class: 'inner' }, [
        el('div', { class: 'sheep-big' }, ['🐑']),
        el('h2', {}, ['ՈՉԽԱՐ / ОВЦА']),
        el('p', {}, ['Armenian: 100%']),
        el('p', {}, ['Homework: 0%']),
        el('p', {}, ['Motivation: grass']),
      ]),
    ]);
    overlay.addEventListener('click', () => overlay.remove());
    app.append(overlay);
  });
}

/** Отсчёт 3-2-1-ԲԱՐԻ ԳԱԼՈՒՍՏ ԳՅՈՒՂ перед партией. */
export function showCountdown(onDone: () => void): void {
  const app = appRoot();
  const overlay = el('div', { class: 'overlay countdown' });
  const big = el('div', { class: 'countdown-num' }, ['3']);
  overlay.append(big);
  app.append(overlay);

  const steps = ['3', '2', '1', 'ԲԱՐԻ ԳԱԼՈՒՍՏ ԳՅՈՒՂ'];
  let i = 0;
  const next = (): void => {
    if (i >= steps.length) {
      overlay.remove();
      onDone();
      return;
    }
    big.textContent = steps[i]!;
    big.classList.remove('pop');
    void big.offsetWidth;
    big.classList.add('pop');
    i += 1;
    window.setTimeout(next, 900);
  };
  next();
}

export interface ResultOptions {
  name: string;
  stats: GameStats;
  verdict: Verdict;
  submit: SubmitOutcome;
  onAgain: () => void;
  onMenu: () => void;
}

/** Финальная карточка: «официальная оценка ущерба» + рейтинг. */
export function showResult(opts: ResultOptions): void {
  const app = appRoot();
  clear(app);
  app.removeAttribute('data-health');

  const { name, stats, verdict, submit } = opts;
  const screen = el('div', { class: 'screen screen-result' });
  const card = el('div', { class: 'result-card' });

  card.append(el('h2', { class: 'result-name' }, [name]));
  card.append(el('div', { class: 'result-score' }, [String(stats.score) + ' очков']));

  if (submit.isPersonalBest) {
    card.append(el('div', { class: 'badge-record' }, ['🏆 НОВЫЙ РЕКОРД']));
  }

  const grid = el('div', { class: 'stats-grid' });
  const row = (k: string, v: string): void => {
    grid.append(el('div', { class: 'k' }, [k]), el('div', { class: 'v' }, [v]));
  };
  row('Деревня', stats.villageHealth + '%');
  row('Терпение преподавательницы', stats.teacherPatience + '%');
  row('Максимальное комбо', 'x' + stats.maxCombo);
  row('Русизмов уничтожено', String(stats.russianismsDestroyed));
  row('Спасено овец', stats.sheepSaved > 0 ? String(stats.sheepSaved) : 'ни одной (они сами)');
  row('Потеряно окончаний', String(stats.mistakes));
  row('Собрано гаты', String(stats.gataCollected));
  card.append(grid);

  card.append(el('div', { class: 'verdict-title' }, [verdict.title]));
  card.append(el('p', { class: 'verdict-diagnosis' }, [verdict.diagnosis]));

  const total = submit.entries.length;
  card.append(el('p', { class: 'rank-line' }, [submit.rank + ' место из ' + total]));
  if (submit.beaten) {
    card.append(el('p', { class: 'beaten-line' }, ['⚠️ ' + name.toUpperCase() + ' ОБОШЁЛ ' + submit.beaten.name.toUpperCase()]));
  } else if (submit.rank > 1) {
    const above = submit.entries[submit.rank - 2];
    if (above) {
      const diff = above.score - stats.score;
      card.append(el('p', { class: 'rank-line' }, ['До ' + above.name + ': ' + diff + ' очков']));
    }
  } else {
    card.append(el('p', { class: 'rank-line' }, ['Деревня официально впечатлена.']));
  }

  // Таблица рейтинга (топ-10)
  const table = el('table', { class: 'lb-table' });
  const thead = el('thead', {}, [el('tr', {}, [
    el('th', {}, ['#']), el('th', {}, ['Игрок']), el('th', {}, ['Очки']), el('th', {}, ['Статус']),
  ])]);
  const tbody = el('tbody');
  submit.entries.slice(0, 10).forEach((entry, i) => {
    const tr = el('tr', {});
    if (entry.name.toLowerCase() === name.toLowerCase()) tr.className = 'me';
    tr.append(
      el('td', {}, [String(i + 1)]),
      el('td', {}, [entry.name]),
      el('td', { class: 'num' }, [String(entry.score)]),
      el('td', { class: 'status' }, [statusOf(i + 1)]),
    );
    tbody.append(tr);
  });
  table.append(thead, tbody);
  card.append(table);

  const againBtn = el('button', { class: 'btn btn-primary' }, ['ԵՎՍ ՄԵԿ / ЕЩЁ РАЗ']);
  againBtn.addEventListener('click', opts.onAgain);
  const menuBtn = el('button', { class: 'btn btn-secondary' }, ['В МЕНЮ']);
  menuBtn.addEventListener('click', opts.onMenu);
  const btnRow = el('div', { class: 'btn-row' }, [againBtn, menuBtn]);

  if (verdict.tier === 'dead') {
    const sorryBtn = el('button', { class: 'btn btn-secondary' }, ['ИЗВИНИТЬСЯ']);
    sorryBtn.addEventListener('click', () => {
      const toast = el('div', { class: 'toast' }, ['Извинение принято. Но домашка остаётся.']);
      app.append(toast);
      window.setTimeout(() => toast.remove(), 2600);
    });
    btnRow.prepend(sorryBtn);
  }

  card.append(btnRow);
  screen.append(card);
  app.append(screen);
}
