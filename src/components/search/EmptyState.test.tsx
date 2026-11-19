import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  beforeEach(() => cleanup())

  it.each([
    ['en-US', 'Flows', 'No Flows found for "123421"', 'No results for "123421"'],
    ['zh-CN', '流程', '在 流程 中没有找到 "123421"', '未找到“123421”的结果']
  ])('localizes empty searches in %s / 本地化空结果提示', (locale, scope, scoped, plain) => {
    const languages = vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
    try {
      const { rerender } = render(<EmptyState type="empty" query="123421" scope={scope} />)
      expect(screen.getByText(scoped)).toBeInTheDocument()
      rerender(<EmptyState type="empty" query="123421" />)
      expect(screen.getByText(plain)).toBeInTheDocument()
    } finally {
      languages.mockRestore()
    }
  })

  it('announces the loading state via a polite live region', () => {
    render(<EmptyState type="loading" />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Searching...')).toBeTruthy()
  })

  it('announces the error state via an alert live region', () => {
    render(<EmptyState type="error" errorMessage="Connection failed" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(screen.getByText('Connection failed')).toBeTruthy()
  })
})
