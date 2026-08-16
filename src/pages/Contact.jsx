import { Ambulance, Clock, Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, HOSPITAL } from '../data/hospital'
// Shared with the rest of the app so every number is sanitised the same way.
import { telHref, whatsappHref } from '../lib/schedule'
import Photo from '../components/Photo'

function ContactCard({ icon: Icon, label, value, href, tone }) {
  const Wrapper = href ? 'a' : 'div'
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </span>
        <span className="mt-1 block text-base font-bold break-words text-slate-900">{value}</span>
      </span>
    </Wrapper>
  )
}

export default function Contact() {
  const { t, tl } = useLanguage()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('contact.title')}
        </h1>
        <p className="mt-2.5 text-slate-600">{t('contact.subtitle')}</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContactCard
          icon={Phone}
          label={t('contact.emergencyNumber')}
          value={HOSPITAL.emergencyPhone}
          href={telHref(HOSPITAL.emergencyPhone)}
          tone="bg-rose-50 text-rose-600"
        />
        <ContactCard
          icon={Ambulance}
          label={t('contact.ambulance')}
          value={HOSPITAL.ambulancePhone}
          href={telHref(HOSPITAL.ambulancePhone)}
          tone="bg-rose-50 text-rose-600"
        />
        <ContactCard
          icon={Phone}
          label={t('contact.reception')}
          value={HOSPITAL.receptionPhone}
          href={telHref(HOSPITAL.receptionPhone)}
          tone="bg-brand-50 text-brand-600"
        />
        {/* Only when the hospital has published a WhatsApp number — and
            worth showing, because it is the one route that connects from a
            laptop as well as a phone. */}
        {whatsappHref(HOSPITAL.whatsappPhone) && (
          <ContactCard
            icon={MessageCircle}
            label={t('contact.whatsapp')}
            value={HOSPITAL.whatsappPhone}
            href={whatsappHref(HOSPITAL.whatsappPhone)}
            tone="bg-mint-50 text-mint-600"
          />
        )}
        <ContactCard
          icon={Mail}
          label={t('contact.email')}
          value={HOSPITAL.email}
          href={`mailto:${HOSPITAL.email}`}
          tone="bg-mint-50 text-mint-600"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Address */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MapPin className="size-5 text-brand-600" aria-hidden="true" />
            {t('contact.address')}
          </h2>
          <address className="mt-3 text-slate-700 not-italic">{t('contact.addressLine')}</address>
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
            <Navigation className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t('contact.mapNote')}
          </p>

          {/* Stylised campus map placeholder — no external tiles required. */}
          {/* public/building.jpg — what to look for from the road. */}
          <div className="mt-5 h-44 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-brand-50 via-white to-mint-50">
            <Photo src="/building.jpg" alt={t('contact.mapNote')} className="size-full">
            <svg viewBox="0 0 400 176" className="size-full" aria-hidden="true">
              <g stroke="#cbd5e1" strokeWidth="8" fill="none">
                <path d="M-10 60 H410" />
                <path d="M120 -10 V186" />
              </g>
              <g stroke="#e2e8f0" strokeWidth="3" fill="none">
                <path d="M-10 130 H410" />
                <path d="M280 -10 V186" />
              </g>
              <rect x="150" y="80" width="100" height="62" rx="8" fill="#0284c7" />
              <rect x="166" y="94" width="12" height="12" rx="2" fill="#bae6fd" />
              <rect x="186" y="94" width="12" height="12" rx="2" fill="#bae6fd" />
              <rect x="206" y="94" width="12" height="12" rx="2" fill="#bae6fd" />
              <rect x="226" y="94" width="12" height="12" rx="2" fill="#bae6fd" />
              <path d="M194 116 h12 v8 h8 v12 h-28 v-12 h8 z" fill="#e0f2fe" />
              <circle cx="60" cy="130" r="18" fill="#6ee7b7" opacity="0.6" />
              <circle cx="330" cy="36" r="14" fill="#7dd3fc" opacity="0.6" />
              <text x="200" y="74" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369a1">
                Deepan Hospital
              </text>
            </svg>
            </Photo>
          </div>
        </section>

        {/* Hours */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Clock className="size-5 text-brand-600" aria-hidden="true" />
            {t('contact.hours')}
          </h2>

          <dl className="mt-4 divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-slate-700">{t('contact.opd')}</dt>
              <dd className="text-end text-sm text-slate-600">{t('contact.opdHours')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-slate-700">{t('nav.contact')}</dt>
              <dd className="text-end text-sm text-slate-600">{t('contact.sundayHours')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-rose-700">{t('contact.emergency')}</dt>
              <dd className="text-end text-sm font-semibold text-rose-700">
                {t('contact.emergencyHours')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-slate-700">{t('services.facilitiesTitle')}</dt>
              <dd className="text-end text-sm text-slate-600">{t('contact.pharmacyHours')}</dd>
            </div>
          </dl>

          <h3 className="mt-6 text-sm font-bold text-slate-900">{t('contact.departmentsTitle')}</h3>
          <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2">
            {DEPARTMENTS.map((dept, index) => (
              <li key={dept.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">{tl(dept.name)}</span>
                <span className="shrink-0 font-mono text-xs text-slate-500">
                  ext. {String(101 + index)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
