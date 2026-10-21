import { chineseMessages } from './i18n-messages'

export type Locale = 'en' | 'zh-CN'

export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0]
    if (base === 'zh') return 'zh-CN'
    if (base === 'en') return 'en'
  }
  return 'en'
}

export function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
}

// Translate application messages only; preserve user/organization content.
// 仅翻译应用自身消息；保留用户及组织内容原文。
export function t(
  message: string,
  values: Readonly<Record<string, string | number>> = {},
  locale: Locale = browserLocale()
): string {
  const template = locale === 'zh-CN' && Object.hasOwn(chineseMessages, message) ? chineseMessages[message] : message
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder
  )
}
