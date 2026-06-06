import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { SearchResult } from '~types'

// Spy on every ResultItem render so we can assert unrelated rows are skipped.
const renderSpy = vi.fn<(id: string) => void>()

vi.mock('./ResultItem', async () => {
  const actual = await vi.importActual<typeof import('./ResultItem')>('./ResultItem')
  const Wrapped: React.FC<React.ComponentProps<typeof actual.default>> = (props) => {
    renderSpy(props.result.id)
    return React.createElement(actual.default, props)
  }
  return { ...actual, default: Wrapped }
})

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  renderSpy.mockClear()
})

// Import after the mock is registered.
import SearchResults from './SearchResults'

const r = (id: string, name: string): SearchResult => ({
  id,
  name,
  type: 'ApexClass',
  url: `/lightning/setup/ApexClasses/page?address=%2F${id}`
})

const results: Record<string, SearchResult[]> = {
  ApexClass: [r('a1', 'Alpha'), r('a2', 'Bravo'), r('a3', 'Charlie')]
}

const Harness: React.FC<{ initialIndex: number }> = ({ initialIndex }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex)
  const onResultClick = React.useCallback(() => {}, [])
  return (
    <div>
      <button data-testid="advance" onClick={() => setSelectedIndex((i) => i + 1)}>
        advance
      </button>
      <SearchResults results={results} selectedIndex={selectedIndex} onResultClick={onResultClick} />
    </div>
  )
}

describe('SearchResults', () => {
  it('renders all rows grouped under their type label', () => {
    const onResultClick = vi.fn()
    render(<SearchResults results={results} selectedIndex={0} onResultClick={onResultClick} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Bravo')).toBeTruthy()
    expect(screen.getByText('Charlie')).toBeTruthy()
    expect(screen.getByText('Apex Classes')).toBeTruthy()
  })

  it('fires onResultClick with the clicked result', () => {
    const onResultClick = vi.fn()
    render(<SearchResults results={results} selectedIndex={0} onResultClick={onResultClick} />)
    fireEvent.click(screen.getByText('Bravo'))
    expect(onResultClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a2' }))
  })

  // Proves the memo optimization: moving selection from row 0 to row 1 must
  // only re-render the two rows whose isSelected flag changed, not row 2 whose
  // props are unchanged.
  it('does not re-render unrelated rows when the selected index changes', () => {
    render(<Harness initialIndex={0} />)

    // Initial mount renders all three rows.
    expect(renderSpy.mock.calls.map((c) => c[0])).toEqual(['a1', 'a2', 'a3'])
    renderSpy.mockClear()

    // Selection moves 0 -> 1: a1 (was selected) and a2 (now selected) change;
    // a3 is unaffected and must be skipped by React.memo.
    fireEvent.click(screen.getByTestId('advance'))

    const rerendered = renderSpy.mock.calls.map((c) => c[0])
    expect(rerendered).toContain('a1')
    expect(rerendered).toContain('a2')
    expect(rerendered).not.toContain('a3')
  })
})
