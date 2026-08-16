/**
 * Symptom words mapped to the department that handles them.
 *
 * Extracted so the assistant and the booking form's triage check read from
 * exactly the same list. Two copies would drift, and the copy that drifted
 * would be the one telling a patient which doctor to see.
 *
 * These map words to a *department*, never to a condition. "chest pain →
 * Cardiology" is a signpost; "chest pain → angina" would be a diagnosis, and
 * nothing in this app is entitled to make one.
 */
export const SYMPTOM_MAP = [
  {
    departmentId: 'emergency',
    words: [
      'emergency', 'accident', 'bleeding', 'unconscious', 'poison', 'burn', 'ambulance', 'urgent',
      'collapse', 'fainted', 'snake bite',
      'அவசர', 'விபத்து', 'ரத்தம்', 'மயக்கம்', 'விஷ', 'தீக்காயம்', 'ஆம்புலன்ஸ்',
      'आपात', 'दुर्घटना', 'खून', 'बेहोश', 'ज़हर', 'जलन', 'एम्बुलेंस', 'साँप',
    ],
  },
  {
    departmentId: 'general-medicine',
    words: [
      'fever', 'cold', 'cough', 'flu', 'tired', 'weakness', 'body pain', 'diabetes', 'sugar',
      'blood pressure', 'bp', 'thyroid', 'checkup', 'check up', 'health check', 'infection',
      'காய்ச்சல்', 'சளி', 'இருமல்', 'சோர்வு', 'உடல்வலி', 'சர்க்கரை', 'நீரிழிவு', 'ரத்த அழுத்தம்', 'பரிசோதனை',
      'बुखार', 'सर्दी', 'खाँसी', 'कमज़ोरी', 'बदन दर्द', 'शुगर', 'मधुमेह', 'रक्तचाप', 'जाँच',
    ],
  },
  {
    departmentId: 'cardiology',
    words: [
      'heart', 'chest pain', 'palpitation', 'cardiac', 'ecg', 'echo', 'angiogram', 'cholesterol',
      'இதய', 'மார்பு வலி', 'நெஞ்சு வலி', 'இருதய',
      'दिल', 'हृदय', 'सीने में दर्द', 'छाती में दर्द', 'धड़कन',
      'दिल की', 'हृदय की',
    ],
  },
  {
    departmentId: 'pediatrics',
    words: [
      'child', 'baby', 'kid', 'infant', 'newborn', 'vaccination', 'vaccine', 'immunisation',
      'paediatric', 'pediatric',
      'குழந்தை', 'பச்சிளம்', 'தடுப்பூசி',
      'बच्चा', 'बच्चे', 'शिशु', 'नवजात', 'टीका', 'टीकाकरण',
      'बच्चों', 'शिशुओं',
    ],
  },
  {
    departmentId: 'orthopedics',
    words: [
      'bone', 'fracture', 'knee', 'joint', 'back pain', 'spine', 'shoulder', 'sprain', 'ortho',
      'hip', 'arthritis', 'leg pain',
      'எலும்பு', 'முறிவு', 'முழங்கால்', 'மூட்டு', 'முதுகு வலி', 'இடுப்பு',
      'हड्डी', 'फ्रैक्चर', 'घुटना', 'जोड़', 'कमर दर्द', 'रीढ़', 'कंधा', 'मोच',
      'घुटने', 'घुटनों', 'हड्डियों', 'जोड़ों', 'कंधे', 'कमर', 'पीठ',
    ],
  },
  {
    departmentId: 'gynecology',
    words: [
      'pregnan', 'delivery', 'period', 'menstrual', 'infertil', 'gynaec', 'gynec', 'obstetric',
      'scan pregnancy', 'womb', 'uterus',
      'கர்ப்ப', 'பிரசவ', 'மாதவிடாய்', 'மகளிர்', 'கருவுற',
      'गर्भ', 'गर्भवती', 'प्रसव', 'माहवारी', 'महिला', 'स्त्री',
    ],
  },
  {
    departmentId: 'neurology',
    words: [
      'headache', 'migraine', 'fits', 'seizure', 'epilep', 'stroke', 'paralysis', 'numb',
      'memory', 'nerve', 'giddy', 'parkinson', 'brain',
      'தலைவலி', 'வலிப்பு', 'பக்கவாத', 'நரம்பு', 'மூளை',
      'लकवा', 'मिर्गी', 'दौरा', 'सिरदर्द', 'चक्कर', 'नस', 'कंपन',
      'नसों', 'सिर दर्द', 'सिर में दर्द',
    ],
  },
  {
    departmentId: 'dermatology',
    words: [
      'skin', 'rash', 'itch', 'pimple', 'acne', 'hair fall', 'hair loss', 'psoriasis', 'fungal',
      'eczema', 'allergy skin', 'dandruff',
      'தோல்', 'அரிப்பு', 'பரு', 'முடி உதிர்', 'சொரி',
      'त्वचा', 'चर्म', 'खुजली', 'दाने', 'बाल झड़', 'मुँहासे', 'एलर्जी',
    ],
  },
  {
    departmentId: 'ent',
    words: [
      'ear', 'nose', 'throat', 'sinus', 'tonsil', 'hearing', 'vertigo', 'voice', 'snoring ent',
      'deaf', 'ent',
      'காது', 'மூக்கு', 'தொண்டை', 'சைனஸ்', 'கேட்கும்',
      'कान', 'नाक', 'गला', 'सुनाई', 'साइनस', 'टॉन्सिल',
      'कानों', 'गले', 'नाक से',
    ],
  },
  {
    departmentId: 'ophthalmology',
    words: [
      'eye', 'vision', 'cataract', 'spectacle', 'glasses', 'squint', 'retina', 'blurred',
      'கண்', 'பார்வை', 'கண்புரை', 'மாறுகண்',
      'आँख', 'आंख', 'नज़र', 'दृष्टि', 'मोतियाबिंद', 'चश्मा',
      'आँखें', 'आँखों', 'आंखों', 'आँखो',
    ],
  },
  {
    departmentId: 'maxillofacial',
    words: [
      'tooth', 'teeth', 'dental', 'dentist', 'gum', 'cavity', 'braces', 'root canal', 'toothache',
      'பல்', 'ஈறு', 'பல் வலி',
      'दाँत', 'दांत', 'जबड़ा', 'मसूड़ा', 'मुँह',
      'दाँतों', 'दांतों', 'जबड़े', 'मसूड़ों',
    ],
  },
  {
    departmentId: 'gastroenterology',
    words: [
      'stomach', 'acidity', 'gastric', 'ulcer', 'liver', 'jaundice', 'piles', 'vomit',
      'loose motion', 'diarrh', 'constipation', 'endoscopy', 'gas',
      'வயிறு', 'அமிலம்', 'கல்லீரல்', 'மஞ்சள் காமாலை', 'மூல', 'வாந்தி',
      'पेट', 'अम्लता', 'गैस', 'अल्सर', 'जिगर', 'यकृत', 'दस्त', 'कब्ज', 'पीलिया',
      'पेट में', 'पेट दर्द',
    ],
  },
  {
    departmentId: 'pulmonology',
    words: [
      'asthma', 'breathing', 'breathless', 'wheez', 'tb', 'tuberculosis', 'snoring', 'lung',
      'copd', 'chest infection',
      'ஆஸ்துமா', 'மூச்சு', 'நுரையீரல்', 'காசநோய்', 'குறட்டை',
      'दमा', 'साँस', 'अस्थमा', 'फेफड़ा', 'तपेदिक', 'टीबी',
    ],
  },
  {
    departmentId: 'nephrology',
    words: [
      'kidney', 'urine', 'urinary', 'stone', 'dialysis', 'prostate', 'renal',
      'சிறுநீரக', 'சிறுநீர்', 'கல்',
      'गुर्दा', 'किडनी', 'डायलिसिस', 'पेशाब',
      'गुर्दे', 'किडनी की',
    ],
  },
  {
    departmentId: 'oncology',
    words: [
      'cancer', 'tumour', 'tumor', 'chemo', 'lump', 'oncolog', 'biopsy',
      'புற்றுநோய்', 'கட்டி', 'கீமோ',
      'कैंसर', 'गाँठ', 'ट्यूमर', 'कीमो',
    ],
  },
  {
    departmentId: 'psychiatry',
    words: [
      'depress', 'anxiety', 'stress', 'sleepless', 'insomnia', 'mental', 'addiction', 'alcohol',
      'smoking', 'counsel', 'panic', 'psychiat',
      'மனச்சோர்', 'பதற்றம்', 'மனநல', 'தூக்கம்', 'போதை', 'ஆலோசனை',
      'अवसाद', 'घबराहट', 'तनाव', 'नींद', 'मानसिक', 'लत', 'नशा',
    ],
  },
  {
    departmentId: 'general-surgery',
    words: [
      'hernia', 'appendix', 'appendicitis', 'gallbladder', 'gall bladder', 'lump removal',
      'nsv', 'vasectomy', 'abscess', 'surgery general',
      'குடலிறக்கம்', 'குடல்வால்', 'பித்தப்பை', 'அறுவை சிகிச்சை',
      'हर्निया', 'अपेंडिक्स', 'पित्ताशय', 'गिल्टी', 'ऑपरेशन',
    ],
  },
  {
    departmentId: 'urology',
    words: [
      'prostate', 'urine flow', 'burning urine', 'bladder', 'urology',
      'புராஸ்டேட்', 'சிறுநீர் எரிச்சல்',
      'पथरी', 'प्रोस्टेट', 'मूत्र', 'पेशाब में जलन',
    ],
  },
  {
    departmentId: 'neurosurgery',
    words: [
      'head injury', 'brain surgery', 'spine surgery', 'slip disc', 'disc',
      'தலைக் காயம்', 'மூளை அறுவை',
      'मस्तिष्क', 'दिमाग', 'सिर की चोट', 'रीढ़ की सर्जरी',
    ],
  },
  {
    departmentId: 'plastic-surgery',
    words: [
      'burn', 'scar', 'reconstruction', 'cosmetic surgery', 'cleft', 'plastic surgery',
      'தீக்காயம்', 'வடு', 'மறுசீரமைப்பு',
      'प्लास्टिक सर्जरी', 'जले', 'निशान', 'पुनर्निर्माण',
    ],
  },
  {
    departmentId: 'pediatric-surgery',
    words: [
      'child surgery', 'baby surgery', 'குழந்தை அறுவை சிகிச்சை',
      'बच्चे की सर्जरी', 'शिशु सर्जरी',
    ],
  },
]

