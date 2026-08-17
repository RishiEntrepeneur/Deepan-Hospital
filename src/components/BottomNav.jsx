import { CalendarDays, CalendarPlus, HeartPulse, Home, Stethoscope } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { cx } from '../lib/cx'

/**
 * The phone's navigation bar.
 *
 * Below xl every destination lived behind the hamburger, so getting anywhere
 * cost two taps and a full-screen list: tap the menu, read nine items, tap
 * again. On the device most patients use, that is the whole app.
 *
 * Five destinations, always visible, one tap each — and the current one is lit,
 * so the app says where you are without being asked. The drawer stays for the
 * rest (Services, Help, Contact, the account menu); this carries the journey
 * people actually repeat.
 *
 * Booking sits in the middle and is raised, because it is the reason the site
 * exists and it is not a page you navigate to — it opens the wizard over
 * whatever you were reading.
 *
 * Deliberately not shown on the desk: staff work on a screen wide enough for
 * the real nav, and their tasks are not these five.
 */

/*
 * Their own short labels, not the main nav's. "My Appointments" is a menu
 * item; in a five-column bar on a 390px phone it is a truncated smear. Each
 * language gets a word that fits rather than an ellipsis.
 */
const ITEMS = [
  { id: 'home', icon: Home, labelKey: 'tab.home' },
  { id: 'doctors', icon: Stethoscope, labelKey: 'tab.doctors' },
  { id: 'book', icon: CalendarPlus, labelKey: 'tab.book', primary: true },
  { id: 'appointments', icon: CalendarDays, labelKey: 'tab.appointments' },
  { id: 'health', icon: HeartPulse, labelKey: 'tab.health' },
]

export default function BottomNav({ page, onNavigate, onBook, appointmentCount = 0 }) {
  const { t } = useLanguage()

  return (
    <nav
      aria-label={t('nav.menu')}
      /*
       * pb-[env(safe-area-inset-bottom)] keeps the row clear of the iPhone home
       * indicator, which otherwise sits on top of the last 34px of the bar.
       */
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md xl:hidden print-hide"
    >
      {/* Every cell the same width, the raised one included — otherwise the
          button borrows space from its neighbours and their labels collide. */}
      <ul className="mx-auto flex max-w-lg items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const current = !item.primary && page === item.id

          if (item.primary) {
            return (
              <li key={item.id} className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={onBook}
                  aria-label={t('action.book')}
                  className="-mt-5 grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white transition active:scale-95 active:bg-brand-700"
                >
                  <Icon className="size-6" aria-hidden="true" />
                </button>
              </li>
            )
          }

          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'flex w-full flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[10px] font-semibold transition active:scale-95',
                  current ? 'text-brand-700' : 'text-slate-500',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {/* The count belongs on the icon a patient taps to check it. */}
                  {item.id === 'appointments' && appointmentCount > 0 && (
                    <span className="absolute -end-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-mint-500 px-1 text-[9px] leading-4 font-bold text-white">
                      {appointmentCount}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t(item.labelKey)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
