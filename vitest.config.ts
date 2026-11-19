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
      include: ['src/**/!(*.test).{ts,tsx}'],
      exclude: [
        // Shared test harness. / 共用测试初始化文件。
        'src/test-setup.ts',
        // Ambient declaration for Plasmo's CSS imports. / Plasmo CSS 导入的环境类型声明。
        'src/types/data-text.d.ts',
        // Existing type barrel with a single command discriminator. / 现有类型入口，仅包含一个命令判别函数。
        'src/types/index.ts',
        // Re-exports bundled CSS as a string. / 将打包的 CSS 重新导出为字符串。
        'src/components/search/styles.ts'
      ],
      thresholds: {
        lines: 81,
        functions: 84,
        branches: 68,
        statements: 81,
        // Keep the same floors on the original scope even when overall coverage rises. / 即使总体覆盖率提高，原有范围仍执行相同门槛。
        'src/!(background|contents){,/**}': { lines: 81, functions: 84, branches: 68, statements: 81 },
        'src/background/**': { lines: 99, functions: 99, branches: 98, statements: 98 },
        'src/contents/**': { lines: 95, functions: 86, branches: 87, statements: 91 }
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
