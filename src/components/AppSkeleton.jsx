/**
 * What the app looks like before the catalogue arrives.
 *
 * This replaced a centred spinner on an otherwise blank white screen — the
 * first thing every patient saw, and on a slow connection the only thing they
 * saw for a while. A spinner says "wait"; this says what is coming and where,
 * so the home page appears to assemble rather than to appear, and nothing
 * jumps when the real content lands on top of the same shapes.
 *
 * It mirrors the home page rather than being a generic grey box, because the
 * point is the layout, not the animation. If Home's structure changes enough
 * that this stops matching, this should change with it.
 *
 * Marked aria-hidden with a polite live message alongside: a screen reader
 * should hear "loading", not a description of twelve grey rectangles.
 */
export default function AppSkeleton({ label }) {
  return (
    <div className="min-h-dvh bg-white">
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>

      <div aria-hidden="true">
        {/* Emergency strip — a real bar of colour, not a placeholder, because
            it is the same on every load and its absence is a flash. */}
        <div className="h-8 bg-brand-700" />

        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="skeleton h-12 w-40 sm:h-16 sm:w-48" />
            <div className="ms-auto flex items-center gap-2">
              <div className="skeleton h-9 w-28 rounded-lg" />
              <div className="skeleton h-9 w-24 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Hero */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="skeleton h-4 w-52 rounded" />
          <div className="mt-6 space-y-3">
            <div className="skeleton h-10 w-4/5 max-w-xl rounded-lg" />
            <div className="skeleton h-10 w-3/5 max-w-md rounded-lg" />
          </div>
          <div className="mt-6 space-y-2.5">
            <div className="skeleton h-4 w-full max-w-lg rounded" />
            <div className="skeleton h-4 w-11/12 max-w-md rounded" />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <div className="skeleton h-12 w-48 rounded-lg" />
            <div className="skeleton h-12 w-32 rounded-lg" />
          </div>

          {/* The three counts */}
          <div className="mt-10 flex gap-10">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="skeleton h-8 w-12 rounded" />
                <div className="skeleton mt-2 h-3 w-20 rounded" />
              </div>
            ))}
          </div>

          {/* Department cards */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-5">
                <div className="skeleton size-11 rounded-xl" />
                <div className="skeleton mt-4 h-5 w-2/3 rounded" />
                <div className="skeleton mt-2.5 h-3 w-full rounded" />
                <div className="skeleton mt-2 h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
