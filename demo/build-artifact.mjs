/**
 * Repackages the single-file demo as an Artifact page.
 *
 *   node demo/build-artifact.mjs   →  demo-dist/deepan-hospital-artifact.html
 *
 * An Artifact is served as body content inside a skeleton the host supplies, so
 * the demo's own <!doctype>, <html>, <head> and <body> tags have to come off.
 * Everything that lived in the head — the styles, the app bundle, the title —
 * is still valid where it lands, so the transform is a re-parenting rather than
 * a rewrite, and nothing about the app itself changes.
 *
 * Run after `npm run build:demo`; it reads that build's output.
 */
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(import.meta.dirname, '../demo-dist')
const source = path.join(dist, 'deepan-hospital-demo.html')
const target = path.join(dist, 'deepan-hospital-artifact.html')

const html = fs.readFileSync(source, 'utf8')

/*
 * Anchored on position, not on a search for the tags. The app bundle contains a
 * print-receipt template carrying its own "<head>" and "<body>" inside a
 * string, so counting occurrences or taking the first match lands inside the
 * JavaScript and silently produces a page that is half a receipt. The document's
 * own head is the one at the very start; its close is the last one in the file.
 */
const ROOT = '<div id="root"></div>'
const TAIL = `</head>\n  <body>\n    ${ROOT}\n  </body>\n</html>\n`

const open = html.indexOf('<head>')
if (open < 0 || open > 200) {
  throw new Error(`build-artifact: no document <head> near the start (found at ${open})`)
}
if (!html.endsWith(TAIL)) {
  throw new Error('build-artifact: the demo build no longer ends with the expected head/body tail')
}

const head = html.slice(open + '<head>'.length, html.length - TAIL.length)

/*
 * The host writes its own charset and viewport, so the demo's copies would be
 * ignored at best. The title is kept and hoisted: the publisher reads the first
 * 8 KB of the file for it, and the bundle is a megabyte.
 */
const title = '<title>Deepan Hospital</title>'
const body = head
  .replace(/<meta\b[^>]*>\s*/g, '')
  .replace(/<title>[\s\S]*?<\/title>\s*/g, '')
  .replace(/<link\b[^>]*>\s*/g, '')
  .trim()

/* A page that fetches anything is a page the Artifact CSP will break. The demo
   build already inlines its font stack, logo and API; this is the check that it
   stayed that way. */
const external = [...body.matchAll(/(?:src|href)\s*=\s*"(https?:|\/\/)/g)]
if (external.length > 0) {
  throw new Error(`build-artifact: ${external.length} external reference(s) — the CSP will block them`)
}

fs.writeFileSync(target, `${title}\n${body}\n${ROOT}\n`)

const kb = (fs.statSync(target).size / 1024).toFixed(0)
console.log(`demo-dist/deepan-hospital-artifact.html  ${kb} kB`)
