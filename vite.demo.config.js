import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Builds the clickable demo: the whole patient app in one HTML file, answering
 * its own API calls from a catalogue snapshot (see demo/mock-api.js).
 *
 *   npm run build:demo   →  demo-dist/deepan-hospital-demo.html
 *
 * Separate from vite.config.js on purpose. The real build must not gain a fake
 * server by accident, and this one has requirements the real one must not
 * have — everything inlined, no code splitting, no external font.
 *
 * It is a demo, not a preview of production: bookings live in memory, sign-in
 * accepts anything, and payment is not wired. The point is to let someone hold
 * the thing and click it without being handed a server.
 */

/**
 * Carries the hospital's real logo into the single file.
 *
 * The app asks for `/logo.png` and falls back to a drawn approximation when the
 * file is missing — which is what a demo with no server always gets, so the one
 * image everybody recognises was the thing the preview got wrong. Rewriting the
 * literal to a data URI is contained to this build; the app keeps its plain
 * path and its fallback.
 *
 * Every module that asks for it, not a named list of files. The first version
 * patched Logo.jsx only, so the header showed the real lockup and the footer —
 * which asks for the same file — quietly kept drawing the replica. A rule that
 * has to be extended by hand each time is a rule that gets forgotten.
 */
function inlineLogo() {
  const file = path.resolve(import.meta.dirname, 'public/logo.png')
  const LITERAL = '"/logo.png"'
  let patched = 0
  return {
    name: 'deepan-demo-logo',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/') || !code.includes(LITERAL)) return null
      patched++
      const uri = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
      return { code: code.replaceAll(LITERAL, JSON.stringify(uri)), map: null }
    },
    buildEnd() {
      /* Two today: the header and the footer. Zero means the path changed and
         the demo is about to ship the fallback mark everywhere, looking like a
         rendering bug rather than a stale config. */
      if (patched === 0) {
        this.error(`inlineLogo: no module referenced ${LITERAL} — has the path changed?`)
      }
    },
  }
}

/** Folds the built JS and CSS into the HTML so the result is one file. */
function inlineEverything() {
  return {
    name: 'deepan-demo-inline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.fileName.endsWith('.html'))
      if (!html) return

      let source = html.source

      /*
       * Driven by the tags in the HTML rather than by the filenames in the
       * bundle. Matching on the emitted filename looks equivalent and is not:
       * a hash containing a regex metacharacter, or a path written differently
       * in the tag than in the bundle key, silently matches nothing — and the
       * asset is then deleted from the bundle having never been inlined, which
       * produced a page with no stylesheet at all and no error anywhere.
       */
      const find = (ref) => {
        const wanted = ref.split('/').pop()
        return Object.values(bundle).find((f) => f.fileName.split('/').pop() === wanted)
      }
      const inlined = new Set()

      source = source.replace(
        /<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,
        (tag, ref) => {
          const file = find(ref)
          if (!file) return tag
          inlined.add(file.fileName)
          /*
           * `</script>` inside the bundle — in a string, a regex, a comment —
           * ends the tag early wherever it appears, and the rest of the app
           * parses as HTML. The browser reports it as a syntax error a long
           * way from the cause. Escaping the sequence is the standard fix and
           * changes nothing about what the JavaScript means.
           */
          return `<script type="module">${file.code.replace(/<\/script/gi, '<\\/script')}</script>`
        },
      )

      source = source.replace(
        /<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/g,
        (tag, ref) => {
          const file = find(ref)
          if (!file) return tag
          inlined.add(file.fileName)
          return `<style>${file.source}</style>`
        },
      )

      for (const fileName of inlined) delete bundle[fileName]

      /* Every emitted asset must have gone in. One left behind means a broken
         reference in a file that is supposed to stand alone. */
      const orphans = Object.values(bundle)
        .filter((f) => f !== html && !inlined.has(f.fileName))
        .map((f) => f.fileName)
      if (orphans.length) {
        this.error(`demo build did not inline: ${orphans.join(', ')}`)
      }

      /*
       * Anything still referenced by URL would 404 in a single file, so fail
       * the build rather than ship a page with a broken asset in it.
       *
       * Check the markup only. The bundle's own text contains its filename in
       * Vite's module-preload helper, and matching that would fail every build
       * for a string that is never fetched — the demo has no dynamic chunks to
       * preload.
       */
      const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
      const leftover = markup.match(/(?:src|href)="[^"]*\/assets\/[^"]+"/g)
      if (leftover) {
        this.error(`demo build left external references: ${leftover.join(', ')}`)
      }

      html.source = source
      html.fileName = 'deepan-hospital-demo.html'
    },
  }
}

export default defineConfig({
  plugins: [inlineLogo(), react(), tailwindcss(), inlineEverything()],
  /*
   * The project root, not demo/, even though the entry HTML lives in demo/.
   *
   * Tailwind v4 discovers the classes to generate by scanning from the Vite
   * root. Rooted at demo/ it never sees src/, so it emitted a stylesheet with
   * almost nothing in it and the demo rendered as unstyled text — a page that
   * builds, loads and is entirely wrong.
   */
  publicDir: false,
  build: {
    outDir: path.resolve(import.meta.dirname, 'demo-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'demo/index.html'),
      /* One file means one chunk: no lazy routes fetched over a network the
         demo does not have. */
      output: { inlineDynamicImports: true },
    },
    /* One file means one chunk and no separate asset requests. */
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    /*
     * Drop the preload polyfill but keep the transform that replaces
     * __VITE_PRELOAD__. Turning module preloading off wholesale leaves that
     * placeholder in the bundle as a bare identifier, and the page dies on load
     * with "__VITE_PRELOAD__ is not defined". There is nothing to preload in a
     * single file either way.
     */
    modulePreload: { polyfill: false },
  },
  define: {
    /*
     * The demo opens on the opening screen every single time — see App.jsx.
     * A build-time constant rather than a runtime flag, so no amount of stale
     * browser storage can suppress the one thing a preview exists to show.
     */
    'import.meta.env.VITE_ALWAYS_OPENING': JSON.stringify('true'),
    /*
     * With dynamic imports inlined there is nothing left to preload, but the
     * bundler still emits its __VITE_PRELOAD__ placeholder in a few places and
     * nothing replaces it — the page then dies on load with an undefined
     * identifier. Defining it away is the whole fix: the value is only ever a
     * list of chunks to fetch, and this build has none.
     */
    __VITE_PRELOAD__: 'void 0',
  },
})
