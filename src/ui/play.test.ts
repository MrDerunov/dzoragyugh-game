// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createLocalLeaderboard } from '../services/leaderboard';
import { startGame } from './play';

/**
 * Регрессионный тест: игровой экран должен иметь базовый класс .screen
 * (даёт flex-раскладку), иначе поле схлопывается в нулевую высоту
 * и объекты не видны (баг «пустое поле»).
 */
describe('startGame (DOM)', () => {
  it('рендерит экран с классом screen и объектами на поле', () => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    let finished = false;
    startGame({
      name: 'Тест',
      lb: createLocalLeaderboard(),
      onFinished: () => { finished = true; },
    });

    const screen = document.querySelector('.screen-play');
    expect(screen).not.toBeNull();
    expect(screen!.classList.contains('screen')).toBe(true);

    const field = document.querySelector('.field');
    expect(field).not.toBeNull();
    // На старте движок сразу спавнит обучающую пару: кофе + «ну типа»
    expect(field!.querySelectorAll('.obj').length).toBeGreaterThanOrEqual(2);

    expect(finished).toBe(false);
  });
});
