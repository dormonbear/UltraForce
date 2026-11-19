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

  it('renders a heading, keycaps, descriptions, and row indices / 渲染标题、键帽、描述和行索引', () => {
    const commands = [builtin('o', 'Objects'), builtin('c', 'Classes')]
    render(<CommandHints commands={commands} />)

    expect(screen.getByRole('heading', { name: 'Commands' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('kbd')).toHaveTextContent(':o')
    expect(rows[0]).toHaveTextContent('Objects')
    expect(rows[0]).toHaveStyle('--i: 0')
    expect(rows[1].querySelector('kbd')).toHaveTextContent(':c')
    expect(rows[1]).toHaveTextContent('Classes')
    expect(rows[1]).toHaveStyle('--i: 1')
  })

  it('highlights the matching token prefix and keeps existing rows / 高亮匹配的指令前缀并保留已有行', () => {
    const commands = [builtin('a', 'Apex'), builtin('obj', 'Objects'), builtin('c', 'Other classes')]
    const { rerender } = render(<CommandHints commands={commands} prefix=":" />)
    const row = screen.getAllByRole('listitem')[1]
    expect(row.querySelector('.command-key-match')).toHaveTextContent(':')

    rerender(<CommandHints commands={commands.slice(1)} prefix=":OB" />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toBe(row)
    expect(row.querySelector('.command-key-match')).toHaveTextContent(':ob')
    expect(row.querySelector('kbd')).toHaveTextContent(':obj')
    expect(rows[1].querySelector('.command-key-match')).toBeNull()
  })

  it('renders a single command', () => {
    const { container } = render(<CommandHints commands={[builtin('f', 'Flows')]} />)
    expect(container.querySelectorAll('.command-hint-tag')).toHaveLength(1)
    expect(screen.getByText(':f')).toBeTruthy()
    expect(screen.getByText('Flows')).toBeTruthy()
  })
})
