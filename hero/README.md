# Opening screen — plain HTML, CSS and JavaScript

A scroll-driven opening for Deepan Hospital, in the patient site's own palette
and faces. No build step, no framework: open `index.html` and it runs.

```
hero/
├── index.html            five chapters and the accreditation switch
├── styles.css            the site's tokens, chapter layout, dark stretch
├── script.js             the scrubbed 3D, chapter tweens, ground change
├── build-standalone.mjs  packs it into one file (see below)
└── logo.png              the hospital's lockup
```

Serve it rather than opening the file directly — `script.js` is an ES module,
and browsers refuse modules over `file://`:

```bash
cd hero && python3 -m http.server 8080     # → http://localhost:8080
```

## How it works

Scroll does not move the canvas; it moves what the canvas shows. The canvas is
fixed behind five chapters and the page's scroll position drives everything on
it, so a reader gets one continuous shot rather than five slides:

| Scroll | What happens |
| --- | --- |
| 0 | A loose field of points, headline on bone |
| →0.36 | The field draws itself into a lattice; struts fade in as it resolves |
| 0.3–0.86 | A pulse runs up through the structure, the way a monitor trace crosses a screen |
| 0.2–0.9 | The ground sinks to the brand's deepest teal for the clinical chapters |
| →1 | Camera pulls back, daylight returns, and the last chapter is the way into the site |

The last chapter links to `../index.html` — this screen is the front door, not
a separate place. Everything past it is the patient app.

Colour changes with the story rather than for decoration: the dark stretch
covers "someone is awake at 3am", and the page hands you back to daylight at
the moment it asks you to book.

## Two things to check before this goes live

**1. The NABH badge is switched off.** Accreditation is a checkable credential
with a certificate number and an expiry date, and a hospital claiming one it
does not hold is a misrepresentation — not a typo. Nothing anywhere else in
this project mentions NABH; the glossary defines NABL, which is a *laboratory*
accreditation and a different thing entirely.

Confirm the hospital's current certificate on the
[NABH register](https://nabh.co/frmViewAccreditedHosp.aspx), then turn it on:

```html
<body data-accredited="true">
```

If it does not apply, delete the `<p class="badge">` block.

**2. The years count themselves.** The brief said "over 35 years"; the hospital
was founded in 1986, which is 40. Both are true, but the rest of the site
prints the computed figure and a hero that disagrees with the page below it
reads as carelessness. `data-years-since="1986"` is filled in at load, so it
cannot go stale or drift. Change the year, not the number.

The other two counts — 18 doctors, 11 departments — are typed in, because this
file has no API to ask. They match the seeded roster as of writing. If the
roster changes, change them here, or fetch `/api/catalog` and fill them the
same way the years are filled.

## The 3D element

A trabecular lattice: the strut-and-node structure inside a bone. Chosen over a
DNA helix because this hospital leads with orthopaedics and joint replacement,
and a helix says "genetics" to anyone who reads it at all.

- **Two draw calls** for the whole structure — one `InstancedMesh` for 78
  nodes, one `LineSegments` for every strut — plus one for the motes. No
  post-processing, no shadow maps, no environment map: on a mid-range Android
  those are what cost frames.
- **Neutral tone mapping**, sRGB out. ACES filmic is the usual default and it
  rolls whites towards grey, which on a clinical near-white page reads as dirty.
- **Device pixel ratio capped at 2.** Above that the pixel count doubles again
  for a difference nobody can see, on the devices least able to afford it.
- **Rendering stops when the tab is hidden.**

## What happens when things are missing

| Condition | Behaviour |
| --- | --- |
| No WebGL | Canvas removed, `data-webgl="off"` on `<body>`, layout still complete |
| `prefers-reduced-motion` | No entry animation, no rotation, no parallax — mesh renders still |
| GSAP fails to load | Content is shown immediately in its final state, not left invisible |
| `logo.png` missing | Falls back to the typed hospital name |
| Touch device | No pointer parallax; ambient rotation only |

That fourth row is the one worth keeping. An entry animation that hides content
until a CDN answers is an entry animation that can hide content forever.

## Dependencies

Three.js and GSAP load from unpkg, pinned to exact versions — a hero that
silently restyles itself when a CDN ships a major release is not something a
hospital should find out about from a patient. To self-host instead, drop both
files in `hero/vendor/` and point the import map and the `<script>` at them.
Nothing else changes.

## One file, no network

For anywhere the CDN is not an option — a page you publish, an attachment, a
laptop with no signal at a meeting:

```bash
npm i --no-save three@0.169.0 gsap@3.12.5
node hero/build-standalone.mjs        # → demo-dist/hero-artifact.html
```

That writes a single HTML file with both libraries and the logo inside it. The
hero here keeps its CDN links; this is a second output, not a replacement.
