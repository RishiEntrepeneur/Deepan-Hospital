import { useState } from 'react'
import { ExternalLink, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCatalog } from '../lib/useCatalog'
import { cx } from '../lib/cx'

/**
 * Klinique, embedded.
 *
 * The hospital's clinical system lives at deepan.klinique.net and holds the
 * physician portal and reception desk. Putting it in a frame here means staff
 * work in one window instead of two, and land in Klinique already on the page
 * they wanted.
 *
 * Two things make this less simple than an <iframe> tag, and both are handled
 * rather than hoped away:
 *
 *   1. **Klinique permits framing today.** It sends no X-Frame-Options and no
 *      frame-ancestors, which is why this works at all. That is their header
 *      to change, and if they ever add one the frame will go blank with no
 *      warning — so the "open in a new tab" button is always visible, not a
 *      fallback buried behind an error state.
 *
 *   2. **A cross-origin frame may not keep its cookies.** Klinique sets a
 *      session cookie, and Safari blocks third-party cookies outright while
 *      Chrome is phasing them out. Where that bites, the login inside the
 *      frame will not stick — nothing this app can do about it, because the
 *      browser is enforcing it against the other origin. The new-tab route
 *      always works, so staff are never stuck.
 *
 * There is no way to detect a blank frame from the outside: a cross-origin
 * document tells us nothing about itself. So rather than guess, the notice
 * below states the situation plainly and the escape hatch is one click away.
 */
export default function KliniquePortal() {
  const { klinique } = useCatalog()
  const url = klinique?.portalUrl ?? 'https://deepan.klinique.net'
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-125 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Klinique</h2>
          <p className="truncate text-xs text-slate-500">{url}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setNonce((n) => n + 1)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Reload
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Open in a new tab
          </a>
        </div>
      </div>

      {/*
        * Said once, up front, rather than after somebody has stared at an
        * empty rectangle: a browser that blocks third-party cookies will not
        * keep the Klinique login inside this frame.
        */}
      <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-amber-900">
          If signing in here does not stick, your browser is blocking cookies for an embedded
          site — Safari does this by default. Use <strong>Open in a new tab</strong>; it works
          the same and keeps you signed in.
        </p>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-6 animate-spin text-brand-600" aria-hidden="true" />
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
           * allow-same-origin is required or Klinique cannot read its own
           * session cookie and no login is possible at all. Scripts and forms
           * are needed for the portal to function. Downloads are permitted so
           * reports can be saved. Everything else stays off — notably
           * allow-top-navigation, so nothing inside the frame can navigate
           * the staff member away from this app.
           */
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}
