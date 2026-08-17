/* =====================================================================
   Deepan Hospital — the opening, scrubbed by scroll
   =====================================================================

   One continuous shot behind five chapters. Scroll does not move the canvas;
   it moves what the canvas shows. That is the whole difference between this
   and a picture that scrolls past — the camera pushes in, a scattered cloud
   of points draws itself into an ordered lattice, a pulse runs through it,
   and the ground under the words turns from bone to the brand's deepest teal
   and back.

   The metaphor is the hospital's own: orthopaedics and joint work. Structure
   coming back together, not a generic globe of dots. Progress 0 is scattered
   and lit like a bright clinic; progress 1 is assembled, opened out, and back
   in daylight for the way in.

   Performance, because this runs on the phone of someone in pain:

     - Two draw calls for the structure. One Points for every node, one
       LineSegments for every strut.
     - Positions are lerped on the GPU-friendly path: a single typed array
       rewritten only when scroll actually moved, not every frame.
     - No post-processing, no shadows, no environment map.
     - Device pixel ratio capped at 2, and rendering stops when the tab hides.
   ===================================================================== */

import * as THREE from 'three'

const canvas = document.getElementById('stage')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Site palette, so the mesh belongs to the same hospital as the buttons. */
const TEAL = new THREE.Color('#0e6a5c')
const TEAL_LIGHT = new THREE.Color('#72b7ab')
const LEAF = new THREE.Color('#a6ce39')

/* ------------------------------------------------------------------ text */
function fillYears() {
  const now = new Date().getFullYear()
  for (const el of document.querySelectorAll('[data-years-since]')) {
    const from = Number(el.dataset.yearsSince)
    if (Number.isFinite(from)) el.textContent = String(now - from)
  }
}

/* -------------------------------------------------------------- geometry */
/** Even points on a sphere. Random spherical coordinates bunch at the poles. */
function fibonacciSphere(count, radius) {
  const points = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    points.push(
      new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(radius),
    )
  }
  return points
}

