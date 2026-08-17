/**
 * Packs hero/ into one self-contained HTML file.
 *
 *   npm i --no-save three@0.169.0 gsap@3.12.5
 *   node hero/build-standalone.mjs        → demo-dist/hero-artifact.html
 *
 * For anywhere the CDN is not an option: a published page, an email
 * attachment, a laptop with no network at a meeting. The hero itself keeps its
 * CDN links, which is the right thing for a real deploy — this is a second
 * output, not a replacement.
 *
 * Three.js is an ES module and cannot simply be pasted into a classic script,
 * so it is carried as base64, decoded at runtime and imported from a blob URL.
 * Base64 has the useful side effect that its source can never contain the
 * character sequence that would close the surrounding <script> early — the
 * failure that turns a bundle into a page of visible JavaScript.
 */
import fs from 'node:fs'
import path from 'node:path'

const here = import.meta.dirname
const OUT = path.join(here, '..', 'demo-dist', 'hero-artifact.html')

/**
 * Find a file inside node_modules by walking up from here.
 *
 * Deliberately not require.resolve: three's package.json declares an exports
 * map, and Node then refuses to resolve `three/build/three.module.js` even
 * though the file is sitting right there. Looking on disk asks the question we
 * actually mean — is this file present.
 */
const vendor = (relative) => {
  for (let dir = here; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', relative)
    if (fs.existsSync(candidate)) return candidate
    if (dir === path.dirname(dir)) break
  }
  console.error(`\n  Cannot find node_modules/${relative}.`)
  console.error('  Run:  npm i --no-save three@0.169.0 gsap@3.12.5\n')
  process.exit(1)
}

const read = (p) => fs.readFileSync(p, 'utf8')

const html = read(path.join(here, 'index.html'))
const css = read(path.join(here, 'styles.css'))
const app = read(path.join(here, 'script.js'))
const logo = fs.readFileSync(path.join(here, 'logo.png')).toString('base64')
const three = fs.readFileSync(vendor('three/build/three.module.js')).toString('base64')
const gsap = read(vendor('gsap/dist/gsap.min.js'))

/* Body content only: whatever renders this supplies the document around it. */
const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1]
if (!body) throw new Error('could not find <body> in hero/index.html')

const markup = body
  .replace(/<script type="module"[^>]*><\/script>/g, '')
  .replace('src="logo.png"', `src="data:image/png;base64,${logo}"`)

const appBody = app.replace(/^import \* as THREE from 'three'$/m, '')
if (appBody === app) {
  throw new Error('did not find the three import in script.js — has it been rewritten?')
}

const out = `<title>Deepan Hospital Hero</title>
<style>
${css}
</style>
${markup}
<script>${gsap.replace(/<\/script/gi, '<\\/script')}</script>
<script type="module">
  const bytes = Uint8Array.from(atob("${three}"), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
  const THREE = await import(url)
${appBody}
</script>
`

/*
 * Nothing may still be fetched. Checked on the markup only — the bundles are
 * full of URLs in strings and comments that are never requested.
 */
const leftover = out
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .match(/(?:src|href)="(?!data:|tel:|#|\/)[^"]+"/g)
if (leftover) throw new Error(`external references left: ${leftover.join(', ')}`)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out)
console.log(`\n  Wrote ${OUT} — ${(out.length / 1024 / 1024).toFixed(2)} MB\n`)
