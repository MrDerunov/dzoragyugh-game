// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import stylesCss from '../styles.css?raw';
import { createLocalLeaderboard } from '../services/leaderboard';
import { startGame } from './play';

/**
 * Регрессионные тесты игрового экрана:
 * 1) экран должен иметь базовый класс .screen (flex-раскладка);
 * 2) CSS .screen-play обязан растягивать HUD и поле на всю ширину/высоту —
 *    иначе поле схлопывается и объекты не видны (баг «пустое поле»).
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

  it('CSS игрового экрана: stretch-раскладка, поле заполняет остаток', () => {
    const css = stylesCss;

    const playRule = css.match(/\.screen-play\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(playRule).toContain('flex: 1');
    expect(playRule).toContain('display: flex');
    expect(playRule).toContain('align-items: stretch');
    expect(playRule).toContain('justify-content: flex-start');
    expect(playRule).toContain('position: relative');

    const fieldRule = css.match(/\.field\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(fieldRule).toContain('flex: 1');
    expect(fieldRule).toContain('position: relative');
    expect(fieldRule).toContain('overflow: hidden');
  });
});