/* Deterministic pseudo-random, so every visitor sees the same opening. */
function seeded(i) {
  const x = Math.sin(i * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function buildWorld() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  /* Neutral, not ACES: filmic rolls whites towards grey, which on bone paper
     reads as a dirty screen rather than as cinema. */
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.LinearToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)

  const group = new THREE.Group()
  scene.add(group)

  const COUNT = 260
  const RADIUS = 3.4
  const ordered = fibonacciSphere(COUNT, RADIUS)

  /* Where each point starts: a loose, deep cloud with no structure to it. */
  const scattered = ordered.map((_, i) => {
    const a = seeded(i) * Math.PI * 2
    const b = Math.acos(seeded(i + 99) * 2 - 1)
    /* Tight enough that the first frame is already a form.
       An opening screen whose first paint is a scatter of dust looks broken
       for the second before it starts assembling, and that second is the one
       impression it gets. */
    const r = RADIUS * (1.12 + seeded(i + 7) * 0.85)
    return new THREE.Vector3(
      Math.sin(b) * Math.cos(a) * r,
      Math.sin(b) * Math.sin(a) * r * 0.6,
      Math.cos(b) * r,
    )
  })

  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 3)
  const nodeGeometry = new THREE.BufferGeometry()
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  nodeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const nodes = new THREE.Points(
    nodeGeometry,
    new THREE.PointsMaterial({
      size: 0.105,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  )
  group.add(nodes)

  /* Struts between neighbours in the assembled form. They fade in as the
     structure resolves, which is what makes assembly legible. */
  const pairs = []
  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      if (ordered[i].distanceTo(ordered[j]) < RADIUS * 0.42) pairs.push([i, j])
    }
  }
  const strutPositions = new Float32Array(pairs.length * 6)
  const strutGeometry = new THREE.BufferGeometry()
  strutGeometry.setAttribute('position', new THREE.BufferAttribute(strutPositions, 3))
  const strutMaterial = new THREE.LineBasicMaterial({
    color: TEAL,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  group.add(new THREE.LineSegments(strutGeometry, strutMaterial))

  /**
   * Rewrites every position and colour for a given scroll position.
   *
   * `t` is 0..1 across the whole page. Called only when scroll actually moved
   * — at 260 points and ~700 struts this is cheap, but not free, and running
   * it on a still page would burn a phone battery for nothing.
   */
  const setProgress = (t) => {
    /* Assembly finishes early, around a third of the way down, so chapters
       two onwards are read against a structure rather than a cloud. */
    const assembly = Math.min(1, t / 0.36)
    /* Starts part-formed rather than at zero, for the same reason the scatter
       is tight: the hero is a photograph before it is an animation. */
    const eased = 0.52 + 0.48 * assembly * assembly * (3 - 2 * assembly)

    /* The pulse: a band travelling up the structure through the middle
       chapters, the way a monitor trace crosses a screen. */
    const pulseY = -RADIUS + ((t - 0.32) / 0.5) * (RADIUS * 2.6)
    const pulsing = t > 0.3 && t < 0.86

    for (let i = 0; i < COUNT; i++) {
      const from = scattered[i]
      const to = ordered[i]
      /* Each point arrives at a slightly different moment, so the structure
         knits together instead of snapping. */
      const lag = 1 - seeded(i + 21) * 0.35
      const k = Math.min(1, eased / lag)

      const x = from.x + (to.x - from.x) * k
      const y = from.y + (to.y - from.y) * k
      const z = from.z + (to.z - from.z) * k
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      /* Teal at rest, lifting towards the logo's lime where the pulse is. */
      const base = k < 0.98 ? TEAL_LIGHT : TEAL
      let r = base.r
      let g = base.g
      let b = base.b
      if (pulsing) {
        const near = 1 - Math.min(1, Math.abs(y - pulseY) / 0.85)
        if (near > 0) {
          const lift = near * near
          r += (LEAF.r - r) * lift
          g += (LEAF.g - g) * lift
          b += (LEAF.b - b) * lift
        }
      }
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    nodeGeometry.attributes.position.needsUpdate = true
    nodeGeometry.attributes.color.needsUpdate = true

    for (let p = 0; p < pairs.length; p++) {
      const [i, j] = pairs[p]
      strutPositions[p * 6] = positions[i * 3]
      strutPositions[p * 6 + 1] = positions[i * 3 + 1]
      strutPositions[p * 6 + 2] = positions[i * 3 + 2]
      strutPositions[p * 6 + 3] = positions[j * 3]
      strutPositions[p * 6 + 4] = positions[j * 3 + 1]
      strutPositions[p * 6 + 5] = positions[j * 3 + 2]
    }
    strutGeometry.attributes.position.needsUpdate = true
    /* Struts stay faint until the structure is most of the way there, or the
       opening reads as a wireframe ball rather than as something forming. */
    strutMaterial.opacity = 0.34 * Math.max(0, (eased - 0.68) / 0.32)

    /* Camera: pushes in as it assembles, pulls back and lifts for the way in
       so the final chapter has air around it. */
    /* Framed, not floating: at rest the structure fills about two thirds of
       the height, which is what makes it read as a subject rather than as
       background noise scattered over the type. */
    const dolly = 11.5 - eased * 3.4 + Math.max(0, t - 0.78) * 9
    camera.position.set(0, t * 1.1 - 0.3, dolly)
    camera.lookAt(0, 0, 0)
  }

  return { renderer, scene, camera, group, setProgress }
}

/* -------------------------------------------------------------- run loop */
function run(world) {
  const { renderer, scene, camera, group, setProgress } = world

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    /* Pull the structure to one side on wide screens so it sits opposite the
       words; centre it on a phone, where the text has its own plate. */
    group.position.x = w > 860 ? 2.6 : 0
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })

  /* Scroll drives everything; the pointer only nudges. */
  let progress = 0
  let applied = -1
  const point = { x: 0, y: 0 }
  const eased = { x: 0, y: 0 }

  if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
    window.addEventListener(
      'pointermove',
      (e) => {
        point.x = (e.clientX / window.innerWidth) * 2 - 1
        point.y = (e.clientY / window.innerHeight) * 2 - 1
      },
      { passive: true },
    )
  }

  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
  }
  readScroll()
  window.addEventListener('scroll', readScroll, { passive: true })

  const clock = new THREE.Clock()
  let frame = 0

  const render = () => {
    frame = requestAnimationFrame(render)
    const dt = clock.getDelta()
    const t = clock.getElapsedTime()

    /* Only rebuild the geometry when the scroll position really changed. */
    if (Math.abs(progress - applied) > 0.0005) {
      setProgress(progress)
      applied = progress
    }

    if (!reduceMotion) {
      group.rotation.y = t * 0.09 + progress * Math.PI * 1.1
      const k = 1 - Math.pow(0.0015, dt)
      eased.x += (point.x - eased.x) * k
      eased.y += (point.y - eased.y) * k
      group.rotation.x = eased.y * 0.16 - 0.05
      group.rotation.z = eased.x * 0.06
    } else {
      group.rotation.y = progress * Math.PI
    }

    renderer.render(scene, camera)
  }
  render()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame)
    } else {
      clock.getDelta()
      render()
    }
  })
}

