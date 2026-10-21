import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SearchInput from './SearchInput'
import EmptyState from './EmptyState'
import CommandHints from './CommandHints'
import ResultItem from './ResultItem'
import SettingsPanel from './SettingsPanel'
import { getMatchingCommands } from '~lib/command-parser'

vi.mock('~lib/salesforce-api', () => ({
  getUnsupportedTypes: vi.fn().mockResolvedValue([]),
  clearMetadataCache: vi.fn().mockResolvedValue(undefined),
  warmupMetadataCache: vi.fn().mockResolvedValue(undefined)
}))

beforeEach(() => vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Chinese UI and content preservation / 中文界面及内容保留', () => {
  it('finds built-in commands by Chinese or English descriptions / 通过中英文描述查找内置命令', () => {
    expect(getMatchingCommands(':对象').map((command) => command.key)).toContain('o')
    expect(getMatchingCommands(':objects').map((command) => command.key)).toContain('o')
  })

  it('localizes search accessibility and query interpolation / 本地化搜索无障碍标签及查询插值', () => {
    render(<SearchInput query="" onQueryChange={vi.fn()} onKeyDown={vi.fn()} sfHost="acme.my.salesforce.com" />)
    expect(screen.getByRole('combobox', { name: '搜索 Salesforce 元数据' })).toHaveAttribute(
      'placeholder',
      '搜索 acme 元数据…'
    )
    expect(screen.getByText('生产')).toBeInTheDocument()
    render(<EmptyState type="empty" query="<Acme {query}>" />)
    expect(screen.getByText('未找到“<Acme {query}>”的结果')).toBeInTheDocument()
  })

  it('translates built-in commands while preserving identical custom descriptions / 翻译内置命令并保留同名自定义描述', () => {
    render(
      <CommandHints
        commands={[
          { key: 'o', description: 'Objects & Fields', types: [], isBuiltin: true },
          {
            key: 'x',
            description: 'Objects & Fields',
            soql: 'SELECT Id FROM Account',
            isBuiltin: false,
            useToolingApi: false,
            nameField: 'Name'
          }
        ]}
      />
    )
    expect(screen.getByText('对象及字段')).toBeInTheDocument()
    expect(screen.getByText('Objects & Fields')).toBeInTheDocument()
  })

  it('preserves Salesforce record names and descriptions / 保留 Salesforce 记录名称及描述', () => {
    render(
      <ResultItem
        result={{ id: 'fixture', name: 'Settings', description: 'Privacy', type: 'CustomObject' }}
        isSelected={false}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByTitle('字段')).toBeInTheDocument()
  })

  it('renders settings and validates a custom command in Chinese / 使用中文渲染设置并校验自定义命令', async () => {
    const save = vi.fn()
    render(
      <SettingsPanel
        onClose={vi.fn()}
        selectedTypes={['ApexClass']}
        onToggleType={vi.fn()}
        shortcutKey="b"
        onShortcutChange={vi.fn()}
        closeOnNavigate
        onCloseOnNavigateChange={vi.fn()}
        autoLoadFields={false}
        onAutoLoadFieldsChange={vi.fn()}
        fuzzySearch
        onFuzzySearchChange={vi.fn()}
        hideManagedPackage
        onHideManagedPackageChange={vi.fn()}
        maxResultsPerType={10}
        onMaxResultsPerTypeChange={vi.fn()}
        managedKeys={['hideManagedPackage']}
        navigationMode="auto"
        onNavigationModeChange={vi.fn()}
        sfHost="acme.my.salesforce.com"
        customCommands={{}}
        onCustomCommandsChange={save}
      />
    )
    expect(await screen.findByText('设置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument()
    expect(screen.getByText('由您的组织管理')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '对象及字段' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('+ 添加命令'))
    fireEvent.change(screen.getByPlaceholderText('例如 log'), { target: { value: 'log' } })
    fireEvent.change(screen.getByPlaceholderText('例如：我的日志'), { target: { value: 'Settings' } })
    fireEvent.change(screen.getByPlaceholderText(/SELECT Id, Name FROM/), {
      target: { value: 'SELECT Id FROM Account' }
    })
    fireEvent.click(screen.getByText('保存'))
    expect(screen.getByText('SOQL 必须包含 {query} 占位符')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
})
