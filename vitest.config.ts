import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts']
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
