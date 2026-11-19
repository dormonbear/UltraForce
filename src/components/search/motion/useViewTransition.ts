import { useLayoutEffect, useState, type ReactNode } from 'react'
import { getExitDuration } from './motionPreferences'

type View = 'search' | 'picker' | 'settings'

interface Frame {
  view: View
  content: ReactNode
  outgoing: { view: View; content: ReactNode } | null
  direction: number
  duration: number
}

export function useViewTransition(view: View, content: ReactNode) {
  const [frame, setFrame] = useState<Frame>({ view, content, outgoing: null, direction: 0, duration: 0 })
  const { outgoing, duration } = frame

  if (view !== frame.view) {
    const duration = getExitDuration()
    setFrame({
      view,
      content,
      outgoing: duration ? { view: frame.view, content: frame.content } : null,
      direction: view === 'search' ? -1 : 1,
      duration
    })
  } else if (content !== frame.content) {
    setFrame({ ...frame, content })
  }

  useLayoutEffect(() => {
    if (!outgoing) return
    const timer = setTimeout(() => setFrame((current) => ({ ...current, outgoing: null })), duration)
    return () => clearTimeout(timer)
  }, [outgoing, duration])

  return frame
}
