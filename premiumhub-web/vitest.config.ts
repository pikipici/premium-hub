import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['vendor/**', 'node_modules/**', '.next/**'],
  },
})
