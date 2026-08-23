import { useState } from 'react'
import { Ambulance, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useLanguage } from '../i18n/context'
import { DEPARTMENTS, HOME_DEPARTMENT_IDS, HOSPITAL } from '../data/hospital'
import { NAV_ITEMS } from '../lib/navigation'
import BrandMark from './BrandMark'

const telHref = (number) => `tel:${number.replace(/[^\d+]/g, '')}`

export default function Footer({ onNavigate }) {
  const { t, tl } = useLanguage()
  /* Same fallback as the header: the drawn mark only if the artwork is absent. */
  const [artworkFailed, setArtworkFailed] = useState(false)
  const year = new Date().getFullYear()
  const keyDepartments = DEPARTMENTS.filter((dept) => HOME_DEPARTMENT_IDS.includes(dept.id))

  return (
    <footer className="mt-auto bg-slate-900 text-slate-300 print-hide">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Identity */}
          <div>
            {artworkFailed ? (
              <div className="flex items-center gap-2.5">
                <BrandMark className="size-10 shrink-0" />
                <div>
                  <p className="text-base font-bold text-white">{t('brand.name')}</p>
                  <p className="text-xs text-slate-400">{t('brand.tagline')}</p>
                </div>
              </div>
            ) : (
              <div>
                {/*
                 * The hospital's lockup is dark green on transparent. Against
                 * this near-black footer the word DEEPAN all but vanishes, so
                 * it sits on its own white plate rather than being recoloured
                 * — the logo is the hospital's, not ours to restyle.
                 */}
                <span className="inline-flex rounded-xl bg-white px-3.5 py-2.5">
                  <img
                    src="/logo.png"
                    alt={t('brand.name')}
                    onError={() => setArtworkFailed(true)}
                    className="h-11 w-auto object-contain"
                  />
                </span>
                <p className="mt-2.5 text-xs text-slate-400">{t('brand.tagline')}</p>
              </div>
            )}

            <address className="mt-5 space-y-3 text-sm not-italic">
              <p className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden="true" />
                <span>{t('contact.addressLine')}</span>
              </p>
              <p className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden="true" />
                <a href={`mailto:${HOSPITAL.email}`} className="inline-flex min-h-11 items-center hover:text-white">
                  {HOSPITAL.email}
                </a>
              </p>
            </address>
          </div>

          {/* Quick links */}
          <nav aria-label={t('footer.quickLinks')}>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">
              {t('footer.quickLinks')}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="inline-flex min-h-11 items-center transition hover:text-white"
                  >
                    {t(item.labelKey)}
                  </button>
                </li>
              ))}
              {/* Not in the main nav: a page you go to on purpose. */}
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="inline-flex min-h-11 items-center transition hover:text-white"
                >
                  {t('nav.privacy')}
                </button>
              </li>
            </ul>
          </nav>

          {/* Departments */}
          <nav aria-label={t('footer.departments')}>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">
              {t('footer.departments')}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {keyDepartments.map((dept) => (
                <li key={dept.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('services')}
                    className="inline-flex min-h-11 items-center text-start transition hover:text-white"
                  >
                    {tl(dept.name)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact + hours */}
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">
              {t('footer.reachUs')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>
                  <span className="block text-xs text-slate-400">{t('contact.emergencyNumber')}</span>
                  <a
                    href={telHref(HOSPITAL.emergencyPhone)}
                    className="inline-flex min-h-11 items-center font-semibold text-white"
                  >
                    {HOSPITAL.emergencyPhone}
                  </a>
                </span>
              </li>
              <li className="flex gap-2.5">
                <Ambulance className="mt-0.5 size-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>
                  <span className="block text-xs text-slate-400">{t('contact.ambulance')}</span>
                  <a href={telHref(HOSPITAL.ambulancePhone)} className="font-semibold text-white">
                    {HOSPITAL.ambulancePhone}
                  </a>
                </span>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-400" aria-hidden="true" />
                <span>
                  <span className="block text-xs text-slate-400">{t('contact.reception')}</span>
                  <a href={telHref(HOSPITAL.receptionPhone)} className="font-semibold text-white">
                    {HOSPITAL.receptionPhone}
                  </a>
                </span>
              </li>
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-mint-400" aria-hidden="true" />
                <span>
                  <span className="block text-xs text-slate-400">{t('contact.hours')}</span>
                  <span className="block">{t('contact.opdHours')}</span>
                  <span className="block">{t('contact.sundayHours')}</span>
                  <span className="mt-1 block font-semibold text-mint-300">
                    {t('contact.emergencyHours')}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-800 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.rights', { year })}</p>
          <p>{t('footer.disclaimer')}</p>
        </div>
      </div>
    </footer>
  )
}
