import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  beforeEach(() => cleanup())

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
