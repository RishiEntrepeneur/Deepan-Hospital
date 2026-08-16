import { useId, useState } from 'react'
import {
  CalendarCheck,
  CircleAlert,
  CircleUser,
  ConciergeBell,
  LoaderCircle,
  LogOut,
  Pencil,
} from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { GENDERS } from '../data/hospital'
import { api, errorKeyFor } from '../lib/api'
import { rememberedPhone } from '../lib/rememberedPhone'
import { cx } from '../lib/cx'

const NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function FieldError({ errorKey }) {
  const { t } = useLanguage()
  if (!errorKey) return null
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-rose-600">
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {t(errorKey)}
    </p>
  )
}

const inputClass = (invalid) =>
  cx(
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400',
    invalid
      ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100',
  )

/* ------------------------------------------------------------------ *
 * Profile form — shown after sign-in, and for editing later.
 * ------------------------------------------------------------------ */
function ProfileForm({ auth, onDone, initial }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? '',
    email: initial?.email ?? '',
    age: initial?.age == null ? '' : String(initial.age),
    gender: initial?.gender ?? '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const ids = { name: useId(), email: useId(), age: useId() }

  const submit = async (event) => {
    event.preventDefault()
    const found = {}
    const name = form.fullName.trim()
    if (name.length < 3) found.fullName = 'error.nameTooShort'
    else if (!NAME_PATTERN.test(name)) found.fullName = 'error.nameInvalid'
    if (form.email && !EMAIL_PATTERN.test(form.email.trim())) found.email = 'error.emailInvalid'
    if (form.age !== '') {
      const age = Number(form.age)
      if (!Number.isInteger(age) || age < 0 || age > 120) found.age = 'error.ageInvalid'
      /*
       * The account holder must be an adult — under the DPDP Act a child's
       * data needs verifiable parental consent. This does not stop a child
       * being treated: the booking form takes the patient's own age
       * separately, so a parent books for their child from an adult account.
       */
      else if (age < 18) found.age = 'error.underAge'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      await auth.saveProfile({
        fullName: name,
        email: form.email.trim() || null,
        age: form.age === '' ? null : Number(form.age),
        gender: form.gender || null,
      })
      onDone?.()
    } catch (error) {
      setErrors({ fullName: errorKeyFor(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={ids.name} className="block text-sm font-semibold text-slate-800">
          {t('field.fullName')}
        </label>
        <input
          id={ids.name}
          type="text"
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder={t('field.fullNamePlaceholder')}
          className={cx('mt-1.5', inputClass(errors.fullName))}
        />
        <FieldError errorKey={errors.fullName} />
      </div>

      <div>
        <label htmlFor={ids.email} className="block text-sm font-semibold text-slate-800">
          {t('contact.email')} <span className="font-normal text-slate-400">({t('field.optional')})</span>
        </label>
        <input
          id={ids.email}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="name@example.com"
          className={cx('mt-1.5', inputClass(errors.email))}
        />
        <FieldError errorKey={errors.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.age} className="block text-sm font-semibold text-slate-800">
            {t('field.age')} <span className="font-normal text-slate-400">({t('field.optional')})</span>
          </label>
          <input
            id={ids.age}
            type="number"
            inputMode="numeric"
            min="18"
            max="120"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder={t('field.agePlaceholder')}
            className={cx('mt-1.5', inputClass(errors.age))}
          />
          <FieldError errorKey={errors.age} />
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">
            {t('field.gender')} <span className="font-normal text-slate-400">({t('field.optional')})</span>
          </legend>
          <div role="radiogroup" aria-label={t('field.gender')} className="mt-1.5 flex flex-wrap gap-1.5">
            {GENDERS.map((option) => {
              const selected = form.gender === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setForm({ ...form, gender: option.value })}
                  className={cx(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400',
                  )}
                >
                  {t(option.labelKey)}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-70"
      >
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {t('account.saveProfile')}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------------ *
 * Patient sign-in
 *
 * A phone number and a password the patient chooses. Not a texted code: those
 * needed an SMS gateway and TRAI registration, a week of paperwork before
 * anyone could book. This works today and is what people expect from every
 * other site they use.
 *
 * Booking needs no account at all — this is for patients who want their
 * appointments in one place.
 * ------------------------------------------------------------------ */
function PatientSignIn({ auth, onBack, onDone }) {
  const { t } = useLanguage()
  // Patients land on "Create account" first — most people arriving here are new
  // and need to sign up; returning patients switch to sign-in with one tap.
  const [mode, setMode] = useState('register')
  const [phone, setPhone] = useState(() => rememberedPhone())
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [show, setShow] = useState(false)
  const [errorKey, setErrorKey] = useState(null)
  const [busy, setBusy] = useState(false)
  /*
   * Only appears when the server asks for it: a number that already has
   * records at the hospital cannot have a password set on it by whoever
   * happens to know the number. One of the patient's own booking references
   * proves it is theirs. It is a one-time check, not the way in — afterwards
   * it is the password, like anywhere else.
   */
  const [claimNeeded, setClaimNeeded] = useState(false)
  const [reference, setReference] = useState('')
  const ids = { phone: useId(), password: useId(), name: useId(), reference: useId() }

  const submit = async (event) => {
    event.preventDefault()
    setErrorKey(null)
    setBusy(true)
    try {
      if (mode === 'signin') await auth.login(phone.trim(), password)
      else await auth.register(phone.trim(), password, fullName.trim(), reference.trim())
      rememberPhone(phone.trim())
      onDone?.()
    } catch (error) {
      if (error?.code === 'CLAIM_PROOF_REQUIRED') setClaimNeeded(true)
      setErrorKey(errorKeyFor(error))
    } finally {
      setBusy(false)
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-600'

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl text-slate-900">
        {mode === 'signin' ? t('account.signIn') : t('account.signUpTitle')}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === 'signin' ? t('account.signInSubtitle') : t('account.signUpSubtitle')}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor={ids.name} className="block text-sm font-semibold text-slate-800">
              {t('field.fullName')}
            </label>
            <input
              id={ids.name}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className={field}
            />
          </div>
        )}

        <div>
          <label htmlFor={ids.phone} className="block text-sm font-semibold text-slate-800">
            {t('field.phone')}
          </label>
          <input
            id={ids.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel"
            className={field}
          />
        </div>

        <div>
          <label htmlFor={ids.password} className="block text-sm font-semibold text-slate-800">
            {t('account.password')}
          </label>
          {mode === 'register' && (
            <p className="mt-0.5 text-xs text-slate-500">{t('account.passwordHint')}</p>
          )}
          <div className="relative">
            <input
              id={ids.password}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className={field}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-brand-700"
            >
              {show ? t('account.hidePassword') : t('account.showPassword')}
            </button>
          </div>
        </div>

        {mode === 'register' && claimNeeded && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5">
            <label
              htmlFor={ids.reference}
              className="block text-sm font-semibold text-amber-900"
            >
              {t('account.bookingReference')}
            </label>
            <p className="mt-0.5 text-xs text-amber-800">{t('account.bookingReferenceHint')}</p>
            <input
              id={ids.reference}
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="DH-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              className={field}
            />
          </div>
        )}

        {errorKey && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {t(errorKey)}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !phone.trim() || !password}
          className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {mode === 'signin' ? t('account.signIn') : t('account.createAccount')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'signin' ? 'register' : 'signin'))
          setErrorKey(null)
          setClaimNeeded(false)
        }}
        className="mt-5 w-full text-sm font-semibold text-brand-700 hover:underline"
      >
        {mode === 'signin' ? t('account.noAccountYet') : t('account.haveAccount')}
      </button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          {t('action.back')}
        </button>
      )}
    </div>
  )
}

/*
 * One door for everybody who works here — reception and doctors alike.
 *
 * There used to be two, and the username prefix decided which one you were
 * allowed through. That only ever produced a refusal for people typing a
 * correct password. Whoever signs in lands on the desk, where the Klinique
 * portal is a tab, so a doctor reaches their own system from here without a
 * second address to remember.
 */
function DeskSignIn({ onSignedIn, onBack }) {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const ids = { user: useId(), pass: useId() }

  const submit = async (event) => {
    event.preventDefault()
    const name = username.trim().toLowerCase()

    setErrorKey(null)
    setBusy(true)
    try {
      // No `as` — the account itself decides what it can see, not the door.
      const data = await api.desk.signIn(name, password)
      onSignedIn(data.staff)
    } catch (error) {
      setErrorKey(errorKeyFor(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-600 text-white">
          <ConciergeBell className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl text-slate-900 sm:text-3xl">{t('account.deskSignInTitle')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('account.deskSignInSubtitle')}</p>
      </header>

      <form onSubmit={submit} noValidate className="mt-7 space-y-4">
        <div>
          <label htmlFor={ids.user} className="block text-sm font-semibold text-slate-800">
            {t('account.username')}
          </label>
          <input
            id={ids.user}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
            placeholder={t('account.usernamePlaceholder')}
            className={cx('mt-1.5 font-mono', inputClass(errorKey === 'error.invalidCredentials'))}
          />
          <p className="mt-1.5 text-xs text-slate-500">{t('account.usernameHint')}</p>
        </div>

        <div>
          <label htmlFor={ids.pass} className="block text-sm font-semibold text-slate-800">
            {t('account.password')}
          </label>
          <input
            id={ids.pass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={cx('mt-1.5', inputClass(errorKey === 'error.invalidCredentials'))}
          />
        </div>

        <FieldError errorKey={errorKey} />

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {t('account.signIn')}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          {t('action.back')}
        </button>

        <p className="text-center text-xs text-slate-400">{t('account.noDeskAccount')}</p>
      </form>
    </>
  )
}

/*
 * The way in for hospital staff.
 *
 * This used to be one of two equal cards on a "how are you signing in?" screen,
 * which asked every patient to classify themselves before they could do
 * anything. Almost everyone arriving here is a patient, and the ones who are
 * not know exactly who they are — so the patient path is now the page itself
 * and this is a line at the bottom of it.
 *
 * Deliberately still present. Reception and doctors reach the desk through
 * here, and hiding it entirely would mean the only route left was typing a URL
 * nobody wrote down.
 */
function StaffEntry({ onChoose }) {
  const { t } = useLanguage()
  return (
    <div className="mx-auto mt-10 max-w-md border-t border-slate-200 pt-6 text-center">
      <button
        type="button"
        onClick={onChoose}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700"
      >
        <ConciergeBell className="size-4" aria-hidden="true" />
        {t('account.asDesk')}
      </button>
      <p className="mt-1 text-xs text-slate-400">{t('account.asDeskHint')}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export default function Account({ auth, upcomingCount, onNavigate, onBook }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  /* 'patient' is the page; 'desk' is the staff door reached from the bottom. */
  const [role, setRole] = useState('patient')

  if (auth.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-24">
        <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    )
  }

  if (!auth.isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {role === 'desk' ? (
          <DeskSignIn onSignedIn={() => onNavigate('desk')} onBack={() => setRole('patient')} />
        ) : (
          <>
            <PatientSignIn auth={auth} onDone={() => onNavigate('appointments')} />
            <StaffEntry onChoose={() => setRole('desk')} />
          </>
        )}
      </div>
    )
  }

  const { user } = auth
  const needsProfile = !auth.profileComplete || editing

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {user.fullName ? (
              user.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()
            ) : (
              <CircleUser className="size-7" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-slate-900">
              {user.fullName || t('account.completeProfileTitle')}
            </h1>
            <p className="text-sm text-slate-500">+91 {user.phone}</p>
          </div>
        </div>

        {needsProfile ? (
          <div className="mt-6">
            {!auth.profileComplete && (
              <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
                {t('account.completeProfileHint')}
              </p>
            )}
            <ProfileForm auth={auth} initial={user} onDone={() => setEditing(false)} />
          </div>
        ) : (
          <>
            <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100 text-sm">
              {user.email && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-slate-500">{t('contact.email')}</dt>
                  <dd className="font-semibold break-all text-slate-800">{user.email}</dd>
                </div>
              )}
              {user.age != null && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-slate-500">{t('field.age')}</dt>
                  <dd className="font-semibold text-slate-800">{user.age}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-slate-500">{t('appt.upcoming')}</dt>
                <dd className="font-semibold text-slate-800">{upcomingCount}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onBook}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <CalendarCheck className="size-4" aria-hidden="true" />
                {t('action.book')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('nav.appointments')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t('account.editProfile')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={auth.signOut}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {t('account.signOut')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
