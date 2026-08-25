/**
 * Anatomical line art, drawn for this hospital.
 *
 * Every department card on the site used to carry a stock icon from an
 * open-source set — the same heart, the same brain, the same tooth that appear
 * on every clinic template on the internet. They are competent and they are
 * anonymous, and anonymity is the thing that makes a site look bought rather
 * than made.
 *
 * These are drawn instead: a real femur with condyles, a uterus with its tubes,
 * a kidney with a hilum, an ear with the curl of a cochlea. A doctor reading
 * them recognises the organ; a patient reads a picture of the thing that hurts.
 *
 * THE RULES THAT KEEP THEM A SET
 *   - One 24×24 box, content inside 3–21, so they optically match at any size.
 *   - One stroke weight, `currentColor`, no fills except a pupil and an iris.
 *     1.5 rather than the 1.4 these were drawn at: these carry more internal
 *     detail than the stock set they replace, and at 1.4 they read as faint
 *     beside the bold headings they sit under.
 *     Colour is decided by the card, never in here.
 *   - Recognisable at 24px first. These sit at `size-6` in a grid of cards far
 *     more often than they sit large, and detail that turns to mud at that size
 *     is decoration for a design review, not for a patient.
 *
 * The props are lucide-react's, deliberately: same `className`, same sizing via
 * `size-*`, same `aria-hidden`. That makes them a drop-in swap wherever an icon
 * name is resolved, so nothing else in the codebase had to change.
 */

