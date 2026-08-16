import { GENDERS, HOSPITAL, getDepartment, getDoctor } from '../data/hospital'
import { formatDateLong, formatFee, formatTime } from './schedule'

/**
 * Flattens an appointment into label/value rows in the active language.
 * Shared by the on-screen summary, the text download and the print view.
 */
export function summaryRows(appointment, { t, tl, lang }) {
  const doctor = getDoctor(appointment.doctorId)
  const department = getDepartment(appointment.departmentId)
  const gender = GENDERS.find((g) => g.value === appointment.patient.gender)
  const payment = appointment.payment

  const paymentRows = payment
    ? [
        {
          label: t('pay.status'),
          value:
            payment.status === 'paid'
              ? `${t('pay.paid')} · ${formatFee(payment.amount, lang)}`
              : `${t('pay.pending')} · ${formatFee(payment.amount, lang)}`,
        },
        { label: t('pay.reference'), value: payment.reference },
      ]
    : []

  return [
    { label: t('booking.appointmentId'), value: appointment.id },
    { label: t('field.patient'), value: appointment.patient.name },
    { label: t('field.age'), value: String(appointment.patient.age) },
    { label: t('field.gender'), value: gender ? t(gender.labelKey) : '—' },
    { label: t('field.phone'), value: appointment.patient.phone },
    { label: t('field.department'), value: tl(department.name) },
    { label: t('field.doctor'), value: `${tl(doctor.name)} · ${tl(doctor.specialization)}` },
    ...(doctor.room ? [{ label: t('doctors.room'), value: doctor.room }] : []),
    {
      label: t('field.date'),
      value: appointment.date ? formatDateLong(appointment.date, lang) : t('appt.callbackPending'),
    },
    ...(appointment.slot
      ? [
          {
            label: t('field.time'),
            value: `${formatTime(appointment.slot, lang)} (${
              appointment.session === 'morning' ? t('doctors.morning') : t('doctors.evening')
            })`,
          },
        ]
      : []),
    {
      label: t('field.fee'),
      value: appointment.fee == null ? t('doctors.feeOnRequest') : formatFee(appointment.fee, lang),
    },
    ...paymentRows,
    { label: t('field.reason'), value: appointment.patient.reason },
  ]
}

function buildText(appointment, ctx) {
  const { t } = ctx
  const rows = summaryRows(appointment, ctx)
  const width = Math.max(...rows.map((r) => r.label.length))
  const line = '='.repeat(52)

  return [
    line,
    t('booking.summaryHeading'),
    line,
    ...rows.map((r) => `${r.label.padEnd(width)}  :  ${r.value}`),
    line,
    t('contact.addressLine'),
    `${t('contact.reception')}: ${HOSPITAL.receptionPhone}`,
    `${t('contact.emergencyNumber')}: ${HOSPITAL.emergencyPhone}`,
    line,
    t('booking.successText'),
    '',
  ].join('\n')
}

/** Downloads the appointment slip as a .txt file. */
export function downloadSummary(appointment, ctx) {
  const blob = new Blob([buildText(appointment, ctx)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${appointment.id}-deepan-hospital.txt`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

/** Opens a print-ready appointment slip in a new window. */
export function printSummary(appointment, ctx) {
  const { t, lang } = ctx
  const rows = summaryRows(appointment, ctx)
  const win = window.open('', '_blank', 'width=720,height=900')
  if (!win) return false

  win.document.write(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(appointment.id)} — ${escapeHtml(t('brand.name'))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans Tamil', system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
  .card { max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; }
  header { background: #0284c7; color: #fff; padding: 20px 24px; }
  header h1 { margin: 0; font-size: 20px; }
  header p { margin: 4px 0 0; font-size: 12px; opacity: .9; }
  .id { padding: 16px 24px; background: #f0f9ff; border-bottom: 1px solid #e2e8f0; }
  .id span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .id strong { font-size: 24px; letter-spacing: .08em; color: #0369a1; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 24px; font-size: 13px; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
  td.k { color: #64748b; width: 42%; }
  td.v { font-weight: 600; }
  footer { padding: 16px 24px; font-size: 11px; color: #64748b; background: #f8fafc; }
  @media print { body { padding: 0; } .card { border: none; } }
</style>
</head>
<body>
  <div class="card">
    <header>
      <h1>${escapeHtml(t('brand.name'))}</h1>
      <p>${escapeHtml(t('contact.addressLine'))}</p>
    </header>
    <div class="id">
      <span>${escapeHtml(t('booking.appointmentId'))}</span>
      <strong>${escapeHtml(appointment.id)}</strong>
    </div>
    <table>
      ${rows
        .slice(1)
        .map(
          (r) =>
            `<tr><td class="k">${escapeHtml(r.label)}</td><td class="v">${escapeHtml(r.value)}</td></tr>`,
        )
        .join('')}
    </table>
    <footer>
      ${escapeHtml(t('booking.successText'))}<br>
      ${escapeHtml(t('contact.reception'))}: ${escapeHtml(HOSPITAL.receptionPhone)} ·
      ${escapeHtml(t('contact.emergencyNumber'))}: ${escapeHtml(HOSPITAL.emergencyPhone)}
    </footer>
  </div>
</body>
</html>`)
  win.document.close()
  // document.write is synchronous, so the slip is fully laid out by now.
  win.focus()
  win.print()
  return true
}
