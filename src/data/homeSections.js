import { BadgeCheck, Languages, ShieldPlus, Sparkles } from 'lucide-react'

/**
 * What the home page says, as data.
 *
 * The page itself holds no copy and no list of sections — everything a person
 * would want to change lives here, keyed to the translation dictionary. Adding
 * a reason to the "what to expect" band, or reordering it, is an edit to this
 * array and nothing else; no JSX changes hands.
 *
 * `tone` names an existing palette pair rather than a raw colour, so the
 * signature accent stays the one defined in index.css.
 */
export const WHAT_TO_EXPECT = [
  {
    id: 'emergency',
    icon: ShieldPlus,
    titleKey: 'home.why1Title',
    textKey: 'home.why1Text',
    tone: 'text-rose-600',
  },
  {
    id: 'consultants',
    icon: BadgeCheck,
    titleKey: 'home.why2Title',
    textKey: 'home.why2Text',
    tone: 'text-brand-600',
  },
  {
    id: 'fees',
    icon: Sparkles,
    titleKey: 'home.why3Title',
    textKey: 'home.why3Text',
    tone: 'text-amber-600',
  },
  {
    id: 'languages',
    icon: Languages,
    titleKey: 'home.why4Title',
    textKey: 'home.why4Text',
    tone: 'text-mint-600',
  },
]

/** Which hero statistics to show, and where each number comes from. */
export const HERO_STATS = [
  { id: 'doctors', factKey: 'doctors', labelKey: 'home.statDoctors' },
  { id: 'departments', factKey: 'departments', labelKey: 'home.statDepartments' },
  { id: 'years', factKey: 'years', labelKey: 'home.statYears' },
]
