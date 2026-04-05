import { defineConfig, type Plugin } from 'vitest/config'
import { resolve } from 'path'
import { readFileSync } from 'fs'

/**
 * Resolves Plasmo's data-text: imports by reading the file and returning its content as a string.
 * In the Plasmo build, data-text: is handled natively by Parcel.
 */
function dataTextPlugin(): Plugin {
  return {
    name: 'data-text-resolver',
    resolveId(source, importer) {
      if (source.startsWith('data-text:')) {
        const relativePath = source.replace('data-text:', '')
        if (importer) {
          const dir = importer.substring(0, importer.lastIndexOf('/'))
          return `\0data-text:${resolve(dir, relativePath)}`
        }
      }
      return null
    },
    load(id) {
      if (id.startsWith('\0data-text:')) {
        const filePath = id.replace('\0data-text:', '')
        const content = readFileSync(filePath, 'utf-8')
        return `export default ${JSON.stringify(content)}`
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [dataTextPlugin()],
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
        'src/types/**',
        'src/contents/**',
        'src/background/**',
        'src/components/search/styles.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '~lib': resolve(__dirname, './src/lib'),
      '~types': resolve(__dirname, './src/types'),
      '~components': resolve(__dirname, './src/components'),
      '~contents': resolve(__dirname, './src/contents'),
      '~stores': resolve(__dirname, './src/stores')
    }
  }
})
