import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import HomeScreen from './HomeScreen'

vi.mock('~stores/history-store', () => {
  const items = [
    {
      id: 'apex-1',
      name: 'AccountService',
      type: 'ApexClass',
      url: '/lightning/setup/ApexClasses/page?address=%2F01p000000000001',
      visitCount: 5,
      lastVisitedAt: Date.now() - 60000,
      firstVisitedAt: Date.now() - 86400000
    },
    {
      id: 'flow-1',
      name: 'CreateCase',
      type: 'Flow',
      url: '/lightning/setup/Flows/page?address=%2F300000000000001',
      visitCount: 2,
      lastVisitedAt: Date.now() - 3600000,
      firstVisitedAt: Date.now() - 172800000
    }
  ]
  return {
    useHistoryStore: (selector: (s: { items: typeof items }) => unknown) =>
      selector({ items }),
    sortByFrecency: (arr: typeof items) => [...arr]
  }
})

vi.mock('~stores/favorites-store', () => {
  const items = [
    {
      id: 'fav-1',
      name: 'Account',
      type: 'CustomObject',
      url: '/lightning/setup/ObjectManager/Account/Details/view',
      pinnedAt: Date.now() - 3600000
    }
  ]
  return {
    useFavoritesStore: (selector: (s: { items: typeof items; isFavorite: (id: string) => boolean }) => unknown) =>
      selector({
        items,
        isFavorite: (id: string) => id === 'fav-1'
      })
  }
})

describe('HomeScreen', () => {
  const defaultProps = {
    onNavigate: vi.fn(),
    onToggleFavorite: vi.fn(),
    onRemoveHistoryItem: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render favorites section', () => {
    render(<HomeScreen {...defaultProps} />)
    expect(screen.getByText('Favorites')).toBeTruthy()
    expect(screen.getByText('Account')).toBeTruthy()
  })

  it('should render recent section', () => {
    render(<HomeScreen {...defaultProps} />)
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('AccountService')).toBeTruthy()
    expect(screen.getByText('CreateCase')).toBeTruthy()
  })

  it('should call onNavigate when clicking a favorite', () => {
    render(<HomeScreen {...defaultProps} />)
    fireEvent.click(screen.getByText('Account'))
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(
      '/lightning/setup/ObjectManager/Account/Details/view'
    )
  })

  it('should call onNavigate when clicking a recent item', () => {
    render(<HomeScreen {...defaultProps} />)
    fireEvent.click(screen.getByText('AccountService'))
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(
      '/lightning/setup/ApexClasses/page?address=%2F01p000000000001'
    )
  })

  it('should show visit count in title for history items', () => {
    render(<HomeScreen {...defaultProps} />)
    const item = screen.getByTitle(/AccountService.*visited 5x/)
    expect(item).toBeTruthy()
  })

  it('should display relative time for recent items', () => {
    render(<HomeScreen {...defaultProps} />)
    expect(screen.getByText('1m ago')).toBeTruthy()
  })

  it('should show type badges', () => {
    render(<HomeScreen {...defaultProps} />)
    expect(screen.getByText('O')).toBeTruthy()
    expect(screen.getByText('</>')).toBeTruthy()
    expect(screen.getByText('FL')).toBeTruthy()
  })
})

describe('HomeScreen empty state', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should render empty state when no items', async () => {
    vi.doMock('~stores/history-store', () => ({
      useHistoryStore: (selector: (s: { items: never[] }) => unknown) =>
        selector({ items: [] }),
      sortByFrecency: (arr: never[]) => arr
    }))

    vi.doMock('~stores/favorites-store', () => ({
      useFavoritesStore: (selector: (s: { items: never[]; isFavorite: () => boolean }) => unknown) =>
        selector({ items: [], isFavorite: () => false })
    }))

    const { default: HomeScreenEmpty } = await import('./HomeScreen')

    render(
      <HomeScreenEmpty
        onNavigate={vi.fn()}
        onToggleFavorite={vi.fn()}
        onRemoveHistoryItem={vi.fn()}
      />
    )

    expect(screen.getByText('Start searching')).toBeTruthy()
  })
})
