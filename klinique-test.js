/**
 * Tests whether the app can sign in to Klinique with the credentials in .env.
 *
 *   npm run klinique-test
 *
 * It makes exactly one sign-in attempt against Klinique using KLINIQUE_USERNAME
 * / KLINIQUE_PASSWORD and reports whether it worked. Nothing is booked and
 * nothing is stored — this only answers "can the app log in?".
 */
import { config } from '../src/config.js'
import { isSessionMode, isSessionSubmitReady, signIn } from '../src/lib/klinique-session.js'

const mask = (s) => (s ? `${s.slice(0, 2)}${'•'.repeat(Math.max(0, s.length - 2))}` : '(empty)')

console.info('\n  Klinique sign-in test\n')
console.info(`  Mode      : ${config.klinique.mode}`)
console.info(`  Base URL  : ${config.klinique.baseUrl || '(not set)'}`)
console.info(`  Login door : ${config.klinique.loginPath}  (scope: ${config.klinique.loginScope})`)
console.info(`  Username  : ${config.klinique.username || '(not set)'}`)
console.info(`  Password  : ${mask(config.klinique.password)}\n`)

if (config.klinique.mode !== 'session') {
  console.info('  KLINIQUE_MODE is not "session", so the app will not sign in automatically.')
  console.info('  Set KLINIQUE_MODE=session in server/.env to use this.\n')
  process.exit(0)
}

if (!isSessionMode()) {
  console.error('  ✖  Base URL, username or password is missing. Fill all three in server/.env.\n')
  process.exit(1)
}

try {
  await signIn()
  console.info('  ✓  Signed in successfully. The app can reach Klinique on its own.\n')
  if (isSessionSubmitReady()) {
    console.info('  Booking form is configured too — session mode is fully set up.\n')
  } else {
    console.info('  Next: capture the booking form so it can actually submit —')
    console.info('        npm run klinique-capture -- --file captured.txt')
    console.info('  (see KLINIQUE-AUTO.md). Until then bookings stay on the desk worklist.\n')
  }
  process.exit(0)
} catch (error) {
  console.error(`  ✖  Could not sign in: ${error.message}\n`)
  console.error('  Check the username and password in server/.env. Use the dedicated')
  console.error('  Klinique account you created for the website, and make sure it is active.\n')
  process.exit(1)
}
