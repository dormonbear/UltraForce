import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLocale, resolveLocale, t } from './i18n'

afterEach(() => vi.restoreAllMocks())

describe('browser localization / 浏览器本地化', () => {
  it('selects the first supported browser language / 选择首个支持的浏览器语言', () => {
    expect(resolveLocale(['fr-FR', 'zh-CN', 'en-US'])).toBe('zh-CN')
    expect(resolveLocale(['en-GB', 'zh-CN'])).toBe('en')
    expect(resolveLocale(['ZH_tw'])).toBe('zh-CN')
    expect(resolveLocale(['de-DE'])).toBe('en')
    expect(resolveLocale([])).toBe('en')
  })

  it('uses browser preferences without storage / 使用浏览器偏好且不写入存储', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN'])
    expect(browserLocale()).toBe('zh-CN')
    expect(t('Settings')).toBe('设置')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    expect(t('Settings')).toBe('Settings')
  })

  it('preserves substitutions and unknown messages / 保留插值及未知消息', () => {
    expect(t('Search {org} metadata...', { org: 'Acme {org} <team>' }, 'zh-CN')).toBe('搜索 Acme {org} <team> 元数据…')
    expect(t('{count} results', { count: 0 }, 'zh-CN')).toBe('0 条结果')
    expect(t('Missing {value}', {}, 'zh-CN')).toBe('Missing {value}')
    expect(t('Settings', {}, 'en')).toBe('Settings')
    for (const message of ['toString', 'constructor', '__proto__']) {
      expect(t(message, {}, 'zh-CN')).toBe(message)
    }
  })
})
