import { useLayoutEffect, useRef, useState } from 'react'

export function useAnimatedHeight() {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner || typeof ResizeObserver === 'undefined') return

    const measure = () => setHeight(inner.offsetHeight)
    const observer = new ResizeObserver(measure)
    measure()
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  return { innerRef, height }
}
