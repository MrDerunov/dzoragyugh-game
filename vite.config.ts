import { defineConfig } from 'vite';

// base: './' — собранный бандл работает от любого пути:
// GitHub Pages (проектный сайт /dzoragyugh-game/), собственный домен,
// локальный preview и Telegram Mini App.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Имя CSS-файла без префикса index-: на GitHub Pages файлы с именем
        // index-<hash>.css иногда не отдаются (см. docs/DEPLOY.md, раздел 8).
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? info.name ?? 'asset';
          return name.endsWith('.css') ? 'assets/style-[hash][extname]' : 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
