/* =====================================================================
   Deepan Hospital — hero: 3D lattice + entry sequence
   =====================================================================

   The 3D metaphor is a trabecular lattice: the strut-and-node structure of
   the inside of a bone. It was chosen over a DNA helix because this hospital
   leads with orthopaedics and joint replacement, and a helix says "genetics"
   to anyone who reads it at all. A lattice says load, structure, repair.

   Three constraints shaped the implementation more than the look did:

     1. **It must not be the reason the page is slow.** One InstancedMesh for
        every node and one LineSegments for every strut means two draw calls
        for the whole structure. There is no post-processing, no shadow map
        and no environment map: on a mid-range Android those are what cost
        frames, and none of them earns its place here.

     2. **It must not be the reason the page is unreadable.** Everything the
        canvas says is said in the text beside it, the canvas is aria-hidden,
        and if WebGL is missing or reduced motion is requested the page is
        complete without it.

     3. **Clean light, not cinematic light.** Neutral tone mapping, sRGB out.
        ACES filmic — the usual default — rolls off highlights and pushes
        whites grey, which on a clinical near-white page reads as dirty.
   ===================================================================== */

import * as THREE from 'three'

const canvas = document.getElementById('lattice')
const visual = document.querySelector('.hero-visual')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------------ text */
/*
 * Years of service, counted rather than typed.
 *
 * The brief said "over 35 years"; the hospital was founded in 1986, which is
 * 40. Both are true, but the rest of the site prints the computed figure, and
 * a hero that disagrees with the page below it is the kind of small wrongness
 * people notice. Counting it here means it can never go stale or disagree.
 */
function fillYears() {
  const now = new Date().getFullYear()
  for (const el of document.querySelectorAll('[data-years-since]')) {
    const from = Number(el.dataset.yearsSince)
    if (Number.isFinite(from)) el.textContent = String(now - from)
  }
}

/* ---------------------------------------------------------------- lattice */
/**
 * Points spread evenly over a sphere by the Fibonacci method, which gives a
 * far more even scatter than random spherical coordinates — those bunch at
 * the poles and read as a mistake.
 */
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

/** Every pair closer than `maxDistance`, as a flat position array for lines. */
function strutsBetween(points, maxDistance) {
  const positions = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[i].distanceTo(points[j]) > maxDistance) continue
      positions.push(points[i].x, points[i].y, points[i].z)
      positions.push(points[j].x, points[j].y, points[j].z)
    }
  }
  return new Float32Array(positions)
}

function buildScene() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })

  /*
   * Capped at 2. Above that the pixel count doubles again for a difference
   * nobody can see, and a 3x phone screen is exactly the device least able to
   * afford it.
   */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.LinearToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0, 0, 9.2)

  /* A key light, a cool fill from below, and a soft ambient. Three lights,
     no shadows: enough to model a sphere, nothing that costs a pass. */
  scene.add(new THREE.AmbientLight(0xffffff, 1.15))
  const key = new THREE.DirectionalLight(0xffffff, 2.1)
  key.position.set(4, 6, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x7dd3fc, 1.1)
  fill.position.set(-5, -3, 2)
  scene.add(fill)

  /* The structure rides in a group so parallax can tilt the whole thing
     without touching the camera, which would also move the glow behind it. */
  const structure = new THREE.Group()
  scene.add(structure)

  const RADIUS = 3.1
  const nodes = fibonacciSphere(78, RADIUS)

  /* Nodes — one instanced draw call for all of them. */
  const nodeGeometry = new THREE.IcosahedronGeometry(0.1, 1)
  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.28,
    metalness: 0.08,
  })
  const instances = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodes.length)
  const dummy = new THREE.Object3D()
  nodes.forEach((point, i) => {
    dummy.position.copy(point)
    /* A little size variety, or it reads as a manufactured ball rather than
       a grown structure. Deterministic so every load looks the same. */
    const scale = 0.75 + ((i * 37) % 11) / 22
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    instances.setMatrixAt(i, dummy.matrix)
  })
  instances.instanceMatrix.needsUpdate = true
  structure.add(instances)

  /* Struts — one LineSegments for the lot. */
  const strutGeometry = new THREE.BufferGeometry()
  strutGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(strutsBetween(nodes, RADIUS * 0.62), 3),
  )
  structure.add(
    new THREE.LineSegments(
      strutGeometry,
      new THREE.LineBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.34 }),
    ),
  )

  /* A slow field of motes, for depth. Points, so it is one more draw call. */
  const moteCount = 140
  const motePositions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    /* Deterministic scatter in a shell outside the lattice. */
    const a = i * 2.399
    const r = RADIUS * 1.35 + ((i * 17) % 23) / 12
    motePositions[i * 3] = Math.cos(a) * r
    motePositions[i * 3 + 1] = ((i * 13) % 41) / 5 - 4
    motePositions[i * 3 + 2] = Math.sin(a) * r
  }
  const moteGeometry = new THREE.BufferGeometry()
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.055,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    }),
  )
  scene.add(motes)

  return { renderer, scene, camera, structure, motes }
}

