import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchBarActions from './SearchBarActions'

afterEach(() => vi.restoreAllMocks())

it.each([
  ['en-US', 'History', 'Favorites', 'Settings'],
  ['zh-CN', '历史记录', '收藏', '设置']
])('labels the three actions in %s / 使用 %s 标注三个操作', (locale, history, favorites, settings) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([locale])
  render(<SearchBarActions activeSection={null} onToggleSection={vi.fn()} onSettings={vi.fn()} />)

  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(3)
  expect(buttons[0]).toHaveAccessibleName(history)
  expect(buttons[1]).toHaveAccessibleName(favorites)
  expect(buttons[2]).toHaveAccessibleName(settings)
})

it('toggles history and reflects the active section / 切换历史记录并显示当前选中的分区', () => {
  const onToggleSection = vi.fn()
  const onSettings = vi.fn()
  const { rerender } = render(
    <SearchBarActions activeSection="favorites" onToggleSection={onToggleSection} onSettings={onSettings} />
  )

  const history = screen.getByRole('button', { name: 'History', pressed: false })
  fireEvent.click(history)
  expect(onToggleSection).toHaveBeenCalledWith('history')
  expect(screen.getByRole('button', { name: 'Favorites', pressed: true })).toBeInTheDocument()

  rerender(<SearchBarActions activeSection="history" onToggleSection={onToggleSection} onSettings={onSettings} />)
  expect(history).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Favorites', pressed: false })).toBeInTheDocument()
})