/* ------------------------------------------------------- chapters & tone */
/**
 * Chapter copy fading through, and the ground turning over beneath it.
 *
 * The dark stretch covers the two clinical chapters and ends before the way
 * in, so the page hands you back to daylight at the moment it asks you to do
 * something.
 */
function wireChapters() {
  const chapters = [...document.querySelectorAll('.chapter-inner')]

  if (reduceMotion || !window.gsap || !window.ScrollTrigger) {
    for (const el of chapters) el.style.opacity = '1'
    return
  }

  const { gsap, ScrollTrigger } = window
  gsap.registerPlugin(ScrollTrigger)

  for (const el of chapters) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el.parentElement,
          start: 'top 72%',
          end: 'bottom 40%',
          /* Tied to the scrollbar rather than played on entry — the chapters
             have to feel scrubbed, like the mesh behind them. */
          scrub: 0.6,
        },
      },
    )
  }

  /* The ground. Two chapters dark, then back to bone. */
  const dark = {
    '--ground': '#052b26',
    '--fg': '#f4f2ec',
    '--fg-soft': '#a8d4cc',
    '--fg-faint': '#72b7ab',
    '--hairline': 'rgba(114, 183, 171, 0.28)',
  }
  const light = {
    '--ground': '#faf9f6',
    '--fg': '#16130f',
    '--fg-soft': '#5b564c',
    '--fg-faint': '#706b5e',
    '--hairline': '#e7e3d9',
  }
  const applyVars = (vars) => {
    for (const [key, value] of Object.entries(vars)) document.body.style.setProperty(key, value)
  }

  ScrollTrigger.create({
    trigger: '[data-chapter="2"]',
    start: 'top 60%',
    endTrigger: '[data-chapter="5"]',
    end: 'top 65%',
    onToggle: ({ isActive }) => {
      applyVars(isActive ? dark : light)
      /* A flag rather than more variables: a handful of accents pick their
         own colour for the dark stretch, and CSS is the right place for that. */
      document.body.dataset.dark = String(isActive)
    },
  })
}

/* ------------------------------------------------------------------ boot */
fillYears()

if (canvas) {
  let supported = false
  try {
    supported = Boolean(
      document.createElement('canvas').getContext('webgl2') ||
        document.createElement('canvas').getContext('webgl'),
    )
  } catch {
    supported = false
  }

  if (supported) {
    try {
      run(buildWorld())
    } catch (error) {
      console.warn('[hero] 3D unavailable, continuing without it:', error)
      canvas.remove()
      document.body.dataset.webgl = 'off'
    }
  } else {
    canvas.remove()
    document.body.dataset.webgl = 'off'
  }
}

/* Wait for the faces, or the chapters animate in the fallback and reflow at
   the end — the one artefact that makes a considered opening look cheap. */
if (document.fonts?.ready) {
  document.fonts.ready.then(wireChapters)
} else {
  window.addEventListener('load', wireChapters)
}
