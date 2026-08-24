import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isValidPhone } from '../lib/phone'
import {
  BellRing,
  Bell,
  BellOff,
  Radio,
  Volume2,
  VolumeX,
  Compass,
  CircleCheck,
  CircleX,
  Clock,
  LoaderCircle,
  LogOut,
  Phone,
  RefreshCw,
  Check,
  X,
  KeyRound,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { api, errorKeyFor } from '../lib/api'
import { getDoctor } from '../data/hospital'
import { formatTime, todayKey } from '../lib/schedule'
import { cx } from '../lib/cx'
import KliniquePortal from '../components/KliniquePortal'
import DoctorPortal from '../components/DoctorPortal'
import ReviewModeration from '../components/ReviewModeration'
import KliniqueTransfer from '../components/KliniqueTransfer'
import TellPatient from '../components/TellPatient'
import { useLiveDesk } from '../lib/useLiveDesk'
import {
  alertDesk,
  chime as chimeNow,
  disableNotify,
  notifyEnabled,
  requestNotifyPermission,
  setSoundEnabled,
  soundEnabled,
} from '../lib/deskAlert'
import Modal from '../components/Modal'
import Assistant from '../components/Assistant'
import Tour, { usableSteps } from '../components/Tour'

/** Stable identity — an inline arrow would restart the tour every render. */
const noNavigate = () => {}
import { deskTour } from '../lib/tours'

/**
 * Reception desk — the notification hub.
 *
 * Staff-only, reached at #desk and deliberately absent from the public nav.
 * Deliberately in English only: this is an internal operations screen used by
 * a handful of trained staff, and mistranslating an operational term here is
 * worse than showing it in one language.
 */

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100'

const STATUS_TONE = {
  // appointment states
  confirmed: 'bg-brand-50 text-brand-800 ring-brand-200',
  completed: 'bg-mint-50 text-mint-800 ring-mint-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
  requested: 'bg-slate-100 text-slate-600 ring-slate-200',
  // notification states
  sent: 'bg-mint-50 text-mint-800 ring-mint-200',
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  skipped: 'bg-slate-100 text-slate-600 ring-slate-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  // token states
  waiting: 'bg-amber-50 text-amber-800 ring-amber-200',
  called: 'bg-brand-50 text-brand-800 ring-brand-200',
  in_consult: 'bg-brand-600 text-white ring-brand-700',
  done: 'bg-mint-50 text-mint-800 ring-mint-200',
}

/** Why a notification was not delivered, in words a receptionist can act on. */
const SKIP_REASON = {
  NO_CONTACT: 'No mobile number on file',
  UNVERIFIED_NUMBER: 'Number not verified yet',
  NO_CONSENT: 'Consent not recorded',
  NOTIFICATIONS_OFF: 'Doctor has alerts switched off',
  NO_DESK_PHONE: 'NOTIFY_DESK_PHONE is not configured',
  APPOINTMENT_GONE: 'Appointment no longer exists',
}

function Pill({ status, label }) {
  return (
    <span
      className={cx(
        'label-caps rounded-lg px-2 py-0.5 ring-1 ring-inset',
        STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
      )}
    >
      {label ?? status}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Sign in
 * ------------------------------------------------------------------ */
function SignIn({ onSignedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // A doctor account's username starts with 'doctor' by convention, and the
      // server keys the real distinction on doctor_id. Declaring 'doctor' here
      // lets a consultant sign in on the same form as reception.
      const as = /^doctor/i.test(username.trim()) ? 'doctor' : 'staff'
      const data = await api.desk.signIn(username.trim(), password, as)
      onSignedIn(data.staff)
    } catch (err) {
      setError(err.code === 'INVALID_CREDENTIALS' ? 'Incorrect username or password.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl text-slate-900">Reception desk</h1>
      <p className="mt-2 text-sm text-slate-600">Staff sign-in required.</p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          className={inputClass}
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-70"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Sign in
        </button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Contact editor — one row per doctor
 * ------------------------------------------------------------------ */
function ContactRow({ contact, onSaved }) {
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async (patch) => {
    setBusy(true)
    setError(null)
    try {
      await api.desk.saveContact(contact.doctorId, patch)
      setPhone('')
      setNote('')
      await onSaved()
    } catch (err) {
      setError(err.message || errorKeyFor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-slate-200 px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{contact.name.en}</p>
          <p className="text-xs text-slate-500">
            {contact.phoneHint ?? 'No number on file'}
            {contact.verified && ' · verified'}
            {contact.consented && ' · consent recorded'}
          </p>
        </div>

        <span
          className={cx(
            'label-caps rounded-lg px-2 py-0.5 ring-1 ring-inset',
            contact.contactable
              ? 'bg-mint-50 text-mint-800 ring-mint-200'
              : 'bg-amber-50 text-amber-800 ring-amber-200',
          )}
        >
          {contact.contactable ? 'Reachable' : 'Not reachable'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className={cx(inputClass, 'w-40')}
          placeholder="10-digit mobile"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
        />
        <button
          type="button"
          disabled={busy || phone.length !== 10}
          onClick={() => save({ phone })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Save number
        </button>

        {contact.phoneHint && !contact.verified && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ verified: true })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
          >
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Mark verified
          </button>
        )}

        {contact.phoneHint && !contact.consented && (
          <>
            <input
              className={cx(inputClass, 'w-56')}
              placeholder="How consent was obtained"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || note.trim().length < 3}
              onClick={() => save({ consented: true, consentNote: note.trim() })}
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
            >
              Record consent
            </button>
          </>
        )}

        {contact.contactable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ notifySms: !contact.notifySms })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {contact.notifySms ? 'Pause alerts' : 'Resume alerts'}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}


/* ------------------------------------------------------------------ *
 * Queue control — the doctor's own sitting
 * ------------------------------------------------------------------ */
function ScheduleRow({ doctor, onSaved }) {
  const [days, setDays] = useState(doctor.days ?? [])
  const [form, setForm] = useState({
    morningStart: doctor.sessions.morning?.[0] ?? '',
    morningEnd: doctor.sessions.morning?.[1] ?? '',
    eveningStart: doctor.sessions.evening?.[0] ?? '',
    eveningEnd: doctor.sessions.evening?.[1] ?? '',
    fee: doctor.fee ?? '',
    feeReview: doctor.feeReview ?? '',
    room: doctor.room ?? '',
    regNo: doctor.regNo ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async (goLive) => {
    setBusy(true)
    setError(null)
    try {
      await api.desk.saveDoctor(doctor.id, {
        days,
        morningStart: form.morningStart || null,
        morningEnd: form.morningEnd || null,
        eveningStart: form.eveningStart || null,
        eveningEnd: form.eveningEnd || null,
        fee: form.fee === '' ? null : Number(form.fee),
        feeReview: form.feeReview === '' ? null : Number(form.feeReview),
        room: form.room || null,
        regNo: form.regNo.trim() || null,
        ...(goLive ? { bookingMode: 'live' } : {}),
      })
      await onSaved()
    } catch (err) {
      setError(err.message || err.code)
    } finally {
      setBusy(false)
    }
  }

  const live = doctor.bookingMode === 'live'

  return (
    <div className="border-t border-slate-200 px-4 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{doctor.name.en}</p>
          <p className="text-xs text-slate-500">{doctor.specialization.en}</p>
        </div>
        <span
          className={cx(
            'label-caps rounded-lg px-2 py-0.5 ring-1 ring-inset',
            live ? 'bg-mint-50 text-mint-800 ring-mint-200' : 'bg-amber-50 text-amber-800 ring-amber-200',
          )}
        >
          {live ? 'Bookable' : 'Callback only'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {DAYS.map((d) => (
          <button
            key={d.i}
            type="button"
            onClick={() => setDays((list) => (list.includes(d.i) ? list.filter((x) => x !== d.i) : [...list, d.i]))}
            className={cx(
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
              days.includes(d.i)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-600',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-6">
        {[
          ['morningStart', 'Morning from'], ['morningEnd', 'to'],
          ['eveningStart', 'Evening from'], ['eveningEnd', 'to'],
        ].map(([key, label]) => (
          <label key={key} className="text-xs text-slate-500">
            {label}
            <input
              type="time"
              className={cx(inputClass, 'mt-1')}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="text-xs text-slate-500">
          Fee ₹
          <input
            type="number" min="0" className={cx(inputClass, 'mt-1')}
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
          />
        </label>
        <label className="text-xs text-slate-500">
          Room
          <input
            className={cx(inputClass, 'mt-1')} value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />
        </label>
      </div>

      {/* Shown publicly beside the doctor's qualification. Left blank rather
          than guessed — an unverified registration number is worse than none. */}
      <label className="mt-2 block text-xs text-slate-500">
        Medical registration number{' '}
        {!doctor.regNo && <span className="font-semibold text-amber-700">— not on file</span>}
        <input
          className={cx(inputClass, 'mt-1 max-w-xs')}
          value={form.regNo}
          placeholder="e.g. TN 12345"
          onChange={(e) => setForm({ ...form, regNo: e.target.value })}
        />
      </label>

      {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button" disabled={busy} onClick={() => save(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Save
        </button>
        {!live && (
          <button
            type="button" disabled={busy} onClick={() => save(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Save and open booking
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Book for a caller
 * ------------------------------------------------------------------ */
function BookForPatient({ doctors, onBooked, prefill, onClearPrefill }) {
  /*
   * Two kinds of prefill arrive here. A callback request carries an
   * appointment id and is *converted* in place. A follow-up carries only the
   * patient's details and needs a normal new booking — treating it as a
   * conversion would try to convert a null id.
   */
  const isConversion = Boolean(prefill?.id)
  const [doctorId, setDoctorId] = useState(prefill?.doctorId ?? '')
  const [date, setDate] = useState(todayKey())
  const [slots, setSlots] = useState([])
  const [slot, setSlot] = useState('')
  const [form, setForm] = useState({
    name: prefill?.patient?.name ?? '', age: prefill?.patient?.age ?? '',
    phone: prefill?.patient?.phone ?? '', gender: prefill?.patient?.gender ?? '',
    reason: prefill?.patient?.reason ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!doctorId || !date) return setSlots([])
    let alive = true
    api.desk.freeSlots(doctorId, date)
      .then((d) => alive && setSlots(d.slots))
      .catch(() => alive && setSlots([]))
    return () => { alive = false }
  }, [doctorId, date])

  const submit = async () => {
    if (!isConversion && !isValidPhone(form.phone)) {
      setError('That does not look like a phone number. Use a 10-digit Indian mobile, or a full international number with its country code (for example +44 7911 123456).')
      return
    }
    setBusy(true); setError(null)
    try {
      const payload = {
        doctorId, date, slot,
        patient: { ...form, age: Number(form.age) },
      }
      const data = isConversion
        ? await api.desk.convert(prefill.id, { date, slot })
        : await api.desk.bookFor(payload)
      setDone(data.appointment)
      onClearPrefill?.()
      await onBooked()
    } catch (err) {
      setError(err.message || err.code)
    } finally {
      setBusy(false)
    }
  }

  const live = doctors.filter((d) => d.bookingMode === 'live')

  return (
    <div className="mt-6 space-y-4">
      {isConversion && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Converting callback <strong className="font-mono">{prefill.id}</strong> for{' '}
          {prefill.patient.name}. Pick a time to confirm it.
        </p>
      )}
      {prefill && !isConversion && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Booking a follow-up for {prefill.patient.name}. Check their age and gender below —
          they are needed to complete the booking.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Doctor
            <select className={cx(inputClass, 'mt-1')} value={doctorId} disabled={isConversion}
              onChange={(e) => { setDoctorId(e.target.value); setSlot('') }}>
              <option value="">Select…</option>
              {live.map((d) => (
                <option key={d.id} value={d.id}>{d.name.en} — ₹{d.fee}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Date
            <input type="date" className={cx(inputClass, 'mt-1')} value={date}
              onChange={(e) => { setDate(e.target.value); setSlot('') }} />
          </label>
        </div>

        {live.length === 0 && (
          <p className="mt-2 text-xs text-amber-800">
            No doctor has a published schedule yet — set one under Schedules first.
          </p>
        )}

        {doctorId && (
          <div className="mt-3">
            <p className="label-caps text-slate-500">Free slots</p>
            {slots.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Nothing free on this date.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button key={s.slot} type="button" onClick={() => setSlot(s.slot)}
                    className={cx(
                      'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                      slot === s.slot
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    )}>
                    {formatTime(s.slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isConversion && (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <input className={inputClass} placeholder="Patient name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {/*
            Keeps exactly what was typed.
            This used to strip everything but digits and take the first ten,
            which quietly turned a foreign number into a plausible Indian one:
            "+44 7911 123456" was stored as "4479111234". Ten digits, looks
            right, belongs to nobody — and reception only finds out when the
            patient does not answer. Now the field shows what was entered and
            says plainly when it is not a number this app can use.
          */}
          <input className={inputClass} placeholder="Mobile — India or +country code" inputMode="tel" maxLength={20}
            value={form.phone}
            aria-invalid={form.phone !== '' && !isValidPhone(form.phone)}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Age" value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })} />
          <select className={inputClass} value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Gender…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input className={cx(inputClass, 'sm:col-span-2')} placeholder="Reason for visit" value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-rose-700">{error}</p>}
      {done && (
        /* The moment reception is still on the call is the moment to send it,
           so the button is here rather than only back on the Today list. */
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint-200 bg-mint-50 px-4 py-3">
          <p className="text-sm text-mint-900">
            Booked — reference <strong className="font-mono">{done.id}</strong>. Read this out to
            the caller, and send it to them in writing.
          </p>
          <TellPatient
            appointment={done}
            doctorName={getDoctor(done.doctorId)?.name.en ?? done.doctorId}
          />
        </div>
      )}

      <button type="button" onClick={submit} disabled={busy || !doctorId || !slot}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-40">
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {isConversion ? 'Confirm this appointment' : 'Book appointment'}
      </button>
    </div>
  )
}


/* ------------------------------------------------------------------ *
 * Repeat prescription decisions
 * ------------------------------------------------------------------ */
function Repeats({ onChanged }) {
  const [rows, setRows] = useState([])
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setRows((await api.clinical.pendingRepeats()).repeats)
    } catch (err) {
      setError(err.message || err.code)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (id, approve) => {
    setBusy(id)
    setError(null)
    try {
      await api.clinical.decideRepeat(id, approve, notes[id] ?? '')
      await load()
      await onChanged?.()
    } catch (err) {
      setError(err.message || err.code)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-6">
      <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Approving issues a <strong>new</strong> prescription dated today; the original is left
        untouched. A decline needs a reason, which the patient sees.
      </p>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Nothing waiting for a decision.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="border-t border-slate-200 px-4 py-4 first:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {r.patientName || 'Unnamed patient'}
                </p>
                <a href={`tel:${r.patientPhone}`} className="font-mono text-xs text-brand-700 hover:underline">
                  {r.patientPhone}
                </a>
              </div>
              {r.diagnosis && <p className="mt-0.5 text-xs text-slate-500">{r.diagnosis}</p>}
              <p className="mt-2 text-sm text-slate-700">{r.items.join(' · ')}</p>
              {r.patientNote && (
                <p className="mt-1 text-sm text-slate-600">“{r.patientNote}”</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className={cx(inputClass, 'w-72')}
                  placeholder="Note to the patient (required to decline)"
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, true)}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
                >
                  Approve and re-issue
                </button>
                <button
                  type="button"
                  disabled={busy === r.id || !(notes[r.id] ?? '').trim()}
                  onClick={() => decide(r.id, false)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Follow-ups due — a call list, not a reminder nobody sends
 * ------------------------------------------------------------------ */
function Followups({ onBookFor }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    api.clinical.followups().then((d) => setRows(d.followups)).catch(() => setRows([]))
  }, [])

  return (
    <div className="mt-6">
      <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Patients a doctor asked to come back, who have not been seen since. Due within seven days,
        overdue first.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Nobody is due a follow-up.</p>
        ) : (
          rows.map((r) => (
            <div key={r.prescriptionId} className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 first:border-t-0">
              <span
                className={cx(
                  'label-caps w-20 rounded-lg px-2 py-0.5 text-center ring-1 ring-inset',
                  r.overdue
                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                    : 'bg-amber-50 text-amber-800 ring-amber-200',
                )}
              >
                {r.overdue ? 'overdue' : 'due'}
              </span>
              <span data-numeric className="w-24 text-sm text-slate-700">{r.dueOn}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                {r.patientName || 'Unnamed patient'}
              </span>
              <span className="hidden text-xs text-slate-500 sm:inline">{r.diagnosis}</span>
              <a href={`tel:${r.patientPhone}`} className="font-mono text-xs text-brand-700 hover:underline">
                {r.patientPhone}
              </a>
              <button
                type="button"
                onClick={() => onBookFor(r)}
                className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
              >
                Book them in
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * A doctor's own settings
 * ------------------------------------------------------------------ */
/**
 * Approve / Seen / Cancel.
 *
 * Only the moves that are legal from the row's current state are rendered, so
 * the desk cannot ask for a transition the server will refuse. Each button
 * disables itself while its own request is in flight — not the whole row, so
 * one slow request does not freeze the rest of the list.
 */
function StatusActions({ appointment, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const run = async (action) => {
    setBusy(action)
    setError(null)
    try {
      const { appointment: updated } = await api.desk.setStatus(appointment.id, action)
      onChanged(updated)
    } catch (e) {
      setError(e.message || e.code)
    } finally {
      setBusy(null)
    }
  }

  const can = {
    approve: appointment.status === 'pending',
    complete: appointment.status === 'pending' || appointment.status === 'confirmed',
    cancel: ['pending', 'confirmed', 'requested'].includes(appointment.status),
  }
  const buttons = [
    { action: 'approve', label: 'Approve', icon: Check, tone: 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100' },
    { action: 'complete', label: 'Seen', icon: CircleCheck, tone: 'border-mint-300 bg-mint-50 text-mint-800 hover:bg-mint-100' },
    { action: 'cancel', label: 'Cancel', icon: X, tone: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
  ].filter((b) => can[b.action])

  if (buttons.length === 0) {
    return <Pill status={appointment.status} label={APPOINTMENT_LABEL[appointment.status]} />
  }

  return (
    <div className="flex items-center gap-1.5">
      {buttons.map(({ action, label, icon: Icon, tone }) => (
        <button
          key={action}
          type="button"
          onClick={() => run(action)}
          disabled={busy !== null}
          title={error ?? undefined}
          className={cx(
            'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50',
            tone,
          )}
        >
          {busy === action ? (
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <Icon className="size-3" aria-hidden="true" />
          )}
          {label}
        </button>
      ))}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

/** One line for an appointment, used by both Today and New requests. */
function AppointmentRow({ appointment: a, onChanged }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 first:border-t-0">
      <Clock className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span data-numeric className="w-20 text-sm font-semibold text-slate-900">
        {a.slot ? formatTime(a.slot) : '—'}
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-700">
        {getDoctor(a.doctorId)?.name.en ?? a.doctorId}
      </span>
      <span className="text-sm text-slate-600">{a.patient.name}</span>
      <a href={`tel:${a.patient.phone}`} className="font-mono text-xs text-brand-700 hover:underline">
        {a.patient.phone}
      </a>
      <span className="font-mono text-xs text-slate-400">{a.id}</span>
      <TellPatient appointment={a} doctorName={getDoctor(a.doctorId)?.name.en ?? a.doctorId} />
      <StatusActions appointment={a} onChanged={onChanged} />
    </div>
  )
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* The same rule the server enforces, so the desk cannot submit what the API
   will refuse. Indian mobiles only — a number outside that set is a real
   limitation to state, not something to bend a foreign number into. */


/**
 * Set the same consulting pattern on a group of doctors in one go.
 *
 * The alternative is opening 22 rows and typing the same four times into
 * each, which is exactly the job that stays unfinished and leaves most of the
 * roster unbookable. Consultants at one hospital largely share OPD hours, so
 * this is the shape the work actually has.
 */
function BulkSchedule({ doctors, onDone }) {
  const [picked, setPicked] = useState(() => new Set())
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6])
  const [form, setForm] = useState({
    morningStart: '10:00', morningEnd: '13:00',
    eveningStart: '17:00', eveningEnd: '20:00',
    fee: '400',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const toggle = (id) =>
    setPicked((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const apply = async (goLive) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.desk.bulkSchedule({
        doctorIds: [...picked],
        days,
        morningStart: form.morningStart || null,
        morningEnd: form.morningEnd || null,
        eveningStart: form.eveningStart || null,
        eveningEnd: form.eveningEnd || null,
        fee: form.fee === '' ? null : Number(form.fee),
        feeReview: form.feeReview === '' ? null : Number(form.feeReview),
        goLive,
      })
      setResult(res)
      setPicked(new Set())
      await onDone()
    } catch (e) {
      setError(e.message || e.code)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
      <p className="text-sm font-bold text-slate-900">Set several doctors at once</p>
      <p className="mt-1 text-xs text-slate-600">
        Tick everyone who keeps these hours, set the pattern, and open booking for all of them
        together. You can still fine-tune any individual doctor below afterwards.
      </p>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS.map((label, index) => {
          const on = days.includes(index)
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => setDays((d) => (on ? d.filter((x) => x !== index) : [...d, index]))}
              className={cx(
                'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                on
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {[
          ['morningStart', 'Morning from'],
          ['morningEnd', 'Morning to'],
          ['eveningStart', 'Evening from'],
          ['eveningEnd', 'Evening to'],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="label-caps text-slate-500">{label}</span>
            <input
              type="time"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className={cx(inputClass, 'mt-1')}
            />
          </label>
        ))}
        <label className="block">
          <span className="label-caps text-slate-500">Fee ₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={form.fee}
            onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
            className={cx(inputClass, 'mt-1')}
          />
        </label>
      </div>

      <div className="mt-3.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {doctors.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            Every doctor is already open for booking.
          </p>
        ) : (
          doctors.map((d) => (
            <label
              key={d.id}
              className="flex cursor-pointer items-center gap-2.5 border-t border-slate-100 px-3 py-2 first:border-t-0 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={picked.has(d.id)}
                onChange={() => toggle(d.id)}
                className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{d.name.en}</span>
              <span className="truncate text-xs text-slate-500">{d.specialization.en}</span>
            </label>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => setPicked(new Set(doctors.map((d) => d.id)))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50"
        >
          Select all {doctors.length}
        </button>
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => apply(false)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Save timings only
        </button>
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => apply(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />}
          Open booking for {picked.size || 0}
        </button>
        {error && <span className="text-xs font-semibold text-rose-600">{error}</span>}
        {result && (
          <span className="text-xs font-semibold text-mint-700">
            {result.applied.length} updated
            {result.skipped.length > 0 && ` · ${result.skipped.length} skipped (no fee set)`}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Change your own password.
 *
 * Open to every desk account, not only doctors — reception needs it just as
 * much, and an app where changing a password means asking someone with server
 * access is one where nobody ever changes theirs.
 *
 * The current password is required, so an unattended terminal cannot be used
 * to lock the real owner out.
 */
function ChangePassword({ open, onClose, username }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const close = () => {
    setForm({ current: '', next: '', confirm: '' })
    setError(null)
    setDone(null)
    onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)

    // Checked here as well as on the server so a typo costs a moment rather
    // than a round trip and a rate-limit slot.
    if (form.next.length < 12) {
      setError('Use at least 12 characters.')
      return
    }
    if (form.next !== form.confirm) {
      setError('The two new passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const result = await api.desk.changePassword(form.current, form.next)
      setDone(result)
      setForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      setError(e.message || e.code)
    } finally {
      setBusy(false)
    }
  }

  const field = (key, label, autoComplete) => (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={cx(inputClass, 'mt-1')}
      />
    </label>
  )

  return (
    <Modal open={open} onClose={close} title="Change your password" subtitle={username}>
      {done ? (
        <div>
          <p className="flex items-start gap-2 text-sm text-mint-800">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Password changed.
              {done.otherSessionsEnded > 0 &&
                ` ${done.otherSessionsEnded} other device${done.otherSessionsEnded === 1 ? ' was' : 's were'} signed out.`}
            </span>
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {field('current', 'Your current password', 'current-password')}
          {field('next', 'New password — at least 12 characters', 'new-password')}
          {field('confirm', 'New password again', 'new-password')}

          <p className="text-xs leading-relaxed text-slate-500">
            Signing in on other devices will stop working. This one stays signed in.
          </p>

          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Change password
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
export default function Desk({ onSignedOut }) {
  const [staff, setStaff] = useState(undefined) // undefined = still checking
  const [tab, setTab] = useState(null) // resolved once we know who signed in
  const [data, setData] = useState({ appointments: [], notifications: [], contacts: [], doctors: [], counts: {} })
  const [converting, setConverting] = useState(null)
  const [tourOpen, setTourOpen] = useState(false)
  const closeTour = useCallback(() => setTourOpen(false), [])
  /*
   * Recomputed when the tour opens, not on every render.
   *
   * usableSteps reads the DOM to drop steps for controls this user does not
   * have, so it has to run when the tour starts — but rebuilding the array on
   * every render made each step object new, which restarted the tour's
   * positioning effect continuously. That was the lag.
   */
  const deskTourSteps = useMemo(() => (tourOpen ? usableSteps(deskTour) : []), [tourOpen])
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [liveToast, setLiveToast] = useState(null) // { text, id }
  const [arrivals, setArrivals] = useState(0) // new since this tab was last opened
  const [sound, setSound] = useState(() => soundEnabled())
  const [notify, setNotify] = useState(() => notifyEnabled())
  const toastTimer = useRef(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api.desk
      .me(controller.signal)
      .then((d) => setStaff(d.staff))
      .catch(() => setStaff(null))
    return () => controller.abort()
  }, [])

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [appts, notes, contacts, doctors] = await Promise.all([
        api.desk.appointments({}),
        api.desk.notifications(),
        api.desk.contacts(),
        api.desk.doctors(),
      ])
      setData({
        appointments: appts.appointments,
        notifications: notes.notifications,
        counts: notes.counts,
        contacts: contacts.contacts,
        doctors: doctors.doctors,
      })
    } catch {
      /* surfaced by the empty states */
    } finally {
      setBusy(false)
    }
  }, [])

  /** Replaces one appointment in place after a status change — no full reload. */
  const replaceAppointment = useCallback((updated) => {
    setData((d) => ({
      ...d,
      appointments: d.appointments.map((a) => (a.id === updated.id ? updated : a)),
    }))
  }, [])

  const flash = useCallback((text) => {
    setLiveToast({ text, id: `${text}-${performance.now()}` })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setLiveToast(null), 6000)
  }, [])

  /*
   * The live feed only ever says "something changed" — the list itself is
   * re-read from the API, so a duplicated or dropped event cannot leave the
   * screen disagreeing with the database.
   */
  const onLive = useCallback(
    ({ event, payload }) => {
      refresh()
      if (event === 'appointment.created') {
        setArrivals((n) => n + 1)
        const text = payload?.patientName
          ? `New booking — ${payload.patientName}${payload.slot ? ` at ${formatTime(payload.slot)}` : ''}`
          : 'New booking just came in'
        flash(text)
        // A screen nobody is watching is not a notification.
        alertDesk('New booking', text)
      } else if (event === 'appointment.callback') {
        setArrivals((n) => n + 1)
        const text = `Callback requested — ${payload?.patientName ?? 'a patient'}`
        flash(text)
        alertDesk('Callback requested', text)
      } else if (event === 'appointment.cancelled') {
        flash(`Cancelled — ${payload?.patientName ?? 'a patient'}`)
      }
    },
    [refresh, flash],
  )

  const connection = useLiveDesk(Boolean(staff), onLive)

  // How many reviews are waiting, so the tab can carry a badge without the
  // moderation panel having to be open.
  const [pendingReviews, setPendingReviews] = useState(0)
  useEffect(() => {
    if (!staff) return undefined
    const controller = new AbortController()
    api.desk
      .reviews('pending', controller.signal)
      .then((data) => setPendingReviews(data.counts?.pending ?? 0))
      .catch(() => {})
    return () => controller.abort()
  }, [staff])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // Opening either list is what counts as "seen"; the badge is a nudge, not a
  // record, so it resets as soon as it has done its job.
  useEffect(() => {
    if (tab === 'today' || tab === 'requests') setArrivals(0)
  }, [tab])

  useEffect(() => {
    if (staff) refresh()
  }, [staff, refresh])

  // A doctor opens on their queue; reception opens on today's list.
  useEffect(() => {
    if (staff && tab === null) setTab('today')
  }, [staff, tab])

  if (staff === undefined) {
    return (
      <div className="grid place-items-center py-24">
        <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    )
  }
  if (!staff) return <SignIn onSignedIn={setStaff} />

  /*
   * A doctor sees their own day, not the reception desk. Doctor accounts are
   * staff rows with a doctor_id set; reception and the manager have none. The
   * server enforces the same split on every endpoint, so this is presentation,
   * not the security boundary.
   */
  if (staff.doctorId) {
    return <DoctorPortal staff={staff} onSignedOut={() => { setStaff(null); onSignedOut?.() }} />
  }

  const today = todayKey()
  const todays = data.appointments.filter((a) => a.date === today && a.status !== 'cancelled')
  // Anything a patient booked online that nobody has approved yet, oldest
  // first — a booking that has been waiting longest is the one to deal with.
  const pending = data.appointments
    .filter((a) => a.status === 'pending')
    .sort((a, b) => `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`))
  const callbacks = data.appointments.filter((a) => a.status === 'requested')
  const undelivered = data.notifications.filter(
    (n) => n.status === 'skipped' || n.status === 'failed',
  )

  const schedulable = data.doctors.filter((d) => d.id !== 'joseph-c-mathuram')
  const liveDoctors = schedulable.filter((d) => d.bookingMode === 'live')
  const notLive = schedulable.filter((d) => d.bookingMode !== 'live')
  const missingRegNo = schedulable.filter((d) => !d.regNo)

  const isDoctor = Boolean(staff.doctorId)

  const tabs = [
    /*
     * No doctor side any more.
     *
     * The hospital runs Klinique, which already has a physician portal and a
     * reception desk. A second place to write prescriptions and read patient
     * history meant two records that could disagree. This screen now does one
     * job: showing reception the bookings arriving from the public site.
     */
    { id: 'transfer', label: 'To enter in Klinique', count: 0 },
    { id: 'klinique', label: 'Klinique', count: 0 },
    { id: 'requests', label: 'New requests', count: pending.length },
    { id: 'today', label: 'Today', count: todays.length },
    { id: 'book', label: 'Book for a caller', count: 0 },
    { id: 'callbacks', label: 'To call back', count: callbacks.length },
    { id: 'schedules', label: 'Schedules', count: data.doctors.filter((d) => d.bookingMode !== 'live').length },
    { id: 'repeats', label: 'Repeat requests', count: 0 },
    { id: 'followups', label: 'Follow-ups due', count: 0 },
    { id: 'alerts', label: 'Alerts', count: undelivered.length },
    { id: 'reviews', label: 'Reviews', count: pendingReviews },
    { id: 'contacts', label: 'Doctor contacts', count: data.contacts.filter((c) => !c.contactable).length },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-slate-900">Reception desk</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Signed in as {staff.username} · {staff.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Says out loud whether this screen is still hearing from the
              server. A desk that has quietly stopped updating looks exactly
              like a quiet morning, which is how a booking gets missed. */}
          <span
            title={
              connection === 'live'
                ? 'Connected — new bookings appear here by themselves'
                : 'Not streaming; checking for new bookings every 45 seconds'
            }
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold ring-1 ring-inset',
              connection === 'live'
                ? 'bg-mint-50 text-mint-800 ring-mint-200'
                : 'bg-amber-50 text-amber-800 ring-amber-200',
            )}
          >
            <Radio className={cx('size-3.5', connection === 'live' && 'animate-pulse')} aria-hidden="true" />
            {connection === 'live' ? 'Live' : 'Checking'}
            {arrivals > 0 && (
              <span className="rounded-lg bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                +{arrivals}
              </span>
            )}
          </span>
          {/* Both must be switched on by a human: browsers refuse sound and
              notifications until asked, and a chime is not always wanted in a
              waiting room. */}
          <button
            type="button"
            onClick={() => {
              const next = !sound
              setSound(next)
              setSoundEnabled(next)
              if (next) chimeNow()
            }}
            title={sound ? 'Chime on — click to silence' : 'Silent — click to hear new bookings'}
            aria-pressed={sound}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition',
              sound
                ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                : 'border-slate-300 text-slate-500 hover:bg-slate-50',
            )}
          >
            {sound ? <Volume2 className="size-3.5" aria-hidden="true" /> : <VolumeX className="size-3.5" aria-hidden="true" />}
            {sound ? 'Chime' : 'Silent'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (notify) {
                disableNotify()
                setNotify(false)
                return
              }
              setNotify(await requestNotifyPermission())
            }}
            title={
              notify
                ? 'Desktop alerts on — click to stop'
                : 'Show a desktop alert even when this tab is behind another window'
            }
            aria-pressed={notify}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition',
              notify
                ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                : 'border-slate-300 text-slate-500 hover:bg-slate-50',
            )}
          >
            {notify ? <Bell className="size-3.5" aria-hidden="true" /> : <BellOff className="size-3.5" aria-hidden="true" />}
            Alerts
          </button>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <Compass className="size-3.5" aria-hidden="true" />
            Show me around
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={cx('size-3.5', busy && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <KeyRound className="size-3.5" aria-hidden="true" />
            Password
          </button>
          <button
            type="button"
            onClick={() =>
              api.desk.signOut().then(() => {
                setStaff(null)
                // Leaving someone facing a sign-in form reads as "that failed,
                // try again". Send them back to the public site instead.
                onSignedOut?.()
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      {/* Announced politely rather than assertively: it is useful news, not
          an alarm, and a screen reader should not cut off whatever the person
          at the counter is already reading. */}
      <div aria-live="polite" className="sr-only">
        {liveToast?.text}
      </div>
      {liveToast && (
        <div className="fixed bottom-5 end-5 z-50 max-w-sm animate-fade-up">
          <button
            type="button"
            onClick={() => { setLiveToast(null); setTab('requests') }}
            className="flex w-full items-start gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3.5 text-start shadow-xl transition hover:border-brand-400"
          >
            <BellRing className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{liveToast.text}</span>
              <span className="mt-0.5 block text-xs text-slate-500">Tap to open new requests</span>
            </span>
          </button>
        </div>
      )}

      <Assistant
        mode="desk"
        desk={{ isDoctor, username: staff.username }}
        onTab={setTab}
      />

      <ChangePassword
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        username={staff.username}
      />

      <Tour
        steps={deskTourSteps}
        open={tourOpen}
        onClose={closeTour}
        onNavigate={noNavigate}
      />

      <div role="tablist" className="mt-8 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            data-tour={`desk-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              tab === item.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {item.label}
            {item.count > 0 && (
              <span className="rounded-lg bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>


      {tab === 'repeats' && <Repeats onChanged={refresh} />}
      {tab === 'followups' && (
        <Followups
          onBookFor={(r) => {
            setConverting({
              id: null,
              doctorId: r.doctorId,
              patient: { name: r.patientName, phone: r.patientPhone, reason: `Follow-up — ${r.diagnosis}` },
            })
            setTab('book')
          }}
        />
      )}

      {tab === 'book' && (
        <BookForPatient
          doctors={data.doctors}
          onBooked={refresh}
          prefill={converting}
          onClearPrefill={() => setConverting(null)}
        />
      )}

      {tab === 'schedules' && (
        <div className="mt-6 space-y-4">
          {/* Says plainly how far off a fully bookable roster is. Until this
              reads 25 of 25, most of the app cannot be used by a patient. */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                <span data-numeric>{liveDoctors.length}</span> of{' '}
                <span data-numeric>{schedulable.length}</span> doctors can be booked online
              </p>
              <p className="text-xs text-slate-500">
                {notLive.length === 0
                  ? 'The whole roster is bookable.'
                  : `${notLive.length} still take callback requests only.`}
              </p>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={liveDoctors.length}
              aria-valuemin={0}
              aria-valuemax={schedulable.length}
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${schedulable.length ? (liveDoctors.length / schedulable.length) * 100 : 0}%`,
                }}
              />
            </div>
            {missingRegNo.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{missingRegNo.length} doctors have no medical
                  registration number on file.</span>{' '}
                  Their qualifications are shown publicly, so add the numbers from the hospital's
                  records — open a doctor below to enter one.
                </span>
              </p>
            )}
          </div>

          {notLive.length > 0 && <BulkSchedule doctors={notLive} onDone={refresh} />}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {schedulable.map((d) => (
              <ScheduleRow key={d.id} doctor={d} onSaved={refresh} />
            ))}
          </div>
        </div>
      )}

      {/* ---------------- New requests ---------------- */}
      {tab === 'transfer' && <KliniqueTransfer />}
      {tab === 'klinique' && <KliniquePortal />}
      {tab === 'requests' && (
        <div className="mt-6">
          <p className="text-sm text-slate-600">
            Booked online and waiting for you. The slot is already held, so nobody else can take
            it — approving simply tells the patient they are expected.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {pending.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">
                Nothing waiting. New bookings land here on their own.
              </p>
            ) : (
              pending.map((a) => (
                <div key={a.id}>
                  <AppointmentRow appointment={a} onChanged={replaceAppointment} />
                  <p className="px-4 pb-3 -mt-1 text-xs text-slate-500">
                    {a.date} · {a.patient.reason || 'No reason given'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- Today ---------------- */}
      {tab === 'today' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {todays.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              No appointments booked for today.
            </p>
          ) : (
            todays.map((a) => (
              <AppointmentRow key={a.id} appointment={a} onChanged={replaceAppointment} />
            ))
          )}
        </div>
      )}

      {/* ---------------- Callbacks ---------------- */}
      {tab === 'callbacks' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {callbacks.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              Nobody is waiting for a call back.
            </p>
          ) : (
            callbacks.map((a) => (
              <div key={a.id} className="border-t border-slate-200 px-4 py-3.5 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {a.patient.name} · {a.patient.age}
                  </p>
                  <a
                    href={`tel:${a.patient.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
                  >
                    <Phone className="size-3.5" aria-hidden="true" />
                    {a.patient.phone}
                  </a>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Wants {getDoctor(a.doctorId)?.name.en ?? a.doctorId} — {a.patient.reason}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setConverting(a); setTab('book') }}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
                  >
                    Give them a time
                  </button>
                  <span className="font-mono text-xs text-slate-400">{a.id}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ---------------- Alerts ---------------- */}
      {tab === 'alerts' && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(data.counts).map(([status, n]) => (
              <span key={status} className="flex items-center gap-1.5 text-xs text-slate-600">
                <Pill status={status} /> {n}
              </span>
            ))}
            <button
              type="button"
              onClick={() => api.desk.drain().then(refresh)}
              className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <BellRing className="size-3.5" aria-hidden="true" />
              Send queued now
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {data.notifications.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">Nothing sent yet.</p>
            ) : (
              data.notifications.slice(0, 40).map((n) => (
                <div key={n.id} className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 first:border-t-0">
                  {n.status === 'sent' ? (
                    <CircleCheck className="size-4 shrink-0 text-mint-600" aria-hidden="true" />
                  ) : n.status === 'failed' ? (
                    <CircleX className="size-4 shrink-0 text-rose-600" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <span className="w-44 text-sm text-slate-700">{n.event}</span>
                  <span className="w-40 text-sm text-slate-600">
                    {n.recipientName ?? n.recipientType}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{n.appointmentId}</span>
                  <span className="ms-auto flex items-center gap-2">
                    {n.lastError && (
                      <span className="text-xs text-slate-500">
                        {SKIP_REASON[n.lastError] ?? n.lastError}
                      </span>
                    )}
                    <Pill status={n.status} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- Reviews ---------------- */}
      {tab === 'reviews' && (
        <div className="mt-6">
          <ReviewModeration onCountChange={setPendingReviews} />
        </div>
      )}

      {/* ---------------- Contacts ---------------- */}
      {tab === 'contacts' && (
        <div className="mt-6">
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            A doctor is only messaged once a number is saved, verified, and consent is recorded.
            All three are required — an unverified or unconsented number is never used.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {data.contacts.map((c) => (
              <ContactRow key={c.doctorId} contact={c} onSaved={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
