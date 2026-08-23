import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { metaCsp } from './csp.js'

/**
 * Stamps the Content-Security-Policy into the built index.html.
 *
 * The API's own CSP header only covers JSON responses, which cannot execute
 * anything — the policy that actually limits what a script on the page may do
 * has to arrive with the HTML. Whoever serves `dist/` may be nginx, Netlify or
 * a shared host, so the safest place to put it is inside the document itself.
 *
 * Build only. Vite's dev server needs inline scripts and a websocket for hot
 * reload, and loosening the policy far enough to allow that would mean testing
 * against a policy no patient ever receives.
 */
function contentSecurityPolicy() {
  return {
    name: 'deepan-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const apiUrl = process.env.VITE_API_URL
      // Only an absolute API URL needs listing; a relative '/api' is same-origin.
      const apiOrigin = apiUrl?.startsWith('http') ? new URL(apiUrl).origin : null
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: metaCsp({ apiOrigin }),
            },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: {
    proxy: {
      // Same-origin in development, so the session cookie just works.
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
