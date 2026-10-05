import { defineConfig } from 'vite';

// base: './' — собранный бандл работает от любого пути:
// GitHub Pages (проектный сайт /dzoragyugh-game/), собственный домен,
// локальный preview и Telegram Mini App.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
