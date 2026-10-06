import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Обрабатывать CSS-импорты (?raw в тестах UI): при false они подменяются пустышками.
    css: true,
  },
});
