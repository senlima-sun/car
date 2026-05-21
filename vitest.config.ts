import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['apps/game/tsconfig.json'] })],
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
