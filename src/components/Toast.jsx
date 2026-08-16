import { useEffect } from 'react'
import { CircleCheck } from 'lucide-react'

/** Transient confirmation banner, announced politely to screen readers. */
export default function Toast({ message, onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [message, onDismiss, duration])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-up fixed inset-x-4 bottom-5 z-[60] mx-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl print-hide"
    >
      <CircleCheck className="size-5 shrink-0 text-mint-400" aria-hidden="true" />
      <span className="flex-1">{message}</span>
    </div>
  )
}
