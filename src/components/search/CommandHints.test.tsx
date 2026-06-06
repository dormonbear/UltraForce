import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { SearchCommand } from '~types'
import CommandHints from './CommandHints'

const builtin = (key: string, description: string): SearchCommand => ({
  key,
  description,
  types: [],
  isBuiltin: true
})

describe('CommandHints', () => {
  beforeEach(() => cleanup())

  it('renders nothing when there are no commands', () => {
    const { container } = render(<CommandHints commands={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a tag for each command with key prefixed by a colon', () => {
    const commands = [builtin('o', 'Objects'), builtin('c', 'Classes')]
    const { container } = render(<CommandHints commands={commands} />)

    expect(container.querySelector('.command-hints')).toBeTruthy()
    expect(container.querySelectorAll('.command-hint-tag')).toHaveLength(2)
    expect(screen.getByText(':o')).toBeTruthy()
    expect(screen.getByText(':c')).toBeTruthy()
    expect(screen.getByText('Objects')).toBeTruthy()
    expect(screen.getByText('Classes')).toBeTruthy()
  })

  it('renders a single command', () => {
    const { container } = render(<CommandHints commands={[builtin('f', 'Flows')]} />)
    expect(container.querySelectorAll('.command-hint-tag')).toHaveLength(1)
    expect(screen.getByText(':f')).toBeTruthy()
    expect(screen.getByText('Flows')).toBeTruthy()
  })
})
