import { defineConfig } from 'vitest/config'

/**
 * Front-end tests.
 *
 * Vitest rather than `node --test` (which the API uses) for one practical
 * reason: these modules are written for Vite. They import `../data/hospital`
 * without a file extension and read `import.meta.env`, neither of which plain
 * Node resolves. Vitest reuses Vite's own resolver, so the modules load in a
 * test exactly as they do in the browser — no shims, no parallel build.
 *
 * The suites are deliberately logic-only. Every bug this file was written in
 * response to lived in a pure function — keyword matching, department
 * routing, fee arithmetic — not in a component. Testing those first buys the
 * most correctness per line of test code.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
    reporters: 'dot',
  },
})
