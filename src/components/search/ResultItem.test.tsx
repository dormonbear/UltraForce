import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ResultItem from './ResultItem'
import type { SearchResult } from '~types'

const makeResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'test-001',
  name: 'TestClass',
  type: 'ApexClass',
  url: '/lightning/setup/ApexClasses/page?address=%2F01p000000000001',
  ...overrides
})

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ResultItem', () => {
  const defaultProps = {
    result: makeResult(),
    isSelected: false,
    onClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render result name', () => {
    render(<ResultItem {...defaultProps} />)
    expect(screen.getByText('TestClass')).toBeTruthy()
  })

  it('should render description when provided', () => {
    render(
      <ResultItem
        {...defaultProps}
        result={makeResult({ description: 'A test class' })}
      />
    )
    expect(screen.getByText('A test class')).toBeTruthy()
  })

  it('should apply selected class when isSelected is true', () => {
    const { container } = render(
      <ResultItem {...defaultProps} isSelected={true} />
    )
    const item = container.querySelector('.result-item')
    expect(item?.classList.contains('selected')).toBe(true)
  })

  it('should call onClick when clicked', () => {
    render(<ResultItem {...defaultProps} />)
    fireEvent.click(screen.getByText('TestClass'))
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1)
  })

  it('should show pin icon when onToggleFavorite is provided', () => {
    render(
      <ResultItem
        {...defaultProps}
        onToggleFavorite={vi.fn()}
        isFavorite={false}
      />
    )
    expect(screen.getByTitle('Pin to favorites')).toBeTruthy()
  })

  it('should show unpin title when isFavorite is true', () => {
    render(
      <ResultItem
        {...defaultProps}
        onToggleFavorite={vi.fn()}
        isFavorite={true}
      />
    )
    expect(screen.getByTitle('Remove from favorites')).toBeTruthy()
  })

  it('should not show pin icon when onToggleFavorite is not provided', () => {
    render(<ResultItem {...defaultProps} />)
    expect(screen.queryByTitle('Pin to favorites')).toBeNull()
    expect(screen.queryByTitle('Remove from favorites')).toBeNull()
  })

  it('should call onToggleFavorite with correct item on pin click', () => {
    const onToggleFavorite = vi.fn()
    render(
      <ResultItem
        {...defaultProps}
        result={makeResult({ description: 'Service class' })}
        onToggleFavorite={onToggleFavorite}
        isFavorite={false}
      />
    )
    fireEvent.click(screen.getByTitle('Pin to favorites'))
    expect(onToggleFavorite).toHaveBeenCalledWith({
      id: 'test-001',
      name: 'TestClass',
      type: 'ApexClass',
      url: '',
      description: 'Service class'
    })
  })

  it('should show filled star SVG when pinned', () => {
    const { container } = render(
      <ResultItem
        {...defaultProps}
        onToggleFavorite={vi.fn()}
        isFavorite={true}
      />
    )
    const svg = container.querySelector('.pin-icon-filled')
    expect(svg).toBeTruthy()
  })

  it('should show outline star SVG when not pinned', () => {
    const { container } = render(
      <ResultItem
        {...defaultProps}
        onToggleFavorite={vi.fn()}
        isFavorite={false}
      />
    )
    const svg = container.querySelector('.pin-icon-outline')
    expect(svg).toBeTruthy()
  })

  it('should not propagate click from pin button to result item', () => {
    const onClick = vi.fn()
    const onToggleFavorite = vi.fn()
    render(
      <ResultItem
        {...defaultProps}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
        isFavorite={false}
      />
    )
    fireEvent.click(screen.getByTitle('Pin to favorites'))
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
