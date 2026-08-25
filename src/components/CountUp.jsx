import { useEffect, useRef, useState } from 'react'
import { CAN_REVEAL, watchForReveal } from '../lib/reveal'

/**
 * A number that counts up to itself when it is first scrolled into view.
 *
 * Three things keep this from being the gimmick it usually is:
 *
 *   1. **It starts at the real number.** If the animation cannot run — reduced
 *      motion, no IntersectionObserver, JavaScript half-loaded — the figure on
 *      screen is correct rather than zero. A hospital that says it has 0
 *      doctors for even a moment is worse than one that never animated.
 *   2. **It ends exactly on the value**, set directly rather than left to the
 *      last frame of an interpolation, so 24 never lands as 23.
 *   3. **It is short.** 900ms, ease-out. Long enough to catch the eye on the
 *      way past, over before anybody is waiting on it.
 *
 * The width does not jump as the digits change: `tabular-nums` is already set
 * on `[data-numeric]` in the base layer, which every caller here sits inside.
 */
export default function CountUp({ value, duration = 900 }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(CAN_REVEAL ? 0 : target)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !CAN_REVEAL) {
      setShown(target)
      return undefined
    }

    let frame = 0
    let start = 0
    const step = (now) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / duration)
      /* ease-out cubic: quick off the mark, settling rather than stopping. */
      const eased = 1 - (1 - p) ** 3
      setShown(p === 1 ? target : Math.round(target * eased))
      if (p < 1) frame = requestAnimationFrame(step)
    }

    /*
     * Reuses the page's single reveal observer rather than starting a private
     * one. `data-reveal` flipping to `shown` is the signal; a MutationObserver
     * is cheaper here than a second IntersectionObserver and keeps one
     * definition of "on screen" for the whole site.
     */
    const watcher = new MutationObserver(() => {
      if (el.dataset.reveal === 'shown') {
        watcher.disconnect()
        frame = requestAnimationFrame(step)
      }
    })
    watcher.observe(el, { attributes: true, attributeFilter: ['data-reveal'] })
    const unwatch = watchForReveal(el)

    return () => {
      watcher.disconnect()
      unwatch()
      cancelAnimationFrame(frame)
    }
  }, [target, duration])

  return (
    <span ref={ref} data-reveal={CAN_REVEAL ? 'hidden' : 'shown'}>
      {shown}
    </span>
  )
}
