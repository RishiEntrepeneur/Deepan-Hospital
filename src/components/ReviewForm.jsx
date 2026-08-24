import { useState } from 'react'
import { Star, CheckCircle2, LoaderCircle } from 'lucide-react'
import Modal from './Modal'
import { api } from '../lib/api'
import { useLanguage } from '../i18n/context'
import { getDoctor } from '../data/hospital'
import { cx } from '../lib/cx'

/**
 * Where a patient rates a completed visit. Opens from the appointments list and
 * closes into a thank-you — the review is not shown anywhere until a staff
 * member approves it, so there is nothing to preview here.
 */
export default function ReviewForm({ appointment, onClose, onSubmitted }) {
  const { t, tl } = useLanguage()
  const doctor = appointment ? getDoctor(appointment.doctorId) : null
  const doctorName = doctor ? tl(doctor.name) : null

  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (rating < 1) {
      setError(t('reviews.chooseRating'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.reviews.submit({
        appointmentId: appointment.id,
        rating,
        comment: comment.trim(),
        displayName: name.trim(),
      })
      setDone(true)
      onSubmitted?.(appointment.id)
    } catch (err) {
      // A visit reviewed on another device is not really an error to the
      // patient — treat "already reviewed" as a quiet success.
      if (err.code === 'ALREADY_REVIEWED') {
        setDone(true)
        onSubmitted?.(appointment.id)
      } else {
        setError(err.message || t('reviews.errorGeneric'))
      }
    } finally {
      setBusy(false)
    }
  }

  const shown = hover || rating

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      size="md"
      title={t('reviews.leaveTitle')}
      subtitle={doctorName ? t('reviews.with', { doctor: doctorName }) : t('reviews.leavePrompt')}
    >
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-brand-600" aria-hidden="true" />
          <p className="mt-4 text-base font-semibold text-slate-800">{t('reviews.thanks')}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {t('reviews.close')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              {t('reviews.ratingLabel')}
            </label>
            <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={n === 1 ? t('reviews.star', { n }) : t('reviews.stars', { n })}
                  aria-pressed={rating === n}
                  className="rounded p-1 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <Star
                    className={cx(
                      'size-8',
                      n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="block text-sm font-semibold text-slate-700">
              {t('reviews.commentLabel')}
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder={t('reviews.commentPlaceholder')}
              className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="review-name" className="block text-sm font-semibold text-slate-700">
              {t('reviews.nameLabel')}
            </label>
            <input
              id="review-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t('reviews.namePlaceholder')}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                {t('reviews.submitting')}
              </>
            ) : (
              t('reviews.submit')
            )}
          </button>
        </form>
      )}
    </Modal>
  )
}
