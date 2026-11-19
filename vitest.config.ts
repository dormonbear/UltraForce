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
        // Shared test harness. / 共用测试初始化文件。
        'src/test-setup.ts',
        // Ambient declaration for Plasmo's CSS imports. / Plasmo CSS 导入的环境类型声明。
        'src/types/data-text.d.ts',
        // Contains runtime type guards. Exclude this file to keep the original scope and floors comparable to develop.
        // 此文件包含运行时类型守卫。排除后，原有范围及门槛仍可与 develop 对比。
        'src/types/index.ts',
        // Re-exports bundled CSS as a string. / 将打包的 CSS 重新导出为字符串。
        'src/components/search/styles.ts'
      ],
      // Floors, not targets. Set them just below measured coverage to prevent regressions.
      // Raise them whenever measured coverage increases.
      // 这些是最低门槛，而非目标值。将门槛设在略低于实测覆盖率的位置，以防止回退。
      // 每当实测覆盖率提高时，上调门槛。
      thresholds: {
        lines: 81,
        functions: 84,
        branches: 68,
        statements: 81,
        // Keep the same floors on the original scope even when overall coverage rises.
        // 即使总体覆盖率提高，原有范围仍执行相同门槛。
        'src/!(background|contents){,/**}': { lines: 81, functions: 84, branches: 68, statements: 81 },
        'src/background/**': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/contents/**': { lines: 93, functions: 83, branches: 85, statements: 89 }
      }
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
