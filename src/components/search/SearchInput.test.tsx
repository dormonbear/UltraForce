import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SearchInput from './SearchInput'

function renderInput(props: Partial<React.ComponentProps<typeof SearchInput>> = {}) {
  const onQueryChange = vi.fn()
  const onKeyDown = vi.fn()
  const utils = render(
    <SearchInput query="" onQueryChange={onQueryChange} onKeyDown={onKeyDown} sfHost={null} {...props} />
  )
  return { onQueryChange, onKeyDown, ...utils }
}

describe('SearchInput', () => {
  beforeEach(() => {
    cleanup()
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
      rerender(<SearchInput query="" onQueryChange={secondChange} onKeyDown={vi.fn()} sfHost={null} />)
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
      render(<SearchInput query="" onQueryChange={vi.fn()} onKeyDown={vi.fn()} sfHost={null} ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(ref.current?.hasAttribute('data-ultraforce-input')).toBe(true)
    })

    it('calls a forwarded function ref with the input element', () => {
      const ref = vi.fn()
      render(<SearchInput query="" onQueryChange={vi.fn()} onKeyDown={vi.fn()} sfHost={null} ref={ref} />)
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
