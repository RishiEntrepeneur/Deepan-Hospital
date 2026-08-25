import { useEffect, useRef } from 'react'
import { CAN_REVEAL, watchForReveal } from '../lib/reveal'

/**
 * Wraps a block so it settles into place when it is scrolled to.
 *
 * `delay` staggers members of a group — a row of four cards at 0/70/140/210ms
 * reads as one movement rather than four separate ones. Keep the steps small;
 * anything past about 90ms stops being a stagger and becomes a queue.
 *
 * The element is rendered already-hidden rather than hidden by a later effect,
 * which is what stops the flash of content appearing and then being taken
 * away. That is only safe because this app renders on the client — there is no
 * server-rendered HTML that could be left invisible if the script never runs —
 * and because `CAN_REVEAL` is false whenever the reveal could not happen.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className, children, ...rest }) {
  const ref = useRef(null)
  useEffect(() => watchForReveal(ref.current), [])

  return (
    <Tag
      ref={ref}
      data-reveal={CAN_REVEAL ? 'hidden' : 'shown'}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  )
}
