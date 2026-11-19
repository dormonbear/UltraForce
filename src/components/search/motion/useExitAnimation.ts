import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { getExitDuration } from './motionPreferences'

export interface ExitAnimationControl {
  close: () => Promise<void>
  cancel: () => boolean
}

interface PendingExit {
  timer: ReturnType<typeof setTimeout>
  done: Promise<void>
  resolve: () => void
}

export function useExitAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const pending = useRef<PendingExit | null>(null)
  const finish = useRef(onClose)

  useLayoutEffect(() => {
    finish.current = onClose
  }, [onClose])

  const clearPending = useCallback(() => {
    const exit = pending.current
    if (!exit) return false
    pending.current = null
    clearTimeout(exit.timer)
    exit.resolve()
    return true
  }, [])

  useLayoutEffect(() => {
    return () => void clearPending()
  }, [clearPending])

  const cancel = useCallback(() => {
    if (!clearPending()) return false
    setClosing(false)
    return true
  }, [clearPending])

  const close = useCallback(() => {
    if (pending.current) return pending.current.done
    const duration = getExitDuration()
    if (!duration) {
      finish.current()
      return Promise.resolve()
    }

    let resolve = () => {}
    const done = new Promise<void>((complete) => {
      resolve = complete
    })
    const timer = setTimeout(() => {
      pending.current = null
      setClosing(false)
      try {
        finish.current()
      } finally {
        resolve()
      }
    }, duration)
    pending.current = { timer, done, resolve }
    setClosing(true)
    return done
  }, [])

  return { closing, close, cancel }
}
