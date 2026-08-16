/** Primary navigation, shared by the header and the footer. */
export const NAV_ITEMS = [
  { id: 'home', labelKey: 'nav.home' },
  { id: 'doctors', labelKey: 'nav.doctors' },
  { id: 'services', labelKey: 'nav.services' },
  { id: 'appointments', labelKey: 'nav.appointments' },
  { id: 'health', labelKey: 'nav.health' },
  { id: 'glossary', labelKey: 'nav.glossary' },
  { id: 'contact', labelKey: 'nav.contact' },
]

/** Account lives in the header's right-hand cluster, not the main nav. */
/* `desk` is staff-only and deliberately absent from the public nav. */
/* `privacy` is reachable from the footer and from the consent prompt, but is
   not in the main nav — it is a page you go to on purpose, not one you browse. */
export const PAGES = [...NAV_ITEMS.map((item) => item.id), 'account', 'desk', 'privacy', 'doctor']

/**
 * Reads a hash route, which may carry one parameter: `#doctor/deepan-g`.
 *
 * Kept as a plain function rather than a router library — the whole app has
 * exactly one parameterised route, and a dependency to serve it would cost
 * more in bundle size than it saves in code.
 */
export function parseRoute(hash) {
  const clean = String(hash ?? '').replace(/^#/, '')
  const [page, param] = clean.split('/')
  return { page: PAGES.includes(page) ? page : 'home', param: param ? decodeURIComponent(param) : '' }
}
