/**
 * The lattice behind the opening screen, drawn on a plain 2D canvas.
 *
 * Deliberately not Three.js. This scene is points and hairlines with no
 * lighting, no materials and no shadows, so the only thing a WebGL engine
 * would contribute is 1.3 MB — on the one screen every first-time visitor
 * downloads, over the patchy mobile data this hospital's patients actually
 * have. Projecting it by hand is about a hundred lines and draws the same
 * picture.
 *
 * What it shows: a scattered field of points drawing itself into an ordered
 * lattice as the reader scrolls, with a pulse running up through it. The
 * metaphor is the hospital's own — structure put back together, which is what
 * its orthopaedic and joint work does.
 */

/* The site's own tokens, so the mesh belongs to the same hospital as the type. */
const TEAL = [14, 106, 92]
const TEAL_LIGHT = [114, 183, 171]
const LEAF = [166, 206, 57]

const RADIUS = 1
const COUNT = 230
/** Perspective distance. Larger flattens; this is a gentle lens, not a fisheye. */
const FOCAL = 3.1

/* Deterministic, so every visitor sees the same opening rather than a different
   scatter each reload — a hero that reshuffles reads as noise, not as design. */
const seeded = (i) => {
  const x = Math.sin(i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Even points on a sphere; random spherical coordinates bunch at the poles. */
function orderedPoints() {
  const points = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    points.push([Math.cos(theta) * ring * RADIUS, y * RADIUS, Math.sin(theta) * ring * RADIUS])
  }
  return points
}

/** Where each point waits before the structure resolves. */
function scatteredPoints() {
  const points = []
  for (let i = 0; i < COUNT; i++) {
    const a = seeded(i) * Math.PI * 2
    const b = Math.acos(seeded(i + 99) * 2 - 1)
    /* Tight enough that the first paint is already a form. An opening whose
       first frame is a field of dust looks broken for the one second it gets. */
    const r = RADIUS * (1.12 + seeded(i + 7) * 0.85)
    points.push([
      Math.sin(b) * Math.cos(a) * r,
      Math.sin(b) * Math.sin(a) * r * 0.62,
      Math.cos(b) * r,
    ])
  }
  return points
}

/** Neighbour pairs in the assembled form — the struts. */
function strutPairs(ordered) {
  const pairs = []
  const limit = RADIUS * 0.42
  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      const dx = ordered[i][0] - ordered[j][0]
      const dy = ordered[i][1] - ordered[j][1]
      const dz = ordered[i][2] - ordered[j][2]
      if (Math.hypot(dx, dy, dz) < limit) pairs.push([i, j])
    }
  }
  return pairs
}

/**
 * Creates the scene. Returns `{ draw, dispose }`.
 *
 * `draw(progress, time, pointer)` renders one frame:
 *   progress  0..1 across the whole opening — how far the reader has scrolled
 *   time      seconds, for the ambient drift
 *   pointer   { x, y } in -1..1, for the tilt
 */
export function createOpeningScene(canvas) {
  const context = canvas.getContext('2d')
  if (!context) return null

  const ordered = orderedPoints()
  const scattered = scatteredPoints()
  const pairs = strutPairs(ordered)
  const projected = new Array(COUNT)

  let width = 0
  let height = 0
  let scale = 1

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    /* Sized against both edges: off the height alone it runs off the side of a
       wide window, off the width alone it swallows a phone. */
    scale = Math.min(width * 0.34, height * 0.44)
  }
  resize()

  const draw = (progress, time, pointer) => {
    context.clearRect(0, 0, width, height)

    /* Assembly completes about a third of the way down, so the later chapters
       are read against a structure rather than a cloud. It starts part-formed
       for the same reason the scatter is tight. */
    const raw = Math.min(1, progress / 0.36)
    const assembly = 0.52 + 0.48 * raw * raw * (3 - 2 * raw)

    const spin = time * 0.09 + progress * Math.PI * 1.1
    const tilt = pointer.y * 0.16 - 0.05
    const cosY = Math.cos(spin)
    const sinY = Math.sin(spin)
    const cosX = Math.cos(tilt)
    const sinX = Math.sin(tilt)

    /*
     * Camera pushes in as it assembles, then pulls well back for the closing
     * chapter. The retreat has to be decisive: that chapter carries the two
     * buttons and the line about not needing an account, and a lattice still
     * filling the frame draws hairlines straight through them.
     */
    const raw2 = Math.min(1, Math.max(0, (progress - 0.7) / 0.22))
    const retreat = raw2 * raw2 * (3 - 2 * raw2)
    const dolly = 3.05 - assembly * 0.55 + retreat * 4.6
    const centreX = width > 860 ? width * 0.7 : width * 0.5
    const centreY = height * (0.5 + progress * 0.06)

    /* The pulse: a band travelling up the structure through the middle
       chapters, the way a monitor trace crosses a screen. */
    const pulseY = -RADIUS + ((progress - 0.32) / 0.5) * (RADIUS * 2.6)
    const pulsing = progress > 0.3 && progress < 0.86

    for (let i = 0; i < COUNT; i++) {
      const from = scattered[i]
      const to = ordered[i]
      /* Each point arrives slightly late, so the structure knits together
         instead of snapping into place. */
      const k = Math.min(1, assembly / (1 - seeded(i + 21) * 0.35))

      const x = from[0] + (to[0] - from[0]) * k
      const y = from[1] + (to[1] - from[1]) * k
      const z = from[2] + (to[2] - from[2]) * k

      /* Rotate Y, then X. */
      const rx = x * cosY + z * sinY
      const rz = z * cosY - x * sinY
      const ry = y * cosX - rz * sinX
      const rzz = rz * cosX + y * sinX

      const depth = FOCAL / (FOCAL + rzz + dolly - 3.05)
      const sx = centreX + rx * scale * depth + pointer.x * 14
      const sy = centreY - ry * scale * depth

      let tint = k < 0.98 ? TEAL_LIGHT : TEAL
      if (pulsing) {
        const near = 1 - Math.min(1, Math.abs(y - pulseY) / 0.26)
        if (near > 0) {
          const lift = near * near
          tint = [
            tint[0] + (LEAF[0] - tint[0]) * lift,
            tint[1] + (LEAF[1] - tint[1]) * lift,
            tint[2] + (LEAF[2] - tint[2]) * lift,
          ]
        }
      }
      projected[i] = { x: sx, y: sy, depth, tint }
    }

    /* Struts first, so nodes sit on top of them. Held back until the structure
       is nearly resolved — drawn earlier they cross everything and read as
       spaghetti rather than as a frame coming together. */
    const strutAlpha = 0.34 * Math.max(0, (assembly - 0.68) / 0.32) * (1 - retreat * 0.6)
    if (strutAlpha > 0.004) {
      context.lineWidth = 1
      context.strokeStyle = `rgba(14, 106, 92, ${strutAlpha})`
      context.beginPath()
      for (const [i, j] of pairs) {
        context.moveTo(projected[i].x, projected[i].y)
        context.lineTo(projected[j].x, projected[j].y)
      }
      /* One path for ~700 struts: stroking each separately is what makes a
         canvas of this size drop frames on a phone. */
      context.stroke()
    }

    for (const point of projected) {
      const size = Math.max(1, 3.1 * point.depth)
      context.fillStyle = `rgb(${point.tint[0] | 0}, ${point.tint[1] | 0}, ${point.tint[2] | 0})`
      context.globalAlpha = Math.min(1, 0.35 + point.depth * 0.75)
      context.beginPath()
      context.arc(point.x, point.y, size, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
  }

  return { draw, resize }
}
