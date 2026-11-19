import React from 'react'
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BUILTIN_COMMANDS } from '~lib/command-parser'
import { createKeyboardInterceptor } from '~lib/keyboard-interceptor'
import SearchInput from './SearchInput'

function renderInput(props: Partial<React.ComponentProps<typeof SearchInput>> = {}) {
  const onQueryChange = vi.fn()
  const onKeyDown = vi.fn()
  const utils = render(
    <SearchInput
      query=""
      commands={BUILTIN_COMMANDS}
      onQueryChange={onQueryChange}
      onKeyDown={onKeyDown}
      sfHost={null}
      {...props}
    />
  )
  return { onQueryChange, onKeyDown, ...utils }
}

describe('SearchInput', () => {
  beforeEach(() => {
    cleanup()
  })
  afterEach(() => vi.restoreAllMocks())

  describe('command scope / 命令范围', () => {
    it('shows the scope and edits the remainder / 显示范围并编辑剩余文本', () => {
      const { onQueryChange } = renderInput({ query: ':f create case' })
      const input = screen.getByRole('combobox')
      expect(screen.getByTitle('Flows')).toHaveTextContent('Flows')
      expect(input).toHaveValue('create case')
      fireEvent.change(input, { target: { value: 'create caseX' } })
      expect(onQueryChange).toHaveBeenCalledWith(':f create caseX')
    })

    it.each([
      ['en-US', 'Custom Codes', 'Custom Codes (Apex/Trigger/Visualforce/LWC/Aura)'],
      ['zh-CN', '自定义代码', '自定义代码（Apex／触发器／Visualforce／LWC／Aura）']
    ])('shortens long scope labels in %s / 缩短较长的范围标签', (locale, label, title) => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
      renderInput({ query: ':c ' })
      expect(screen.getByTitle(title)).toHaveTextContent(label)
      expect(screen.getByTitle(title)).not.toHaveTextContent('Apex')
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toContain(label)
      expect(screen.getByRole('combobox').getAttribute('placeholder')).not.toContain('Apex')
    })

    it.each([':f', ':zz foo'])('keeps %j in the input / 在输入框中保留 %j', (query) => {
      renderInput({ query })
      const input = screen.getByRole('combobox')
      expect(input).toHaveValue(query)
      expect(input).not.toHaveAttribute('aria-describedby')
    })

    it.each([
      ['en-US', 'Search Flows...', 'Scope: Flows'],
      ['zh-CN', '在 流程 中搜索...', '范围：流程']
    ])(
      'localizes the placeholder and description in %s / 本地化 %s 占位符和说明',
      (locale, placeholder, description) => {
        vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
        renderInput({ query: ':f ' })
        const input = screen.getByRole('combobox')
        expect(input).toHaveValue('')
        expect(input).toHaveAttribute('placeholder', placeholder)
        expect(input).toHaveAccessibleDescription(description)
      }
    )

    it('removes an empty scope with Backspace / 通过退格键移除空范围', () => {
      const { onQueryChange } = renderInput({ query: ':f ' })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
      expect(onQueryChange).toHaveBeenCalledWith('')
    })

    it('allows regular Backspace with text at the caret / 光标所在输入框有文本时保留退格键行为', () => {
      const { onQueryChange } = renderInput({ query: ':f x' })
      const input = screen.getByRole<HTMLInputElement>('combobox')
      input.setSelectionRange(0, 0)
      expect(fireEvent.keyDown(input, { key: 'Backspace' })).toBe(true)
      expect(onQueryChange).not.toHaveBeenCalled()
    })

    it('forwards a complete custom event value while scoped / 在限定范围时转发完整的自定义事件值', () => {
      const { onQueryChange } = renderInput({ query: ':f ' })
      fireEvent(screen.getByRole('combobox'), new CustomEvent('ultraforce-input', { detail: { value: ':g debug' } }))
      expect(onQueryChange).toHaveBeenCalledWith(':g debug')
    })

    it('keeps the query scoped through intercepted edits / 拦截编辑时保留查询范围', () => {
      const { onQueryChange } = renderInput({ query: ':f ' })
      const input = screen.getByRole<HTMLInputElement>('combobox')
      const intercept = createKeyboardInterceptor(() => input)
      intercept(new KeyboardEvent('keydown', { key: 'x' }))
      expect(onQueryChange).toHaveBeenLastCalledWith(':f x')
      expect(input).toHaveValue('x')
      intercept(new KeyboardEvent('keydown', { key: 'Backspace' }))
      expect(onQueryChange).toHaveBeenLastCalledWith(':f ')
      intercept(new KeyboardEvent('keydown', { key: 'Backspace' }))
      expect(onQueryChange).toHaveBeenLastCalledWith('')
    })
  })

  describe('placeholder', () => {
    it('derives placeholder from the first label of the host', () => {
      renderInput({ sfHost: 'acme.my.salesforce.com' })
      expect(screen.getByPlaceholderText('Search acme metadata...')).toBeTruthy()
    })

    it('uses the generic placeholder when no host is provided', () => {
      renderInput({ sfHost: null })
      expect(screen.getByPlaceholderText('Search Salesforce metadata...')).toBeTruthy()
    })
  })

  describe('org type detection', () => {
    it.each([
      ['acme.my.salesforce.com', 'PROD'],
      ['acme.lightning.force.com', 'PROD'],
      ['acme.sfcrmproducts.cn', 'PROD'],
      ['acme.sfcrmapps.cn', 'PROD'],
      ['acme--qa.my.salesforce.com', 'SANDBOX'],
      ['acme.sandbox.my.salesforce.com', 'SANDBOX'],
      ['cs42.sandbox.my.salesforce.com', 'SANDBOX'],
      ['acme--dev.lightning.force.com', 'SANDBOX'],
      ['acme-dev.my.salesforce.com', 'DEV'],
      ['developer.salesforce.com', 'DEV'],
      ['acme.scratch.my.salesforce.com', 'SCRATCH'],
      ['acme.scratch.salesforce.com', 'SCRATCH'],
      ['acme.example.com', 'ORG'],
      ['ACME.MY.SALESFORCE.COM', 'PROD']
    ])('detects %s as %s', (host, expectedLabel) => {
      renderInput({ sfHost: host })
      const badge = screen.getByText(expectedLabel)
      expect(badge).toBeTruthy()
      expect(badge).toHaveAttribute('title', host)
    })

    it('hides the org badge when no host is provided', () => {
      renderInput({ sfHost: null })
      expect(document.querySelector('.org-badge')).toBeNull()
    })
  })

  describe('query input', () => {
    it('calls onQueryChange when the user types', () => {
      const { onQueryChange } = renderInput()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'account' } })
      expect(onQueryChange).toHaveBeenCalledWith('account')
    })

    it('forwards keydown to onKeyDown and stops propagation to ancestors', () => {
      const { onKeyDown } = renderInput()
      const docListener = vi.fn()
      document.addEventListener('keydown', docListener)
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
      document.removeEventListener('keydown', docListener)
      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
      expect(docListener).not.toHaveBeenCalled()
    })

    it('stops keyup propagation without invoking onKeyDown', () => {
      const { onKeyDown } = renderInput()
      const docListener = vi.fn()
      document.addEventListener('keyup', docListener)
      fireEvent.keyUp(screen.getByRole('combobox'), { key: 'a' })
      document.removeEventListener('keyup', docListener)
      expect(onKeyDown).not.toHaveBeenCalled()
      expect(docListener).not.toHaveBeenCalled()
    })

    it('listens for ultraforce-input custom events and updates the query', () => {
      const { onQueryChange } = renderInput()
      fireEvent(
        screen.getByRole('combobox'),
        new CustomEvent('ultraforce-input', { detail: { value: 'custom-query' } })
      )
      expect(onQueryChange).toHaveBeenCalledWith('custom-query')
    })

    it('uses the latest onQueryChange callback for custom events', () => {
      const { onQueryChange, rerender } = renderInput()
      const secondChange = vi.fn()
      rerender(
        <SearchInput
          query=""
          commands={BUILTIN_COMMANDS}
          onQueryChange={secondChange}
          onKeyDown={vi.fn()}
          sfHost={null}
        />
      )
      fireEvent(screen.getByRole('combobox'), new CustomEvent('ultraforce-input', { detail: { value: 'v2' } }))
      expect(onQueryChange).not.toHaveBeenCalled()
      expect(secondChange).toHaveBeenCalledWith('v2')
    })

    it('uses an empty string when the custom event has no detail value', () => {
      const { onQueryChange } = renderInput()
      fireEvent(screen.getByRole('combobox'), new CustomEvent('ultraforce-input'))
      expect(onQueryChange).toHaveBeenCalledWith('')
    })
  })

  describe('ref and attributes', () => {
    it('attaches a forwarded object ref to the input element', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(
        <SearchInput
          query=""
          commands={BUILTIN_COMMANDS}
          onQueryChange={vi.fn()}
          onKeyDown={vi.fn()}
          sfHost={null}
          ref={ref}
        />
      )
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(ref.current?.hasAttribute('data-ultraforce-input')).toBe(true)
    })

    it('calls a forwarded function ref with the input element', () => {
      const ref = vi.fn()
      render(
        <SearchInput
          query=""
          commands={BUILTIN_COMMANDS}
          onQueryChange={vi.fn()}
          onKeyDown={vi.fn()}
          sfHost={null}
          ref={ref}
        />
      )
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement))
    })

    it('focuses the input on mount and exposes an accessible name', () => {
      renderInput()
      const input = screen.getByRole('combobox')
      expect(document.activeElement).toBe(input)
      expect(input).toHaveAttribute('aria-label', 'Search Salesforce metadata')
    })
  })
})
