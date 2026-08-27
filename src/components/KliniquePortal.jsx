import { useState } from 'react'
import { ExternalLink, Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { useCatalog } from '../lib/useCatalog'
import { cx } from '../lib/cx'

/**
 * Getting to Klinique from the desk.
 *
 * WHY THIS IS NOT SIMPLY AN IFRAME ANY MORE
 *
 * It was, and the frame loaded, and staff could not sign in inside it. That is
 * not a bug in either system and no setting on this side fixes it.
 *
 * Klinique is a Rails app, so its session cookie is `SameSite=Lax` — set that
 * way explicitly by Rails 6.1 and later, and treated that way by every browser
 * since Chrome made Lax the default for cookies that do not say. A Lax cookie
 * is deliberately not sent on a cross-site request that loads a frame. So the
 * login form inside the frame posts, Klinique answers, and the cookie that
 * would have kept the staff member signed in never comes back. They land on
 * the login page again, having typed a correct password.
 *
 * Only Klinique can change that, by sending `SameSite=None; Secure`. Until
 * they do — and they have no reason to — a frame can show their login page and
 * nothing behind it.
 *
 * WHY THE FRAME IS STILL HERE, BUT NOT THE DEFAULT
 *
 * Presenting a login that cannot succeed is worse than not presenting one: the
 * person assumes they typed their password wrong, tries again, and eventually
 * assumes the whole desk portal is broken. So the way that works — open it
 * properly, in its own tab — is the button, and the frame is behind a toggle
 * for whoever wants to see for themselves.
 *
 * There is also a reason not to want it back. A frame asks staff to type the
 * password to the hospital's clinical records into a page whose address bar
 * says deepanhospital.com, where they cannot check the padlock against the
 * thing they are trusting. It is why Google refuses to sign you in inside an
 * embedded browser. The frame going cold is, on balance, the right outcome.
 *
 * THE REAL ANSWER is the day's Klinique bookings read and shown here natively,
 * in this app's own list — see server/src/lib/klinique-visits.js. Then nobody
 * needs to leave at all for the common case, and this button is for the rest.
 */
export default function KliniquePortal() {
  const { klinique } = useCatalog()
  const url = klinique?.portalUrl ?? 'https://deepan.klinique.net'
  const [showFrame, setShowFrame] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  return (
    <div className="flex min-h-125 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Klinique</h2>
          <p className="truncate text-xs text-slate-500">{url}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Open Klinique
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Klinique has to open in its own tab
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              It used to sit inside this page, and signing in there stopped working — not
              because anything here is broken. Klinique keeps you signed in with a cookie
              that browsers deliberately refuse to send to a page embedded inside another
              site. The password goes in, Klinique accepts it, and the browser throws away
              the part that would have remembered it.
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Only Klinique can change that. Meanwhile <strong>Open Klinique</strong> works
              normally, and staying signed in there means the tab is ready whenever you
              need it.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFrame((v) => !v)}
          className="mt-4 text-xs font-semibold text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
        >
          {showFrame ? 'Hide the embedded view' : 'Show the embedded view anyway'}
        </button>
      </div>

      {showFrame && (
        <div className="mt-4 flex h-[calc(100vh-26rem)] min-h-100 flex-col">
          <div className="flex items-center justify-between gap-3 pb-2">
            <p className="text-xs text-slate-500">
              You can read what loads here. Signing in will not stick.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setNonce((n) => n + 1)
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Reload
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-white">
                <div className="text-center">
                  <LoaderCircle
                    className="mx-auto size-6 animate-spin text-brand-600"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs text-slate-500">Loading Klinique…</p>
                </div>
              </div>
            )}
            <iframe
              key={nonce}
              src={url}
              title="Klinique"
              onLoad={() => setLoading(false)}
              className={cx('size-full border-0', loading && 'invisible')}
              /*
               * allow-same-origin so Klinique can reach its own storage at all;
               * scripts and forms so the page works. Notably absent:
               * allow-top-navigation, so nothing inside can navigate a staff
               * member away from this app.
               */
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  )
}
