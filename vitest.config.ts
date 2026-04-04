import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/types/**'
      ]
    }
  },
  resolve: {
    alias: {
      '~lib': resolve(__dirname, './src/lib'),
      '~types': resolve(__dirname, './src/types'),
      '~components': resolve(__dirname, './src/components'),
      '~contents': resolve(__dirname, './src/contents')
    }
  }
})