function Ico({ children, className, strokeWidth = 1.5, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

/**
 * Cardiology.
 *
 * This one is deliberately NOT the anatomical organ, and that was a decision
 * rather than a shortcut. A true anatomical heart — atria, apex, the great
 * vessels coming off the top — was drawn three times and rendered at the size
 * it actually gets used, and every version read as a pepper or an apple:
 * below about 40px the vessels turn into a stem and the ventricles turn into
 * fruit. An organ nobody recognises is worse than a symbol everybody does.
 *
 * So: the cardiac silhouette, pulled asymmetric so it is not the valentine,
 * with a QRS complex traced inside it. It is what the department's own
 * machines print, and it reads instantly at 16px.
 */
export const Heart = (p) => (
  <Ico {...p}>
    <path d="M12.2 20.4c-1-.7-8.2-5.6-8.2-10.4 0-2.4 1.9-4.3 4.3-4.3 1.6 0 3 .9 3.7 2.2.7-1.3 2.1-2.2 3.7-2.2 2.4 0 4.3 1.9 4.3 4.3 0 4.8-7.2 9.7-7.8 10.4Z" />
    <path d="M6.9 12.1h1.9l1.3-2.7 2 4.8 1.5-2.7 1 .6h1.7" />
  </Ico>
)

/** Orthopaedics — a long bone with condyles at both ends and the marrow line. */
export const Bone = (p) => (
  <Ico {...p}>
    <path d="M9.6 3.4c-1.8 0-3.2 1.4-3.2 3.1 0 .9.4 1.7 1 2.3.4.4.6.9.6 1.5v6.4c0 .6-.2 1.1-.6 1.5-.6.6-1 1.4-1 2.3 0 1.7 1.4 3.1 3.2 3.1 1 0 1.9-.5 2.4-1.2.5.7 1.4 1.2 2.4 1.2 1.8 0 3.2-1.4 3.2-3.1 0-.9-.4-1.7-1-2.3-.4-.4-.6-.9-.6-1.5v-6.4c0-.6.2-1.1.6-1.5.6-.6 1-1.4 1-2.3 0-1.7-1.4-3.1-3.2-3.1-1 0-1.9.5-2.4 1.2-.5-.7-1.4-1.2-2.4-1.2Z" />
    <path d="M12 6.2v11.6" opacity=".45" />
  </Ico>
)

/** Neurology and neurosurgery — the cerebrum, its fissure and two sulci a side. */
export const Brain = (p) => (
  <Ico {...p}>
    <path d="M12 4.4c-2.2 0-3.9 1.3-4.3 3-1.7.4-2.9 1.8-2.9 3.4 0 .9.3 1.7.8 2.3-.4.6-.6 1.3-.6 2 0 2 1.7 3.5 3.8 3.5.6 1.2 1.8 2 3.2 2" />
    <path d="M12 4.4c2.2 0 3.9 1.3 4.3 3 1.7.4 2.9 1.8 2.9 3.4 0 .9-.3 1.7-.8 2.3.4.6.6 1.3.6 2 0 2-1.7 3.5-3.8 3.5-.6 1.2-1.8 2-3.2 2" />
    <path d="M12 4.4v16.2" />
    <path d="M9.3 8.5c1 .4 1.6 1.3 1.5 2.4" opacity=".55" />
    <path d="M8.7 13.6c1.2-.1 2.2.6 2.3 1.7" opacity=".55" />
    <path d="M14.7 8.5c-1 .4-1.6 1.3-1.5 2.4" opacity=".55" />
    <path d="M15.3 13.6c-1.2-.1-2.2.6-2.3 1.7" opacity=".55" />
  </Ico>
)

/** Pulmonology — trachea, the carina, and both lungs. */
export const Lungs = (p) => (
  <Ico {...p}>
    <path d="M12 3.2v4.4" />
    <path d="M12 7.6 10.4 9.9" />
    <path d="M12 7.6l1.6 2.3" />
    <path d="M10.4 9.9c.2 3.7.2 5.9-.5 7.8-.6 1.7-2 2.7-3.4 2.4-1.3-.3-2.1-1.6-2.1-3.3 0-3.3 1.8-6.5 4.4-8.1" />
    <path d="M13.6 9.9c-.2 3.7-.2 5.9.5 7.8.6 1.7 2 2.7 3.4 2.4 1.3-.3 2.1-1.6 2.1-3.3 0-3.3-1.8-6.5-4.4-8.1" />
  </Ico>
)

/** Ophthalmology — the globe seen front on, with limbus and pupil. */
export const Eye = (p) => (
  <Ico {...p}>
    <path d="M2.6 12S6.3 5.8 12 5.8 21.4 12 21.4 12 17.7 18.2 12 18.2 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="3.3" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </Ico>
)

/** ENT — the auricle, and the inward curl toward the cochlea. */
export const Ear = (p) => (
  <Ico {...p}>
    <path d="M8.1 20.9c-.6-1.4-1.4-2.5-2.3-3.5-1.5-1.7-2.2-3.7-2.2-6C3.6 6.8 7.4 3.4 12 3.4s8.4 3.4 8.4 8c0 3.4-2.3 5.8-5.1 5.8-2 0-3.4-1.2-3.4-3 0-1.6 1-2.4 1-3.6 0-1.2-1-2-2.2-2-1.8 0-3.1 1.5-3.1 3.6" />
  </Ico>
)

/** Nephrology and urology — a kidney, indented at the hilum. */
export const Kidney = (p) => (
  <Ico {...p}>
    <path d="M13.7 3.6c3.6 0 6.4 3.6 6.4 8.4s-2.8 8.4-6.4 8.4c-2.9 0-4.6-2-5.7-4.2-.8-1.6-1.5-2.7-2.6-3.3-.6-.3-.6-1.2 0-1.5 1.1-.6 1.8-1.7 2.6-3.3C9.1 5.6 10.8 3.6 13.7 3.6Z" />
    <path d="M8.4 12h2.3" opacity=".55" />
  </Ico>
)

/** Paediatrics and neonatology — a swaddled newborn. */
export const Infant = (p) => (
  <Ico {...p}>
    <circle cx="12" cy="7.6" r="3.9" />
    <path d="M12 3.7c.2-1.1 1.2-1.7 2.2-1.4" />
    <path d="M10.5 7.4h.02" />
    <path d="M13.5 7.4h.02" />
    <path d="M6.5 13.6c1.5-.9 3.4-1.4 5.5-1.4s4 .5 5.5 1.4c1 .6 1.4 1.6 1 2.6l-1.1 3c-.4 1-1.4 1.7-2.5 1.7H9.1c-1.1 0-2.1-.7-2.5-1.7l-1.1-3c-.4-1 0-2 1-2.6Z" />
  </Ico>
)

/** General medicine — the stethoscope, the one instrument everyone recognises. */
export const Stethoscope = (p) => (
  <Ico {...p}>
    <path d="M5 3.5v5.1a4.6 4.6 0 0 0 9.2 0V3.5" />
    <path d="M3.5 3.5h2.9" />
    <path d="M12.8 3.5h2.9" />
    <path d="M9.6 13.2v2.1a4.3 4.3 0 0 0 8.6 0v-1.6" />
    <circle cx="18.2" cy="11.4" r="2.2" />
  </Ico>
)

/** General surgery — a scalpel: blade, shoulder, grip. */
export const Scalpel = (p) => (
  <Ico {...p}>
    <path d="M20.7 3.3c-3.5.3-6.8 2.2-9.2 5l-1.6 1.9 3.9 3.9 1.9-1.6c2.8-2.4 4.7-5.7 5-9.2Z" />
    <path d="m9.9 10.2-5.6 5.6c-.6.6-.6 1.6 0 2.2l1.7 1.7c.6.6 1.6.6 2.2 0l5.6-5.6" />
  </Ico>
)

/** Obstetrics and gynaecology — the uterus, tubes and ovaries. */
export const Uterus = (p) => (
  <Ico {...p}>
    <path d="M8.8 9.4c0 3.1.4 5.1 1.2 6.5.5.9.8 1.9.8 3v1.7h2.4v-1.7c0-1.1.3-2.1.8-3 .8-1.4 1.2-3.4 1.2-6.5" />
    <path d="M8.8 9.4c0-2-1.2-3.5-3-3.5-1.4 0-2.3 1-2.3 2.2 0 1.3 1 2.3 2.2 2.3" />
    <path d="M15.2 9.4c0-2 1.2-3.5 3-3.5 1.4 0 2.3 1 2.3 2.2 0 1.3-1 2.3-2.2 2.3" />
  </Ico>
)

/** Gastroenterology — the stomach with the duodenum leaving it. */
export const Stomach = (p) => (
  <Ico {...p}>
    <path d="M9.4 5.6 8.7 3.2" />
    <path d="M9.4 5.6C6.5 6.4 4.8 9.2 4.8 12.4c0 3.7 2.5 6.5 5.9 6.5 2.7 0 4.9-1.9 4.9-4.4" />
    <path d="M9.4 5.6c1.9.6 2.9 2.2 3.1 4.2.2 2 1.3 3.3 3.1 4.7" />
    <path d="M15.6 14.5c1.8.6 2.6 2 2.2 3.8" />
  </Ico>
)

/** Dermatology — a cross-section: epidermis, dermis, and a follicle through them. */
export const Skin = (p) => (
  <Ico {...p}>
    <path d="M3.6 9.6c1.8-1.4 3.3-1.4 5.1-.2s3.4 1.2 5.2 0 3.4-1.2 5.2.2v7c0 1.3-1 2.3-2.3 2.3H5.9c-1.3 0-2.3-1-2.3-2.3Z" />
    <path d="M3.6 14.1h16.4" opacity=".45" />
    <path d="M8.1 9.3c-.2-3 .7-5 2.7-5.9" />
    <path d="M8.1 9.3v5.5c0 1.3.8 2.1 2 2.1" />
  </Ico>
)

/** Faciomaxillary — a molar with its two roots. */
export const Tooth = (p) => (
  <Ico {...p}>
    <path d="M12 3.6c-2 0-2.8.8-4.4.8-1.7 0-3 1.4-3 3.5 0 2.6.8 4.4 1.6 6.6.6 1.7.7 5.2 2.3 5.2 1.4 0 1.3-3.6 3.5-3.6s2.1 3.6 3.5 3.6c1.6 0 1.7-3.5 2.3-5.2.8-2.2 1.6-4 1.6-6.6 0-2.1-1.3-3.5-3-3.5-1.6 0-2.4-.8-4.4-.8Z" />
    <path d="M8.6 8.1c1.3-.9 2.5-1.3 3.4-1.3s2.1.4 3.4 1.3" opacity=".5" />
  </Ico>
)

/** Plastic and reconstructive surgery — a closed incision, sutured. */
export const Sutures = (p) => (
  <Ico {...p}>
    <path d="M3.6 12h16.8" />
    <path d="M6.7 8.7 8.7 15.3" />
    <path d="M11 8.7 13 15.3" />
    <path d="M15.3 8.7 17.3 15.3" />
  </Ico>
)

/** Oncology — the awareness ribbon, crossed as it is actually worn. */
export const Ribbon = (p) => (
  <Ico {...p}>
    <path d="M9 20.7c1.9-4.5 4.2-9.3 5.4-12.9.8-2.5 0-4.2-1.9-4.2-2.3 0-3.9 2.5-3.9 5.8 0 4.1 2.4 8.2 5.9 11.3" />
  </Ico>
)

/** Psychiatry — a head, and the heart it is carrying. */
export const Mind = (p) => (
  <Ico {...p}>
    <path d="M12 3.5c-4.4 0-8 3.4-8 7.6 0 2.2.9 4 2.4 5.4v3c0 .6.4 1 1 1h9.2c.6 0 1-.4 1-1v-3c1.5-1.4 2.4-3.2 2.4-5.4 0-4.2-3.6-7.6-8-7.6Z" />
    <path d="M12 14.4c-.3 0-3.4-2.1-3.4-4.3 0-1.1.9-2 1.9-2 .7 0 1.2.4 1.5.8.3-.4.8-.8 1.5-.8 1 0 1.9.9 1.9 2 0 2.2-3.1 4.3-3.4 4.3Z" />
  </Ico>
)

/** Emergency — the ambulance, with the cross on its flank. */
export const Ambulance = (p) => (
  <Ico {...p}>
    <path d="M3 16.6V9.3c0-.7.5-1.3 1.2-1.3h8.6c.7 0 1.2.6 1.2 1.3v7.3" />
    <path d="M14 11.1h3.2c.4 0 .8.2 1 .6l1.6 2.6c.1.2.2.4.2.6v1.7" />
    <path d="M4.3 16.6h.5" />
    <path d="M10 16.6h4.3" />
    <path d="M18.6 16.6H20" />
    <circle cx="7.4" cy="17.7" r="1.6" />
    <circle cx="16.9" cy="17.7" r="1.6" />
    <path d="M8.5 9.8v3.4" />
    <path d="M6.8 11.5h3.4" />
  </Ico>
)

/**
 * Resolved by the same names the database stores, so the catalogue did not have
 * to change: a department row still says `HeartPulse`, it simply now draws a
 * heart somebody sat down and drew.
 */
export const ANATOMY = {
  HeartPulse: Heart,
  Bone,
  Brain,
  Wind: Lungs,
  Eye,
  Ear,
  Droplet: Kidney,
  Baby: Infant,
  Stethoscope,
  Scissors: Scalpel,
  Venus: Uterus,
  Utensils: Stomach,
  Sparkles: Skin,
  Smile: Tooth,
  Bandage: Sutures,
  Ribbon,
  HeartHandshake: Mind,
  Ambulance,
}