export const normaliseSymptomText = (text) =>
  String(text ?? '').toLowerCase().replace(/[.,!?;:'"()]/g, ' ').replace(/\s+/g, ' ').trim()

/*
 * Short keywords must match as whole words.
 *
 * Plain substring matching sent "follow up appointment" to ENT — 'ent' sits
 * inside "appointm-ent". The same flaw put 'ear' inside "heart" and 'kid'
 * inside "kidney", so a kidney complaint was routed to paediatrics. Anything
 * short enough to hide inside an ordinary word is checked with boundaries;
 * longer stems stay loose so 'pregnan' still catches "pregnancy".
 *
 * Applies to Latin script only — \b is meaningless against Tamil, where these
 * short-fragment collisions do not arise anyway.
 */
const SHORT_WORD = 5
const isLatin = (word) => /^[a-z ]+$/.test(word)

const hasWord = (haystack, word) => {
  if (word.length >= SHORT_WORD || !isLatin(word)) return haystack.includes(word)
  /*
   * Plural tolerance matters here: people write "my eyes hurt", "both knees",
   * "lumps". Bare \b lost all of those. The boundary still stops 'kid'
   * matching "kidney" and 'ear' matching "early", which is the whole point.
   */
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?\\b`).test(haystack)
}

/**
 * Intent keywords: whole words, optionally with a common suffix.
 *
 * Plain substring matching made "what are your timings" answer the question
 * "what are you?" — 'what are you' sits inside 'what are your'. It also put
 * 'card' inside "cardiology", so asking about the heart department returned a
 * payment answer. Allowing s/es/ing/ed keeps plurals working ('timing' still
 * matches "timings") without letting a keyword hide inside a longer word.
 */
export const includesWord = (haystack, words) =>
  words.find((word) => {
    /*
     * An empty keyword matches everything, because every string contains ''.
     * Callers that test truthiness were saved by '' being falsy, but the
     * function was still reporting a match — and the first caller to check
     * `!== undefined` would have inherited a matcher that fires on any input.
     * Glossary entries with no expansion normalise to '' and reach here.
     */
    if (!word || !String(word).trim()) return false
    if (!/^[a-z ]+$/.test(word)) return haystack.includes(word)   // Tamil: as-is
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 'hi' + optional s matched "his" — too short to inflect safely.
    const suffix = word.length <= 2 ? '' : '(?:s|es|ing|ed)?'
    return new RegExp(`\\b${escaped}${suffix}\\b`).test(haystack)
  })

/**
 * Finds a keyword in `haystack`. A multi-word keyword also matches when its
 * words appear in any order — "diet for diabetes" should find "diabetes diet".
 */
export const matchesAny = (haystack, words) =>
  words.find((word) => {
    if (hasWord(haystack, word)) return true
    if (!word.includes(' ')) return false
    const parts = word.split(' ')
    if (parts.some((part) => part.length < 3)) return false
    return parts.every((part) => hasWord(haystack, part))
  })

/** The department a free-text description points to, or null. */
/**
 * General Medicine is the catch-all, so it must lose every tie.
 *
 * It owns deliberately broad words — "checkup", "infection", "जाँच" — and it
 * sits near the top of the list. With a plain first-match search that meant
 * "skin infection" answered General Medicine rather than Dermatology, and
 * "cancer screening checkup" answered General Medicine rather than Oncology.
 * Both are the kind of wrong that sends someone to the wrong queue and costs
 * them a second visit.
 *
 * Emergency keeps its place at the front: if the words look like an emergency,
 * nothing more specific should outrank that.
 */
const CATCH_ALL = 'general-medicine'

export function matchDepartment(text) {
  const q = normaliseSymptomText(text)
  if (!q) return null

  let fallback = null
  for (const entry of SYMPTOM_MAP) {
    if (!matchesAny(q, entry.words)) continue
    if (entry.departmentId === CATCH_ALL) {
      fallback = entry.departmentId
      continue
    }
    return entry.departmentId
  }
  return fallback
}
