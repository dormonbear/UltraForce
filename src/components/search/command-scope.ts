import { t } from '~lib/i18n'
import type { SearchCommand } from '~types'

const SCOPE_ICONS: Readonly<Record<string, string>> = {
  CustomObject: 'layout',
  Flow: 'flow',
  User: 'sharing',
  Profile: 'sharing',
  SetupShortcut: 'setup'
}

export function getScopeDetails(chip: SearchCommand) {
  const type = chip.isBuiltin ? (chip.types[0] ?? 'SetupShortcut') : undefined
  const title = chip.isBuiltin ? t(chip.description) : chip.description
  return {
    type,
    prefix: `:${chip.key} `,
    title,
    // Drop parenthetical details to keep the chip compact. / 去掉括号说明以保持标签紧凑。
    label: title.replace(/\s*[(（].*$/, '') || title,
    icon: (type && SCOPE_ICONS[type]) || 'type'
  }
}
