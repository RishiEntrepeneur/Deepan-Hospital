/**
 * A section's title, with the hairline rule that separates one band of the
 * page from the next.
 *
 * The rule does the work a card border used to do — it groups without boxing,
 * which keeps the page reading as one column of related things rather than a
 * tray of floating tiles.
 */
export default function SectionHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="border-t border-slate-300 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="max-w-2xl">
          {eyebrow && <p className="label-caps mb-2 text-slate-500">{eyebrow}</p>}
          <h2 className="font-display text-3xl leading-tight text-slate-900 sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-2 max-w-prose text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
