import { Component } from 'react'

/**
 * The last line of defence against a blank white screen.
 *
 * React unmounts the whole tree when a render throws; with nothing to catch it,
 * the page goes blank and the patient sees a dead site with no way forward.
 * That is the worst possible failure for a hospital — someone trying to book an
 * appointment simply can't. This boundary turns any such crash into a plain,
 * calm screen with a way back.
 *
 * It also handles the specific crash that follows every deploy. Pages here load
 * in separate code files whose names carry a content hash, so a new build gives
 * the desk page a new filename. A browser still holding yesterday's page asks
 * for yesterday's file, which no longer exists — the import rejects and the
 * screen would otherwise go blank. That case is not really an error: the fix is
 * simply to fetch the new build, so we reload once, automatically. A one-shot
 * guard in sessionStorage stops a genuine, repeatable failure from reloading
 * forever.
 */

const RELOAD_GUARD = 'deepan_chunk_reloaded'
const CACHE_BUST = '_r'

function looksLikeStaleChunk(error) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`
  return (
    /ChunkLoadError/i.test(text) ||
    /Loading (chunk|CSS chunk)/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text)
  )
}

/**
 * Reload in a way that actually fetches a new document.
 *
 * `location.reload()` is allowed to re-serve the cached page, and after a
 * deploy that cached page is the whole problem: it names asset files that no
 * longer exist, so reloading it fails in exactly the same way and the patient
 * sees the error screen anyway. A one-time query string cannot be answered
 * from the cache, so the browser has to ask the server — which returns the new
 * index.html naming the new files.
 *
 * The parameter is dropped from the address bar afterwards so nobody is left
 * with it in a bookmark, and the hash is preserved so a reload from the desk
 * comes back to the desk.
 */
function freshReload() {
  const url = new URL(window.location.href)
  url.searchParams.set(CACHE_BUST, String(Date.now()))
  window.location.replace(url.toString())
}

/*
 * Tidy the marker away once the fresh page is running, so nobody bookmarks or
 * shares a URL with it. Done here rather than in the app because this module
 * loads before anything that could itself fail.
 */
try {
  const url = new URL(window.location.href)
  if (url.searchParams.has(CACHE_BUST)) {
    url.searchParams.delete(CACHE_BUST)
    window.history.replaceState(null, '', url.toString())
  }
} catch {
  /* no history API, or a URL we cannot parse — harmless either way */
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false, recovering: false, detail: null }
  }

  static getDerivedStateFromError(error) {
    // A stale-chunk crash after a deploy: reload once to pull the new build,
    // rather than showing an error for what is really just an old tab.
    if (looksLikeStaleChunk(error)) {
      let reloadedBefore = false
      try {
        reloadedBefore = sessionStorage.getItem(RELOAD_GUARD) === '1'
        if (!reloadedBefore) sessionStorage.setItem(RELOAD_GUARD, '1')
      } catch {
        // Private mode with storage blocked — fall through to the error screen
        // rather than risk a reload loop we cannot guard.
      }
      if (!reloadedBefore) {
        // Show a neutral "updating" screen for the instant before the reload.
        try {
          freshReload()
        } catch {
          /* ignore */
        }
        return { crashed: false, recovering: true }
      }
    }
    /*
     * Keep the message. It is never shown to a patient, but a member of staff
     * who can read out "Cannot read properties of undefined (reading slot)"
     * turns an unreproducible report into a fixable one.
     */
    return { crashed: true, recovering: false, detail: String(error?.message ?? error ?? '') }
  }

  componentDidCatch(error, info) {
    // Leave a trace in the console for whoever is looking, without ever
    // surfacing a stack trace to a patient.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem(RELOAD_GUARD)
    } catch {
      /* ignore */
    }
    freshReload()
  }

  render() {
    if (this.state.recovering) {
      return (
        <div style={STYLES.wrap} role="status" aria-live="polite">
          <div style={STYLES.spinner} aria-hidden="true" />
          <p style={STYLES.muted}>Updating to the latest version…</p>
        </div>
      )
    }

    if (this.state.crashed) {
      /*
       * Who is reading this?
       *
       * "Please tell the front desk" is exactly wrong when the front desk is
       * the one looking at it, and "we can book it over the phone" is advice
       * for a patient, not for the person who would be taking that call. The
       * hash is the one thing still readable after a crash — no state, no
       * context, nothing that could itself have thrown.
       */
      const atDesk = typeof window !== 'undefined' && /^#\/?desk/.test(window.location.hash)

      return (
        <div style={STYLES.wrap} role="alert">
          <div style={STYLES.card}>
            <div style={STYLES.mark} aria-hidden="true">＋</div>
            <h1 style={STYLES.title}>Something went wrong</h1>

            {atDesk ? (
              <p style={STYLES.body}>
                The desk ran into a problem. Reloading usually fixes it, and no
                booking has been lost — everything is saved on the server.
              </p>
            ) : (
              <p style={STYLES.body}>
                The page ran into a problem. Reloading usually fixes it. If it keeps
                happening, please tell the front desk.
              </p>
            )}

            <button type="button" onClick={this.handleReload} style={STYLES.button}>
              Reload the page
            </button>

            {atDesk ? (
              <>
                <p style={STYLES.help}>
                  If it keeps happening, send this line to whoever looks after the website.
                </p>
                {this.state.detail && <p style={STYLES.detail}>{this.state.detail}</p>}
              </>
            ) : (
              <p style={STYLES.help}>
                Or call the hospital directly — we can book your appointment over the phone.
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/*
 * Inline styles on purpose: a crash can happen before or because of the
 * stylesheet, so this screen must not depend on any CSS class loading.
 */
const STYLES = {
  wrap: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#faf9f6',
    color: '#16130f',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  card: {
    maxWidth: '420px',
    textAlign: 'center',
    background: '#ffffff',
    border: '1px solid #e7e3d9',
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 18px 40px -24px rgba(22,19,15,.25)',
  },
  mark: {
    width: '48px',
    height: '48px',
    margin: '0 auto 18px',
    borderRadius: '11px',
    background: '#0e6a5c',
    color: '#fff',
    fontSize: '30px',
    lineHeight: '48px',
    fontWeight: 700,
  },
  title: { margin: '0 0 10px', fontSize: '22px', fontWeight: 700, letterSpacing: '-.01em' },
  body: { margin: '0 0 24px', fontSize: '15px', lineHeight: 1.55, color: '#5b564c' },
  button: {
    appearance: 'none',
    border: 'none',
    borderRadius: '10px',
    background: '#0e6a5c',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 22px',
    cursor: 'pointer',
    minHeight: '44px',
  },
  help: { margin: '20px 0 0', fontSize: '13px', color: '#a8a294' },
  /* Staff only: the actual fault, in a form somebody can copy out. */
  detail: {
    margin: '10px 0 0',
    padding: '8px 10px',
    background: '#f4f2ec',
    border: '1px solid #e7e3d9',
    borderRadius: '6px',
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    fontSize: '11.5px',
    lineHeight: 1.45,
    color: '#5b564c',
    wordBreak: 'break-word',
    textAlign: 'left',
  },
  muted: { marginTop: '16px', fontSize: '14px', color: '#5b564c' },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #d5eae5',
    borderTopColor: '#0e6a5c',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
