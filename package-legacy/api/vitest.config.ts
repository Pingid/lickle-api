import { defineConfig } from 'vitest/config'

// Only the sources: `dist` holds compiled copies of these same tests.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
