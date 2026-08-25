/**
 * A cardiac trace, drawn the way the hospital's own monitors draw one.
 *
 * The waveform is not decorative squiggle — it is a real cycle, in order:
 * the P wave (atria contracting), the QRS complex (the ventricles, the big
 * spike), then the T wave (the ventricles resetting). A cardiologist glancing
 * at the site sees a normal sinus rhythm rather than a designer's impression
 * of one, and that is the difference between a site that looks medical and a
 * site somebody in medicine takes seriously.
 *
 * Every path command after the opening move is relative, so one cycle can
 * simply be repeated to make the strip — no transforms, no pattern element,
 * and no chance of a seam where two cycles meet.
 */
const CYCLE = 'h22c4-7 9-7 13 0h12l4 5 3-24 5 38 4-19h9c7-11 15-11 22 0h76'
const CYCLES = 6
const WIDTH = 200 * CYCLES

const PATH = `M0 30${CYCLE.repeat(CYCLES)}`

export default function Vitals({ className }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} 60`}
      preserveAspectRatio="none"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/*
        * Drawn twice. The lower copy is the persistent trace — the line that is
        * simply there, as on a monitor whose screen has not scrolled yet. The
        * upper copy is the sweep, brighter and dashed, running along the same
        * path. One line alone either flickers out of existence between cycles
        * or never appears to move.
        */}
      <path
        d={PATH}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".18"
      />
      <path
        d={PATH}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ecg-trace"
      />
    </svg>
  )
}