/* -------------------------------------------------------------- run loop */
function start(world) {
  const { renderer, scene, camera, structure, motes } = world

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = visual
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  /* ResizeObserver rather than window.resize: the column changes size when the
     layout reflows, which a window listener never hears about. */
  new ResizeObserver(resize).observe(visual)

  /* Parallax target, in -1..1. Pointer only — a device that reports coarse
     touch has no hover, and reading deviceorientation would mean asking a
     patient for a permission prompt to tilt a decoration. */
  const target = { x: 0, y: 0 }
  const current = { x: 0, y: 0 }
  if (window.matchMedia('(hover: hover)').matches && !reduceMotion) {
    window.addEventListener(
      'pointermove',
      (event) => {
        target.x = (event.clientX / window.innerWidth) * 2 - 1
        target.y = (event.clientY / window.innerHeight) * 2 - 1
      },
      { passive: true },
    )
  }

  const clock = new THREE.Clock()
  let frame = 0

  const render = () => {
    frame = requestAnimationFrame(render)
    const t = clock.getElapsedTime()

    if (!reduceMotion) {
      /* Ambient self-rotation: slow enough to be noticed only if you look. */
      structure.rotation.y = t * 0.14
      structure.rotation.x = Math.sin(t * 0.22) * 0.06
      motes.rotation.y = -t * 0.05

      /*
       * Parallax eased towards the pointer rather than tracking it. A mesh
       * that snaps to the cursor feels like a toy; a fifteenth of the distance
       * per frame feels like weight. Framerate-independent so it behaves the
       * same at 60 and 120Hz.
       */
      const ease = 1 - Math.pow(0.001, clock.getDelta())
      current.x += (target.x - current.x) * ease
      current.y += (target.y - current.y) * ease
      structure.rotation.y += current.x * 0.28
      structure.rotation.x += current.y * 0.2
      structure.position.x = current.x * 0.24
      structure.position.y = -current.y * 0.18
    }

    renderer.render(scene, camera)
  }
  render()

  /* Stop entirely when the tab is hidden — a background tab spinning a GPU is
     a battery complaint waiting to happen. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame)
    } else {
      clock.getDelta() /* discard the gap, or the ease jumps on return */
      render()
    }
  })
}

/* --------------------------------------------------------------- entrance */
/**
 * The load sequence: the canvas unfurls, then the words rise under it.
 *
 * Runs only after fonts are ready. Animating text before its webfont lands
 * means the fade-up plays in the fallback face and everything reflows at the
 * end — the one artefact that makes a considered entrance look cheap.
 */
function playEntrance() {
  const targets = (name) => document.querySelectorAll(`[data-animate="${name}"]`)

  if (reduceMotion || typeof window.gsap === 'undefined') {
    /* No animation: make sure nothing is left in its pre-animation state. */
    for (const el of document.querySelectorAll('[data-animate]')) {
      el.style.opacity = '1'
      el.style.transform = 'none'
    }
    return
  }

  const tl = window.gsap.timeline({ defaults: { ease: 'power3.out' } })

  tl.fromTo(
    targets('canvas'),
    { opacity: 0, scale: 0.88, rotate: -4 },
    { opacity: 1, scale: 1, rotate: 0, duration: 1.25, ease: 'power2.out' },
  )
    .fromTo(targets('header'), { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.6 }, 0.1)
    .fromTo(
      [...targets('badge'), ...targets('headline'), ...targets('subhead'), ...targets('cta')],
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.09 },
      /* Overlaps the canvas rather than waiting for it: the brief asked for
         "followed immediately", and a hero that makes you wait 1.2s for a
         headline has spent its budget on the wrong thing. */
      0.35,
    )
    .fromTo(targets('stats'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.25')
}

/* ------------------------------------------------------------------ boot */
fillYears()

if (canvas) {
  /* A context test rather than a feature sniff: some devices expose WebGL and
     then refuse to give you a context. */
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
      start(buildScene())
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

/* document.fonts is everywhere current, but the page must still open on a
   browser without it rather than never animating. */
if (document.fonts?.ready) {
  document.fonts.ready.then(playEntrance)
} else {
  window.addEventListener('load', playEntrance)
}
