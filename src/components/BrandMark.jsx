/**
 * The Deepan Hospital leaf mark, redrawn as vector.
 *
 * A fan of six blades springing from a single point at the lower left and
 * sweeping up to the right, running deep teal → green → lime, with the
 * brightest blade at the top. Each blade carries its own colour rather than
 * sharing one gradient, which is what gives the original its stepped look.
 *
 * This is a replica, not the artwork. The moment `public/logo.png` exists,
 * Logo.jsx uses that instead and this is never rendered — so if the hospital's
 * real file turns up, nothing here needs changing.
 */

/* Sampled from the supplied artwork, darkest first. */
const BLADES = [
  { fill: '#0d6152', rotate: -52, scale: 0.72 },
  { fill: '#137a5f', rotate: -34, scale: 0.85 },
  { fill: '#2b9260', rotate: -16, scale: 0.96 },
  { fill: '#57a94b', rotate: 2, scale: 1 },
  { fill: '#84c13f', rotate: 20, scale: 0.94 },
  { fill: '#a9d139', rotate: 38, scale: 0.82 },
]

/*
 * One blade: a long teardrop, pointed at the root, widest around two-thirds
 * out, tapering to a soft tip. Drawn once and reused at six angles.
 */
const BLADE = 'M32 58 C 30 44, 31 28, 40 12 C 47 26, 46 44, 32 58 Z'

export default function BrandMark({ className, title }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {/* Rotated about the root so every blade springs from the same point. */}
      <g transform="translate(0 2)">
        {BLADES.map((blade) => (
          <path
            key={blade.rotate}
            d={BLADE}
            fill={blade.fill}
            transform={`rotate(${blade.rotate} 32 58) translate(32 58) scale(${blade.scale}) translate(-32 -58)`}
          />
        ))}
      </g>
    </svg>
  )
}
