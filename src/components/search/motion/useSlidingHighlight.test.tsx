import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useSlidingHighlight } from './useSlidingHighlight'

it('moves to the selected row and snaps when a new list resets selection / 高亮跟随选中项并在新列表重置选中时跳转', () => {
  function List({ selected, version }: { selected: number; version: string }) {
    const { listRef, highlightStyle, noAnimate } = useSlidingHighlight(
      selected < 0 ? null : `[data-row="${selected}"]`,
      version
    )
    return (
      <div ref={listRef}>
        <div data-testid="highlight" style={highlightStyle} data-snap={noAnimate} />
        {[0, 1].map((index) => (
          <div
            key={index}
            data-row={index}
            ref={(row) => {
              if (!row) return
              Object.defineProperties(row, {
                offsetTop: { configurable: true, value: 10 + index * 40 },
                offsetHeight: { configurable: true, value: 36 + index * 4 }
              })
            }}
          />
        ))}
      </div>
    )
  }

  const { getByTestId, rerender } = render(<List selected={0} version="first" />)
  const highlight = getByTestId('highlight')
  expect(highlight).toHaveStyle({ transform: 'translateY(10px) scaleY(36)' })
  rerender(<List selected={1} version="first" />)
  expect(highlight).toHaveStyle({ transform: 'translateY(50px) scaleY(40)' })
  expect(highlight).toHaveAttribute('data-snap', 'false')
  rerender(<List selected={0} version="second" />)
  expect(highlight).toHaveStyle({ transform: 'translateY(10px) scaleY(36)' })
  expect(highlight).toHaveAttribute('data-snap', 'true')
})
