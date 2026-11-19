import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export function useSlidingHighlight(selector: string | null, listVersion?: unknown, selection: unknown = selector) {
  const listRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; height: number } | null>(null)
  const [previous, setPrevious] = useState({ version: listVersion, selection, noAnimate: true })

  if (previous.version !== listVersion || previous.selection !== selection) {
    setPrevious({
      version: listVersion,
      selection,
      noAnimate: previous.version !== listVersion || previous.selection == null
    })
  }

  useLayoutEffect(() => {
    const list = listRef.current
    const row = selector ? list?.querySelector<HTMLElement>(selector) : null
    if (!list || !row) {
      setPosition(null)
      return
    }

    const measure = () => {
      const top = row.offsetTop
      const height = row.offsetHeight
      setPosition((current) => (current?.top === top && current.height === height ? current : { top, height }))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    observer.observe(row)
    return () => observer.disconnect()
  }, [selector, listVersion, selection])

  const highlightStyle: CSSProperties = position
    ? ({
        transform: `translateY(${position.top}px) scaleY(${position.height})`,
        '--uf-row-height': Math.max(1, position.height)
      } as CSSProperties)
    : { visibility: 'hidden' }

  return { listRef, highlightStyle, noAnimate: previous.noAnimate }
}
