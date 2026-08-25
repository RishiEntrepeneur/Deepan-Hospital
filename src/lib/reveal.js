/**
 * Content that arrives as you scroll to it.
 *
 * The effect everybody notices on an expensive site and nobody can name: a
 * section is not simply *there* when you reach it, it settles into place. Done
 * badly it is a page that withholds its own content; the rules that keep it on
 * the right side of that line are:
 *
 *   - **It never gates content on JavaScript.** If IntersectionObserver is
 *     missing — and this hospital's patients open the site on Android phones
 *     old enough for that to be real — nothing is ever hidden in the first
 *     place. The failure mode is "no animation", never "no page".
 *   - **Reduced motion turns it off entirely**, at the source rather than in a
 *     media query that has to remember to cover every case.
 *   - **Once only.** Elements that re-animate every time they scroll past are
 *     the reason people disable animation.
 *   - **Short and shallow**: 16px and 0.7s. Far enough to notice, not so far
 *     that a fast scroller sees a page assembling itself beneath them.
 *
 * Decided once, at module load, rather than per element — thirty cards each
 * asking the browser to re-evaluate a media query is thirty answers to the
 * same question.
 */
export const CAN_REVEAL =
  typeof window !== 'undefined' &&
  typeof IntersectionObserver !== 'undefined' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/*
 * One observer for the whole page, not one per element. Each additional
 * observer is its own callback and its own bookkeeping in the browser, and a
 * page of cards would otherwise create dozens of them to answer the same
 * question about the same viewport.
 */
let observer = null

const ensureObserver = () => {
  if (observer || !CAN_REVEAL) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.dataset.reveal = 'shown'
        observer.unobserve(entry.target)
      }
    },
    /* A little before the edge, so it has finished by the time it is read. */
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  )
  return observer
}

/** Watch one element. Returns the matching unwatch, for effect cleanup. */
export function watchForReveal(el) {
  if (!el || !CAN_REVEAL) return () => {}
  const io = ensureObserver()
  io.observe(el)
  return () => io.unobserve(el)
}
