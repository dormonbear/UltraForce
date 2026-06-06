import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import UpdateNotification from './UpdateNotification'

describe('UpdateNotification', () => {
  beforeEach(() => cleanup())

  it('renders the version and the static copy', () => {
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={vi.fn()} />)
    expect(screen.getByText('Updated to v0.2.5')).toBeTruthy()
    expect(screen.getByText('See what is new in this version')).toBeTruthy()
  })

  it('links Release Notes to the provided url, opening in a new tab safely', () => {
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={vi.fn()} />)
    const link = screen.getByText('Release Notes').closest('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://x/notes')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('fires onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<UpdateNotification version="0.2.5" releaseNotesUrl="https://x/notes" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTitle('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders exactly 20 firework particles', () => {
    const { container } = render(<UpdateNotification version="1.0.0" releaseNotesUrl="https://x" onDismiss={vi.fn()} />)
    expect(container.querySelectorAll('.firework-particle')).toHaveLength(20)
  })

  it('adds the "visible" class after the mount timer fires', async () => {
    const { container } = render(<UpdateNotification version="1.0.0" releaseNotesUrl="https://x" onDismiss={vi.fn()} />)
    await waitFor(() => {
      expect(container.querySelector('.update-celebration.visible')).toBeTruthy()
    })
  })
})
