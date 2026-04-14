import { useRef, useCallback } from 'react'

/**
 * Returns { onTouchStart, onTouchEnd } handlers to spread onto an element.
 * Distinguishes horizontal from vertical swipes by which axis dominates.
 *
 * threshold — minimum pixel distance before a gesture is recognised (default 40).
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 40,
} = {}) {
  const start = useRef(null)

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null

      const adx = Math.abs(dx)
      const ady = Math.abs(dy)

      if (adx >= ady) {
        // Horizontal dominates
        if (adx < threshold) return
        dx > 0 ? onSwipeRight?.() : onSwipeLeft?.()
      } else {
        // Vertical dominates
        if (ady < threshold) return
        // dy > 0 means finger moved down the screen (swipe-down gesture)
        dy > 0 ? onSwipeDown?.() : onSwipeUp?.()
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]
  )

  return { onTouchStart, onTouchEnd }
}
