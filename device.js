/**
 * Issues, lists and revokes reception device tokens — the credential the
 * Chrome extension uses.
 *
 *   npm run device -- --new "Reception PC 1"
 *   npm run device -- --list
 *   npm run device -- --revoke <id>
 *
 * The token is printed once. It is stored only as a hash, so if it is lost
 * the answer is to revoke that device and issue another — which takes a
 * second and breaks nothing else.
 */
import { migrate } from '../src/db.js'
import { issueDevice, listDevices, revokeDevice } from '../src/lib/devices.js'

migrate()

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? null : (args[index + 1] ?? '')
}

if (args.includes('--list')) {
  const devices = listDevices()
  if (!devices.length) {
    console.info('\n  No reception devices yet.')
    console.info('  Issue one:  npm run device -- --new "Reception PC 1"\n')
    process.exit(0)
  }
  console.info('')
  for (const d of devices) {
    const state = d.revoked_at ? 'revoked' : 'active '
    const used = d.last_used_at ? `last used ${d.last_used_at.slice(0, 16).replace('T', ' ')}` : 'never used'
    console.info(`  ${state}  ${d.id}  ${d.label.padEnd(24)}  ${used}`)
  }
  console.info('')
  process.exit(0)
}

const toRevoke = flag('revoke')
if (toRevoke) {
  if (!revokeDevice(toRevoke)) {
    console.error(`\n  No active device with id ${toRevoke}.\n`)
    process.exit(1)
  }
  console.info(`\n  Revoked ${toRevoke}. It stops working on its next request.\n`)
  process.exit(0)
}

const label = flag('new')
if (!label) {
  console.error('\n  Usage:')
  console.error('    npm run device -- --new "Reception PC 1"')
  console.error('    npm run device -- --list')
  console.error('    npm run device -- --revoke <id>\n')
  process.exit(1)
}

const device = issueDevice(label.trim())

console.info(`
  Device token for "${device.label}"

    ${device.token}

  Paste it into the Chrome extension on that computer, in the Device token
  box, and press Save. It is shown once and cannot be recovered.

  It opens the Klinique worklist and nothing else — no patient records, no
  payments. Revoke it any time with:

    npm run device -- --revoke ${device.id}
`)
