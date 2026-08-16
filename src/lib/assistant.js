import { DEPARTMENTS, DOCTORS, FACILITIES, GRADES, HOSPITAL, getDepartment } from '../data/hospital'
import { GLOSSARY } from '../data/glossary'
import { HEALTH_TOPICS, NUTRITION_HINTS } from '../data/healthTips'
import { availabilityLabel, formatFee, isDoctorAvailableOn, sessionRangeLabel } from './schedule'
import { includesWord, matchDepartment, matchesAny } from './symptoms'

/**
 * On-device assistant.
 *
 * This is a deterministic intent matcher over the app's own data, not a large
 * language model — it runs offline, costs nothing and cannot invent a doctor
 * or a diagnosis. `answer()` returns display text plus optional actions the
 * UI can turn into buttons.
 */

const normalise = (text) => text.toLowerCase().replace(/[.,!?;:'"()]/g, ' ').replace(/\s+/g, ' ').trim()


// Whole-word matching — see includesWord for why substring was wrong.
const includesAny = includesWord


/* ------------------------------------------------------------------ *
 * Response helpers
 * ------------------------------------------------------------------ */
const doctorLine = (doctor, ctx) => {
  const { t, tl, lang } = ctx
  const live = doctor.bookingMode === 'live'
  const today = live && isDoctorAvailableOn(doctor, new Date())

  const lines = [
    `• ${tl(doctor.name)} — ${tl(doctor.specialization)} (${tl(GRADES[doctor.grade])})`,
    `   ${doctor.qualification}`,
    live
      ? `   ${t('doctors.availableDays')}: ${availabilityLabel(doctor.days, lang)}${today ? ` · ${t('doctors.availableToday')}` : ''}`
      : `   ${t('doctors.timingsCallReception')}`,
  ]
  if (doctor.fee != null) lines.push(`   ${t('doctors.fee')}: ${formatFee(doctor.fee, lang)}`)
  return lines.join('\n')
}

const departmentAnswer = (departmentId, ctx) => {
  const { t, tl } = ctx
  const department = getDepartment(departmentId)
  /*
   * The symptom list is broader than the hospital's online clinics.
   *
   * When departments without an OPD roster were taken off the site, "chest
   * pain", "tooth pain" and "cancer" all began answering "I didn't catch
   * that" — with no number, no suggestion, nothing. The words were understood
   * perfectly well; it was the destination that had gone. Saying so, and
   * giving reception's number, is the difference between a dead end and an
   * answer.
   */
  if (!department) {
    return {
      text: t('ai.departmentNotOnline', { reception: HOSPITAL.receptionPhone }),
      actions: [{ type: 'call', number: HOSPITAL.receptionPhone, label: t('contact.reception') }],
      suggestKeys: ['ai.sugTimings', 'ai.sugFever'],
    }
  }

  const doctors = DOCTORS.filter((d) => d.departmentId === departmentId)
  const today = doctors.filter((d) => d.bookingMode === 'live' && isDoctorAvailableOn(d, new Date()))

  const lines = [
    t('ai.deptIntro', { dept: tl(department.name) }),
    '',
    tl(department.description),
    '',
    t('ai.deptDoctors', { count: doctors.length, today: today.length }),
    ...doctors.slice(0, 4).map((d) => doctorLine(d, ctx)),
  ]
  if (doctors.length > 4) lines.push(t('ai.andMore', { count: doctors.length - 4 }))

  return {
    text: lines.join('\n'),
    actions: [
      { type: 'department', departmentId, label: t('services.viewDoctors') },
      { type: 'book', departmentId, label: t('action.book') },
    ],
  }
}

/* ------------------------------------------------------------------ *
 * Main entry point
 * ------------------------------------------------------------------ */
export function answer(rawQuery, ctx) {
  const { t, tl, lang } = ctx
  const q = normalise(rawQuery)

  if (!q) return { text: t('ai.empty') }

  /* --- Honesty first: is any of this real? --- */
  if (
    includesAny(q, [
      'real doctor', 'genuine', 'are the doctors real', 'are these doctors', 'fake', 'actually exist',
      'real hospital', 'is this real', 'உண்மையான', 'நிஜமான', 'असली', 'सच में', 'नकली',
    ])
  ) {
    return { text: t('ai.doctorsReal'), actions: [{ type: 'navigate', page: 'doctors', label: t('nav.doctors') }] }
  }

  /* --- Who/what are you --- */
  if (
    includesAny(q, [
      'who are you', 'what are you', 'are you ai', 'chatgpt', 'நீ யார்',
      'तुम कौन हो', 'आप कौन हो', 'क्या तुम एआई हो',
    ])
  ) {
    return { text: t('ai.whoAmI') }
  }

  /* --- Greetings --- */
  if (
    q.length < 22 &&
    includesAny(q, ['hi', 'hello', 'hey', 'vanakkam', 'வணக்கம்', 'good morning', 'good evening', 'नमस्ते', 'नमस्कार', 'सुप्रभात'])
  ) {
    return { text: t('ai.greeting'), suggestKeys: ['ai.sugFever', 'ai.sugTimings', 'ai.sugOpd'] }
  }

  /* --- Emergency takes priority over everything else --- */
  if (includesAny(q, ['emergency', 'ambulance', 'accident', 'unconscious', 'அவசர', 'ஆம்புலன்ஸ்', 'விபத்து', 'आपात', 'एम्बुलेंस', 'दुर्घटना', 'बेहोश'])) {
    return {
      text: t('ai.emergency', {
        emergency: HOSPITAL.emergencyPhone,
        ambulance: HOSPITAL.ambulancePhone,
      }),
      actions: [{ type: 'call', number: HOSPITAL.emergencyPhone, label: t('action.callNow') }],
    }
  }

  /* --- Named doctor lookup --- */
  const namedDoctor = DOCTORS.find((doctor) => {
    const en = normalise(doctor.name.en.replace(/^Dr\.\s*/, '').replace(/\b[a-z]\.\s*/gi, ''))
    const ta = normalise((doctor.name.ta ?? '').replace(/^டாக்டர்\s*/, ''))
    const hi = normalise((doctor.name.hi ?? '').replace(/^डॉ\.\s*/, ''))
    return [en, ta, hi].some((form) => form.length > 3 && q.includes(form))
  })
  if (namedDoctor) {
    const department = getDepartment(namedDoctor.departmentId)
    const morning = sessionRangeLabel(namedDoctor.sessions.morning, lang)
    const evening = sessionRangeLabel(namedDoctor.sessions.evening, lang)
    return {
      text: [
        `${tl(namedDoctor.name)} — ${tl(namedDoctor.specialization)}`,
        `${tl(GRADES[namedDoctor.grade])}, ${tl(department.name)}`,
        namedDoctor.regNo
          ? `${namedDoctor.qualification} · ${t('doctors.regNo')} ${namedDoctor.regNo}`
          : namedDoctor.qualification,
        '',
        namedDoctor.bookingMode === 'live'
          ? `${t('doctors.availableDays')}: ${availabilityLabel(namedDoctor.days, lang)}`
          : t('doctors.timingsCallReception'),
        morning ? `${t('doctors.morning')}: ${morning}` : null,
        evening ? `${t('doctors.evening')}: ${evening}` : null,
        namedDoctor.room ? `${t('doctors.room')}: ${namedDoctor.room}` : null,
        namedDoctor.fee != null ? `${t('doctors.fee')}: ${formatFee(namedDoctor.fee, lang)}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      actions: [
        { type: 'book', departmentId: namedDoctor.departmentId, doctorId: namedDoctor.id, label: t('action.book') },
      ],
    }
  }

  /* --- Glossary lookup: "what is OPD", "meaning of MBBS" --- */
  const asksMeaning = includesAny(q, [
    'what is', 'what are', 'meaning', 'means', 'define', 'explain', 'stands for', 'full form',
    'என்றால் என்ன', 'அர்த்தம்', 'விளக்க', 'क्या होता है', 'मतलब', 'अर्थ', 'समझाइए', 'पूरा नाम',
  ])
  const glossaryHit = GLOSSARY.find((entry) => {
    const terms = [
      entry.term.en,
      entry.term.ta,
      entry.term.hi,
      entry.expansion?.en,
      entry.expansion?.ta,
      entry.expansion?.hi,
    ]
      .filter(Boolean)
      .flatMap((value) => normalise(value).split(/\s*\/\s*/))
      .filter((term) => term.length > 1)
    return terms.some((term) => {
      // \b only works for ASCII, so Tamil terms fall back to a substring test.
      if (/^[\x20-\x7e]+$/.test(term)) {
        return new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(q)
      }
      return q.includes(term)
    })
  })
  if (glossaryHit && (asksMeaning || q.split(' ').length <= 4)) {
    return {
      text: [
        `${tl(glossaryHit.term)}${glossaryHit.expansion ? ` — ${tl(glossaryHit.expansion)}` : ''}`,
        '',
        tl(glossaryHit.definition),
      ].join('\n'),
      actions: [{ type: 'navigate', page: 'glossary', label: t('ai.moreTerms') }],
    }
  }

  /* --- Department by name --- */
  /*
   * Whole-word, not substring. The ENT department's name normalises to "ent",
   * which sits inside "appointment" — so "book an appointment" was answered
   * with a list of ear, nose and throat surgeons.
   */
  const namedDepartment = DEPARTMENTS.find((dept) => {
    const en = normalise(dept.name.en.split('(')[0])
    const ta = normalise(dept.name.ta)
    const hi = normalise(dept.name.hi)
    return Boolean(includesWord(q, [en, ta, hi].filter(Boolean)))
  })
  if (namedDepartment) return departmentAnswer(namedDepartment.id, ctx)

  /* --- Timings --- */
  if (includesAny(q, ['timing', 'time', 'open', 'hours', 'when', 'நேரம்', 'திற', 'எப்போது', 'समय', 'खुलता', 'कब', 'घंटे'])) {
    return {
      text: [
        `${t('contact.opd')}: ${t('contact.opdHours')}`,
        t('contact.sundayHours'),
        t('contact.emergencyHours'),
        t('contact.pharmacyHours'),
      ].join('\n'),
      actions: [{ type: 'navigate', page: 'contact', label: t('nav.contact') }],
    }
  }

  /* --- Parking --- */
  if (
    includesAny(q, [
      'parking', 'park my car', 'car park', 'two wheeler', 'bike', 'scooter', 'vehicle',
      'நிறுத்த', 'வாகனம்', 'கார்', 'पार्किंग', 'गाड़ी खड़ी', 'गाड़ी कहाँ', 'दुपहिया', 'स्कूटर',
    ])
  ) {
    return {
      // Answers with the hospital's own words when they have been supplied,
      // and admits ignorance when they have not. Never guesses.
      text: HOSPITAL.parkingNote || t('ai.parkingUnknown', { reception: HOSPITAL.receptionPhone }),
      actions: HOSPITAL.parkingNote
        ? [{ type: 'navigate', page: 'contact', label: t('nav.contact') }]
        : [{ type: 'call', label: t('contact.reception'), number: HOSPITAL.receptionPhone }],
    }
  }

  /* --- Location --- */
  if (includesAny(q, ['where', 'address', 'location', 'reach', 'direction', 'எங்கே', 'முகவரி', 'இடம்', 'कहाँ', 'पता', 'जगह', 'कैसे पहुँच'])) {
    return {
      text: `${t('contact.addressLine')}\n${t('contact.mapNote')}\n\n${t('contact.reception')}: ${HOSPITAL.receptionPhone}`,
      actions: [{ type: 'navigate', page: 'contact', label: t('nav.contact') }],
    }
  }

  /* --- Fees --- */
  if (includesAny(q, ['fee', 'cost', 'price', 'charge', 'how much', 'கட்டணம்', 'விலை', 'எவ்வளவு', 'शुल्क', 'फ़ीस', 'कीमत', 'कितना', 'खर्च'])) {
    const fees = DOCTORS.map((d) => d.fee).filter((f) => f != null)
    if (fees.length === 0) {
      return {
        text: t('ai.feesNotPublished'),
        actions: [{ type: 'navigate', page: 'contact', label: t('nav.contact') }],
      }
    }
    return {
      text: t('ai.fees', {
        min: formatFee(Math.min(...fees), lang),
        max: formatFee(Math.max(...fees), lang),
      }),
      actions: [{ type: 'navigate', page: 'doctors', label: t('nav.doctors') }],
    }
  }

  /* --- Payment --- */
  if (includesAny(q, ['pay', 'payment', 'upi', 'card', 'net banking', 'gpay', 'கட்டணம் செலுத்த', 'யுபிஐ', 'भुगतान', 'यूपीआई', 'कार्ड', 'नेट बैंकिंग'])) {
    return {
      text: t('ai.payment'),
      actions: [{ type: 'navigate', page: 'appointments', label: t('nav.appointments') }],
    }
  }

  /* --- Cancel / reschedule --- */
  if (includesAny(q, ['cancel', 'cancellation', 'reschedule', 'change my appointment', 'postpone', 'ரத்து', 'மாற்ற', 'रद्द', 'समय बदल', 'स्थगित'])) {
    return {
      text: t('ai.manage'),
      actions: [{ type: 'navigate', page: 'appointments', label: t('nav.appointments') }],
    }
  }

  /* --- Account --- */
  if (includesAny(q, ['sign up', 'signup', 'register', 'account', 'login', 'sign in', 'password', 'கணக்கு', 'உள்நுழை', 'खाता', 'लॉग इन', 'साइन इन', 'पासवर्ड', 'पंजीकरण'])) {
    return {
      text: t('ai.account'),
      actions: [{ type: 'navigate', page: 'account', label: t('account.signIn') }],
    }
  }

  /* --- Booking intent with no department yet --- */
  if (includesAny(q, ['book', 'booking', 'appointment', 'slot', 'consult', 'consultation', 'meet doctor', 'பதிவு', 'சந்திப்பு', 'अपॉइंटमेंट', 'बुक', 'बुकिंग', 'मिलना है', 'दिखाना है'])) {
    const symptomDept = matchDepartment(q)
    if (symptomDept) return departmentAnswer(symptomDept, ctx)
    return {
      text: t('ai.bookHelp'),
      actions: [{ type: 'book', label: t('action.book') }],
      suggestKeys: ['ai.sugFever', 'ai.sugChild', 'ai.sugTooth'],
    }
  }

  /*
   * Nutrition and wellness. Checked before symptom routing so that
   * "diet for diabetes" gives food advice rather than a department list.
   */
  const topic = HEALTH_TOPICS.find((entry) => matchesAny(q, entry.keywords))
  if (topic) {
    return {
      text: `${tl(topic.title)}\n\n${tl(topic.body)}\n\n${t('ai.notAdvice')}`,
      actions: topic.departmentId
        ? [{ type: 'book', departmentId: topic.departmentId, label: t('ai.askDoctor') }]
        : [{ type: 'book', departmentId: 'general-medicine', label: t('ai.askDoctor') }],
    }
  }

  if (matchesAny(q, NUTRITION_HINTS)) {
    const vitamins = HEALTH_TOPICS.filter((e) => e.group === 'vitamin' || e.group === 'mineral')
    const diets = HEALTH_TOPICS.filter((e) => e.group === 'diet')
    return {
      text: [
        t('ai.nutritionIntro'),
        '',
        t('ai.nutritionVitamins'),
        ...vitamins.map((e) => `• ${tl(e.title)}`),
        '',
        t('ai.nutritionDiets'),
        ...diets.map((e) => `• ${tl(e.title)}`),
        '',
        t('ai.notAdvice'),
      ].join('\n'),
      suggestKeys: ['ai.sugVitaminD', 'ai.sugIron', 'ai.sugDiabetesDiet'],
    }
  }

  /* --- "Who is the best doctor?" --- */
  /*
   * Deliberately not answered by naming somebody. The hospital holds no
   * ratings, outcomes or patient scores, so any "best" would be invented — and
   * inventing a ranking of real, named consultants is both unfounded and
   * unfair to the other twenty-four. What it does instead is answer the
   * question behind the question: how do I choose?
   */
  if (
    includesAny(q, [
      'best doctor', 'best doc', 'top doctor', 'good doctor', 'better doctor',
      'which doctor', 'recommend', 'suggest a doctor', 'who should i see',
      'most experienced', 'senior doctor', 'senior most', 'famous doctor',
      'சிறந்த மருத்துவர்', 'நல்ல மருத்துவர்', 'யாரைப் பார்க்க', 'सबसे अच्छा डॉक्टर', 'अच्छा डॉक्टर', 'बेहतर डॉक्टर', 'कौन सा डॉक्टर', 'किस डॉक्टर', 'किसे दिखाऊँ', 'सबसे अनुभवी', 'वरिष्ठ डॉक्टर', 'सुझाव',
    ])
  ) {
    const senior = DOCTORS.filter((d) => d.grade === 'chief' || d.grade === 'senior')
    return {
      text: t('ai.bestDoctor', { count: DOCTORS.length, senior: senior.length }),
      actions: [{ type: 'navigate', page: 'doctors', label: t('nav.doctors') }],
      suggestKeys: ['ai.sugFever', 'ai.sugTimings'],
    }
  }

  /* --- Admission and staying overnight --- */
  if (
    includesAny(q, [
      'admission', 'admit', 'stay overnight', 'overnight', 'inpatient', 'ward', 'bed',
      'how long stay', 'discharge', 'attender', 'சேர்க்கை', 'அனுமதி', 'படுக்கை',
      'भर्ती', 'दाख़िल', 'वार्ड', 'बिस्तर', 'आईसीयू', 'छुट्टी',
    ])
  ) {
    return {
      text: t('ai.admission'),
      actions: [
        { type: 'navigate', page: 'services', label: t('nav.services') },
        { type: 'call', label: t('contact.reception'), number: HOSPITAL.receptionPhone },
      ],
    }
  }

  /* --- Facilities: pharmacy, lab, scan, insurance, ambulance, rooms --- */
  const facility = FACILITIES.find((item) => {
    // The id matters as well as the name — "Free Wi-Fi" splits into fragments
    // that never match how anyone actually types "wifi".
    const keys = [item.id, ...normalise(tl(item.name)).split(' ')].filter((word) => word.length > 2)
    return keys.some((word) => includesAny(q, [word]))
  })
  if (facility) {
    return {
      text: `${tl(facility.name)} — ${tl(facility.text)}`,
      actions: [{ type: 'navigate', page: 'services', label: t('nav.services') }],
    }
  }

  /* --- How many doctors / departments --- */
  if (includesAny(q, ['how many', 'number of doctor', 'total doctor', 'எத்தனை', 'कितने डॉक्टर', 'कुल डॉक्टर', 'कितने विभाग'])) {
    return {
      text: t('ai.howMany', { doctors: DOCTORS.length, departments: DEPARTMENTS.length }),
      actions: [{ type: 'navigate', page: 'doctors', label: t('nav.doctors') }],
    }
  }

  /* --- Things the hospital simply has not recorded --- */
  if (includesAny(q, ['female doctor', 'lady doctor', 'male doctor', 'woman doctor', 'பெண் மருத்துவர்', 'महिला डॉक्टर', 'पुरुष डॉक्टर', 'लेडी डॉक्टर'])) {
    return {
      text: t('ai.notRecorded'),
      actions: [{ type: 'call', label: t('contact.reception'), number: HOSPITAL.receptionPhone }],
    }
  }

  /* --- Symptom routing --- */
  /*
   * matchDepartment, not a plain find over SYMPTOM_MAP: it knows that General
   * Medicine is the catch-all and must lose every tie. A bare find answered
   * "skin infection" with General Medicine, because "infection" is one of that
   * department's deliberately broad words and it sits near the top of the list.
   */
  const symptomDept = matchDepartment(q)
  if (symptomDept) return departmentAnswer(symptomDept, ctx)

  /* --- Languages --- */
  if (includesAny(q, ['tamil', 'english', 'language', 'மொழி', 'தமிழ்'])) {
    return { text: t('ai.language') }
  }

  /*
   * Nothing matched exactly — so guess, rather than shrug.
   *
   * A dead end ("I didn't catch that") is the worst possible reply: the person
   * has a real question and is now stuck. This scores every department, doctor
   * and glossary term against the words they used and offers the closest few.
   * Even when the guess is wrong, they get somewhere to click — and the
   * reception number is always there as the answer that never fails.
   */
  const words = q.split(' ').filter((word) => word.length > 2)
  const score = (text) => {
    const hay = normalise(text)
    // Guard the empty case: every string contains '', so a glossary entry with
    // no expansion scored a point against literally any question — which is
    // how "xyzzy qwerty" came back as Casualty, Consultation and Referral.
    if (hay.length < 3) return 0
    // Whole words only. Substring scoring offered Oncology for "can my
    // grandmother stay overnight" — 'can' sits inside "cancer".
    return words.reduce((n, word) => n + (includesWord(hay, [word]) ? 1 : 0), 0)
  }

  const guesses = [
    ...DEPARTMENTS.map((d) => ({
      score: score(tl(d.name)) + score(tl(d.description ?? { en: '', ta: '' })),
      action: { type: 'department', departmentId: d.id, label: tl(d.name) },
    })),
    ...DOCTORS.map((d) => ({
      score: score(tl(d.name)) + score(tl(d.specialization)),
      action: { type: 'book', doctorId: d.id, departmentId: d.departmentId, label: tl(d.name) },
    })),
    ...GLOSSARY.map((g) => ({
      score: score(tl(g.term)) + score(tl(g.expansion ?? { en: '', ta: '' })),
      action: { type: 'navigate', page: 'glossary', label: tl(g.term) },
    })),
  ]
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (guesses.length > 0) {
    return {
      text: t('ai.didYouMean'),
      actions: guesses.map((g) => g.action),
    }
  }

  // Nothing even close. Give the escape hatch that always works.
  return {
    text: t('ai.noIdea', { reception: HOSPITAL.receptionPhone }),
    actions: [
      { type: 'call', label: t('contact.reception'), number: HOSPITAL.receptionPhone },
      { type: 'navigate', page: 'doctors', label: t('nav.doctors') },
    ],
    suggestKeys: ['ai.sugFever', 'ai.sugTimings', 'ai.sugOpd'],
  }
}

/** Opening message plus starter chips. */
export function greeting(ctx) {
  return {
    text: ctx.t('ai.welcome'),
    suggestKeys: ['ai.sugFever', 'ai.sugChild', 'ai.sugTimings', 'ai.sugOpd'],
  }
}
