import { useEffect, useState } from 'react'
import { CalendarPlus, ChevronDown, CircleUser, Copy, LogOut, Menu, Phone, Stethoscope, X } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { HOSPITAL } from '../data/hospital'
import { cx } from '../lib/cx'
import { telHref } from '../lib/schedule'
import { NAV_ITEMS } from '../lib/navigation'
import { hasAccountOnThisDevice } from '../lib/rememberedPhone'
import Logo from './Logo'
import LanguageSwitcher from './LanguageSwitcher'

export default function Header({ page, onNavigate, onBook, appointmentCount, user, staff, onSignOut, onStaffSignOut, deskMode = false }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Either session on its own is enough to have somewhere to go.
  const hasSession = Boolean(user || staff)

  /*
   * What the button offers depends on whether there is anything to come back
   * to. A first-time visitor has no account, so "Sign in" asks them for
   * credentials they were never given — "Create account" says what actually
   * happens next. If this device has logged in before, we know an account
   * exists and the honest word is "Log in".
   */
  const returning = !hasSession && hasAccountOnThisDevice()
  const signInLabel = returning ? t('account.logIn') : t('account.createAccount')

  // Revert the "Copied" confirmation so the number is readable again.
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  // Escape and a click anywhere else close it — a menu that can only be
  // dismissed by hitting the same button again feels stuck.
  useEffect(() => {
    if (!menuOpen) return undefined
    const dismiss = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      setMenuOpen(false)
    }
    document.addEventListener('keydown', dismiss)
    document.addEventListener('click', dismiss, { capture: true })
    return () => {
      document.removeEventListener('keydown', dismiss)
      document.removeEventListener('click', dismiss, { capture: true })
    }
  }, [menuOpen])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [page])

  const go = (id) => {
    onNavigate(id)
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md print-hide">
      {/* Emergency strip */}
      <div className="bg-brand-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
          <p className="truncate">
            {t('footer.emergencyBanner', { number: HOSPITAL.emergencyPhone })}
          </p>
          {/*
            * Dialling is the whole point, so the link does nothing but dial.
            *
            * It used to copy the number to the clipboard on click as well.
            * That made a phone — where the call actually connects — flash
            * "Copied" over the number mid-dial, and made a desktop look as
            * though copying was all the button ever did. Copying is now its
            * own control next to it, so neither action is hiding the other.
            */}
          <span className="flex shrink-0 items-center gap-1">
            <a
              data-tour="emergency"
              href={telHref(HOSPITAL.emergencyPhone)}
              title={t('action.callNow')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-0.5 font-semibold whitespace-nowrap transition hover:bg-white/25"
            >
              <Phone className="size-3" aria-hidden="true" />
              <span>{HOSPITAL.emergencyPhone}</span>
            </a>
            {/*
              * Desktop browsers only dial when something is registered for
              * tel: — often nothing is, and the click then does nothing at
              * all. Copying is the fallback that always works, and it is
              * hidden on small screens where dialling does.
              */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(HOSPITAL.emergencyPhone).then(
                  () => setCopied(true),
                  () => {},
                )
              }}
              title={t('action.copyNumber')}
              aria-label={t('action.copyNumber')}
              className="hidden rounded-lg px-1.5 py-0.5 transition hover:bg-white/25 sm:inline-flex"
            >
              {copied ? (
                <span className="font-semibold">{t('action.copied')}</span>
              ) : (
                <Copy className="size-3" aria-hidden="true" />
              )}
            </button>
          </span>
        </div>
      </div>

      {/*
        * Full width from xl rather than capped at max-w-7xl.
        *
        * The cap is 1280px, so a 1440px laptop got no more room than a 1280px
        * one — and the row needs about 1330px once the nav, the three-language
        * switcher and both buttons are laid out. It overflowed the viewport
        * from 1280 up to roughly 1500. The rest of the page keeps the cap;
        * only this row, which has a fixed amount to fit, gets the width.
        */}
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8 xl:max-w-none xl:gap-3 xl:px-5 2xl:px-8">
        <Logo onClick={() => go('home')} className="min-w-0 flex-1 xl:flex-none" />

        {/*
          * The full nav appears at xl, not lg. At 1024 — an iPad Pro in
          * portrait — seven nav items want 667px, the controls 379px and the
          * logo 139px, against 960px of usable width. It overflowed the
          * viewport by 218px on every page. Below xl the same links live in
          * the drawer, where they fit.
          */}
        {!deskMode && (
        <nav aria-label={t('nav.menu')} className="hidden flex-1 justify-center xl:flex">
          <ul className="flex items-center gap-0.5 2xl:gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-tour={`nav-${item.id}`}
                  onClick={() => go(item.id)}
                  aria-current={page === item.id ? 'page' : undefined}
                  className={cx(
                    /* Tighter between xl and 2xl, where the row is at its
                       most cramped; the roomier padding returns above it. */
                    'relative rounded-lg px-2 py-2 text-sm font-semibold whitespace-nowrap transition 2xl:px-3',
                    page === item.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  {t(item.labelKey)}
                  {item.id === 'appointments' && appointmentCount > 0 && (
                    <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-lg bg-mint-500 px-1.5 text-[11px] font-bold text-white">
                      {appointmentCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        )}

        <div className="relative flex items-center gap-2">
          {/*
            * Wrapped rather than given `hidden` directly: LanguageSwitcher
            * hardcodes `inline-flex`, and two display utilities on one element
            * are settled by stylesheet order, not attribute order — so the
            * `hidden` lost and BOTH switchers rendered on a phone, squeezing
            * the logo down to a sliver.
            */}
          {/* The globe icon is the first thing to go when the row is tight:
              three language names already say what the control is. It returns
              at 2xl, where there is room for it. */}
          <span className="hidden 2xl:inline-flex">
            <LanguageSwitcher />
          </span>
          <span className="inline-flex 2xl:hidden">
            <LanguageSwitcher showIcon={false} />
          </span>

          {/*
            * Signed in, this opens a menu rather than jumping to the account
            * page: signing out was previously buried two screens deep, which
            * is not somewhere a shared waiting-room device should hide it.
            */}
          <button
            type="button"
            onClick={() => (hasSession ? setMenuOpen((v) => !v) : go('account'))}
            aria-expanded={hasSession ? menuOpen : undefined}
            aria-haspopup={hasSession ? 'menu' : undefined}
            aria-current={page === 'account' ? 'page' : undefined}
            title={
              user
                ? t('account.signedInAs', { name: user.fullName })
                : staff
                  ? t('account.deskSession', { name: staff.username })
                  : signInLabel
            }
            className={cx(
              'hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition sm:inline-flex',
              page === 'account'
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
            )}
          >
            {/* A patient who signed in but has not completed their profile has
                no name to take initials from — that rendered an empty green
                disc. Fall back to an icon rather than to nothing. */}
            {user?.fullName?.trim() ? (
              <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {user.fullName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </span>
            ) : staff ? (
              <Stethoscope className="size-4" aria-hidden="true" />
            ) : (
              <CircleUser className="size-4" aria-hidden="true" />
            )}
            {/* The width cap is for names, which can be any length. The
                signed-out label is a fixed phrase we chose, and clipping it to
                "Create ac…" makes the one button a new visitor needs look
                broken. */}
            <span className={cx('truncate', hasSession && 'max-w-24')}>
              {/* Always identify who is signed in. Falling back to the generic
                  "My account" told the patient nothing; their number does. */}
              {user
                ? user.fullName?.trim().split(/\s+/)[0] || user.phone || t('account.account')
                : staff
                  ? t('account.desk')
                  : signInLabel}
            </span>
            {hasSession && (
              <ChevronDown className={cx('size-3.5 transition', menuOpen && 'rotate-180')} aria-hidden="true" />
            )}
          </button>

          {/*
            * Patient and staff sessions are independent, so both can be live at
            * once and either can be live alone. Gating this menu on the patient
            * session alone stranded a doctor who had only signed in at the desk:
            * the header read "Sign in", and the route back to the desk was
            * inside a menu that would not open.
            */}
          {hasSession && menuOpen && (
            <div
              role="menu"
              className="animate-scale-in absolute end-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              {user && (
                <>
                  <p className="truncate px-3.5 py-2 text-xs text-slate-500">
                    {t('account.signedInAs', { name: user.fullName?.trim() || user.phone })}
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); go('account') }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <CircleUser className="size-4 text-slate-400" aria-hidden="true" />
                    {t('account.account')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onSignOut?.() }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t('account.signOut')}
                  </button>
                </>
              )}

              {staff && (
                <>
                  <p className={cx('truncate px-3.5 py-2 text-xs text-slate-500', user && 'border-t border-slate-100')}>
                    {t('account.deskSession', { name: staff.username })}
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); go('desk') }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Stethoscope className="size-4 text-slate-400" aria-hidden="true" />
                    {t('account.goToDesk')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onStaffSignOut?.() }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t('account.signOutDesk')}
                  </button>
                </>
              )}
            </div>
          )}

          {!deskMode && (
            <button
              type="button"
              onClick={onBook}
              className="hidden items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 md:inline-flex"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {t('action.bookShort')}
            </button>
          )}

          {!deskMode && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            className="grid size-10 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 xl:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-slate-200 bg-white xl:hidden">
          <nav aria-label={t('nav.menu')} className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go(item.id)}
                    aria-current={page === item.id ? 'page' : undefined}
                    className={cx(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition',
                      page === item.id
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    {t(item.labelKey)}
                    {item.id === 'appointments' && appointmentCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-lg bg-mint-500 px-1.5 text-[11px] font-bold text-white">
                        {appointmentCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => go('account')}
                  aria-current={page === 'account' ? 'page' : undefined}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition',
                    page === 'account'
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <CircleUser className="size-4" aria-hidden="true" />
                  {/* Same fallback chain as the desktop button. `fullName` is
                      empty until the profile is completed, which rendered
                      "Signed in as " with nothing after it. */}
                  {user
                    ? t('account.signedInAs', {
                        name: user.fullName?.trim() || user.phone || t('account.account'),
                      })
                    : signInLabel}
                </button>
              </li>

              {/*
                * Sign out, in the drawer.
                *
                * The account button in the bar is hidden below 640px, so on a
                * phone this drawer was the only way in — and it had no way
                * out. Signing out meant opening the menu, opening the account
                * page, and finding a button at the bottom of it. On a shared
                * or borrowed phone that is three steps too many.
                */}
              {user && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onSignOut?.()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t('account.signOut')}
                  </button>
                </li>
              )}

              {staff && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onStaffSignOut?.()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t('account.signOutDesk')}
                  </button>
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onBook()
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {t('action.book')}
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
