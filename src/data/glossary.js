/**
 * Plain-language definitions for everything the app shows: hospital jargon,
 * the letters after a doctor's name, tests, and the booking/payment terms.
 */
export const GLOSSARY_CATEGORIES = [
  { id: 'visit', name: { en: 'Hospital & visit', ta: 'மருத்துவமனை மற்றும் வருகை' } },
  { id: 'qualification', name: { en: 'Doctor qualifications', ta: 'மருத்துவர் தகுதிகள்' } },
  { id: 'grade', name: { en: 'Doctor grades', ta: 'மருத்துவர் நிலைகள்' } },
  { id: 'test', name: { en: 'Tests & procedures', ta: 'பரிசோதனைகள் மற்றும் சிகிச்சைகள்' } },
  { id: 'booking', name: { en: 'Booking terms', ta: 'பதிவு தொடர்பான சொற்கள்' } },
  { id: 'payment', name: { en: 'Payment terms', ta: 'கட்டணச் சொற்கள்' } },
]

export const GLOSSARY = [
  /* ---------------- Hospital & visit ---------------- */
  {
    id: 'opd',
    category: 'visit',
    term: { en: 'OPD', ta: 'ஓ.பி.டி.', hi: 'ओपीडी' },
    expansion: { en: 'Out-Patient Department', ta: 'வெளிநோயாளர் பிரிவு', hi: 'बाह्य रोगी विभाग' },
    definition: {
      en: 'The clinic where you see a doctor and go home the same day, without being admitted.',
      ta: 'மருத்துவரைப் பார்த்துவிட்டு அன்றே வீடு திரும்பும் பிரிவு — அனுமதிக்கப்பட வேண்டியதில்லை.',
      hi: 'वह विभाग जहाँ आप डॉक्टर से मिलकर उसी दिन घर लौट जाते हैं, भर्ती हुए बिना।',
    },
  },
  {
    id: 'ip',
    category: 'visit',
    term: { en: 'IP / Inpatient', ta: 'உள்நோயாளி', hi: 'आईपी / भर्ती मरीज़' },
    expansion: { en: 'In-Patient', ta: 'உள்நோயாளி பிரிவு', hi: 'अंतःरोगी' },
    definition: {
      en: 'When you are admitted and stay in a hospital bed for one or more nights.',
      ta: 'மருத்துவமனையில் அனுமதிக்கப்பட்டு ஒன்று அல்லது அதற்கு மேற்பட்ட இரவுகள் தங்குவது.',
      hi: 'जब आपको भर्ती किया जाता है और आप एक या अधिक रात अस्पताल के बिस्तर पर रहते हैं।',
    },
  },
  {
    id: 'casualty',
    category: 'visit',
    term: { en: 'Casualty', ta: 'அவசர பிரிவு', hi: 'कैज़ुअल्टी' },
    definition: {
      en: 'The emergency room. Open day and night for accidents and sudden illness — no appointment needed.',
      ta: 'அவசர சிகிச்சைப் பிரிவு. விபத்து மற்றும் திடீர் நோய்க்கு இரவு பகல் திறந்திருக்கும் — முன்பதிவு தேவையில்லை.',
      hi: 'आपातकालीन विभाग, जो चौबीसों घंटे खुला रहता है। गंभीर हालत में सीधे यहीं आएँ — अपॉइंटमेंट की ज़रूरत नहीं।',
    },
  },
  {
    id: 'icu',
    category: 'visit',
    term: { en: 'ICU', ta: 'ஐ.சி.யு.', hi: 'आईसीयू' },
    expansion: { en: 'Intensive Care Unit', ta: 'தீவிர சிகிச்சைப் பிரிவு', hi: 'गहन चिकित्सा कक्ष' },
    definition: {
      en: 'A ward for seriously ill patients who need constant monitoring and machine support.',
      ta: 'தொடர் கண்காணிப்பும் இயந்திர உதவியும் தேவைப்படும் கடுமையான நோயாளிகளுக்கான பிரிவு.',
      hi: 'गंभीर रूप से बीमार मरीज़ों के लिए वार्ड, जहाँ लगातार निगरानी और विशेष उपकरण रहते हैं।',
    },
  },
  {
    id: 'hdu',
    category: 'visit',
    term: { en: 'HDU', ta: 'எச்.டி.யு.' },
    expansion: { en: 'High Dependency Unit', ta: 'அதிக கவனிப்புப் பிரிவு' },
    definition: {
      en: 'A step between the ICU and a normal ward — closer watch than a ward, less than the ICU.',
      ta: 'ஐ.சி.யு.வுக்கும் சாதாரண வார்டுக்கும் இடைப்பட்ட பிரிவு — வார்டை விட அதிக கவனிப்பு.',
    },
  },
  {
    id: 'nicu',
    category: 'visit',
    term: { en: 'NICU', ta: 'என்.ஐ.சி.யு.', hi: 'एनआईसीयू' },
    expansion: { en: 'Neonatal Intensive Care Unit', ta: 'பச்சிளம் குழந்தைகள் தீவிர சிகிச்சைப் பிரிவு', hi: 'नवजात गहन चिकित्सा कक्ष' },
    definition: {
      en: 'Intensive care for newborn babies, especially those born early or underweight.',
      ta: 'பிறந்த குழந்தைகளுக்கான தீவிர சிகிச்சை — குறிப்பாக முன்கூட்டியே பிறந்த அல்லது எடை குறைந்த குழந்தைகளுக்கு.',
      hi: 'समय से पहले जन्मे या बीमार नवजात शिशुओं के लिए आईसीयू।',
    },
  },
  {
    id: 'consultation',
    category: 'visit',
    term: { en: 'Consultation', ta: 'ஆலோசனை', hi: 'परामर्श' },
    definition: {
      en: 'One meeting with a doctor: you describe the problem, they examine you and advise treatment.',
      ta: 'மருத்துவரிடம் ஒரு சந்திப்பு: பிரச்சினையைச் சொல்ல, அவர் பரிசோதித்து சிகிச்சை கூறுவார்.',
      hi: 'डॉक्टर से आपकी मुलाक़ात — वे आपकी तकलीफ़ सुनते हैं, जाँच करते हैं और आगे का इलाज बताते हैं।',
    },
  },
  {
    id: 'referral',
    category: 'visit',
    term: { en: 'Referral', ta: 'பரிந்துரை', hi: 'रेफ़रल' },
    definition: {
      en: 'When one doctor sends you to a specialist for a problem outside their field.',
      ta: 'ஒரு மருத்துவர் தன் துறைக்கு அப்பாற்பட்ட பிரச்சினைக்கு உங்களை நிபுணரிடம் அனுப்புவது.',
      hi: 'जब एक डॉक्टर आपको दूसरे विशेषज्ञ के पास भेजते हैं, क्योंकि आपकी तकलीफ़ उनके क्षेत्र की है।',
    },
  },
  {
    id: 'tnmc',
    category: 'visit',
    term: { en: 'TNMC / TNDC number', ta: 'TNMC / TNDC எண்' },
    expansion: {
      en: 'Tamil Nadu Medical / Dental Council registration',
      ta: 'தமிழ்நாடு மருத்துவ / பல் மருத்துவ கவுன்சில் பதிவு',
    },
    definition: {
      en: 'The licence number every practising doctor is registered under. It is how you verify a doctor is genuine.',
      ta: 'பயிற்சி செய்யும் ஒவ்வொரு மருத்துவரும் பதிவு செய்யப்படும் உரிம எண். மருத்துவர் உண்மையானவரா என்பதைச் சரிபார்க்க இதுவே வழி.',
    },
  },
  {
    id: 'tpa',
    category: 'visit',
    term: { en: 'TPA', ta: 'டி.பி.ஏ.' },
    expansion: { en: 'Third Party Administrator', ta: 'மூன்றாம் தரப்பு நிர்வாகி' },
    definition: {
      en: 'The company that settles your bill directly with your health insurer, so you pay less at the counter.',
      ta: 'உங்கள் மருத்துவக் காப்பீட்டு நிறுவனத்துடன் நேரடியாக பில் தீர்க்கும் நிறுவனம்.',
    },
  },
  {
    id: 'cmchis',
    category: 'visit',
    term: { en: 'CMCHIS', ta: 'சி.எம்.சி.எச்.ஐ.எஸ்.' },
    expansion: {
      en: 'Chief Minister’s Comprehensive Health Insurance Scheme',
      ta: 'முதலமைச்சரின் விரிவான மருத்துவக் காப்பீட்டுத் திட்டம்',
    },
    definition: {
      en: 'The Tamil Nadu government health scheme that covers treatment costs for eligible families.',
      ta: 'தகுதியான குடும்பங்களுக்கு சிகிச்சைச் செலவை ஈடுசெய்யும் தமிழ்நாடு அரசின் திட்டம்.',
    },
  },
  {
    id: 'nabl',
    category: 'visit',
    term: { en: 'NABL accredited', ta: 'NABL அங்கீகாரம்' },
    definition: {
      en: 'A national quality certification for laboratories — it means test results meet an audited standard.',
      ta: 'ஆய்வகங்களுக்கான தேசிய தரச் சான்று — பரிசோதனை முடிவுகள் தணிக்கை செய்யப்பட்ட தரத்தில் இருக்கும்.',
    },
  },

  /* ---------------- Qualifications ---------------- */
  {
    id: 'mbbs',
    category: 'qualification',
    term: { en: 'MBBS', ta: 'எம்.பி.பி.எஸ்.', hi: 'एमबीबीएस' },
    expansion: {
      en: 'Bachelor of Medicine, Bachelor of Surgery',
      ta: 'மருத்துவ இளங்கலை பட்டம்',
    },
    definition: {
      en: 'The basic medical degree. Everyone called “Doctor” in a hospital holds this first.',
      ta: 'அடிப்படை மருத்துவப் பட்டம். மருத்துவமனையில் “டாக்டர்” எனப்படும் அனைவரும் முதலில் பெறுவது இதுவே.',
      hi: 'भारत में डॉक्टर बनने की बुनियादी चिकित्सा डिग्री।',
    },
  },
  {
    id: 'md',
    category: 'qualification',
    term: { en: 'MD', ta: 'எம்.டி.' },
    expansion: { en: 'Doctor of Medicine', ta: 'மருத்துவ முதுகலை' },
    definition: {
      en: 'A three-year postgraduate degree in a medical (non-surgical) speciality such as general medicine or paediatrics.',
      ta: 'பொது மருத்துவம், குழந்தை நலம் போன்ற (அறுவை அல்லாத) துறைகளில் மூன்றாண்டு முதுகலைப் பட்டம்.',
    },
  },
  {
    id: 'ms',
    category: 'qualification',
    term: { en: 'MS', ta: 'எம்.எஸ்.' },
    expansion: { en: 'Master of Surgery', ta: 'அறுவை சிகிச்சை முதுகலை' },
    definition: {
      en: 'A postgraduate degree in a surgical speciality — orthopaedics, ENT, eye surgery and so on.',
      ta: 'எலும்பியல், காது மூக்கு தொண்டை, கண் அறுவை போன்ற அறுவை சிகிச்சைத் துறைகளில் முதுகலைப் பட்டம்.',
    },
  },
  {
    id: 'dm',
    category: 'qualification',
    term: { en: 'DM', ta: 'டி.எம்.' },
    expansion: { en: 'Doctorate of Medicine', ta: 'மேல்நிலை மருத்துவ முனைவர்' },
    definition: {
      en: 'A super-speciality qualification taken after MD — for example cardiology, neurology or nephrology.',
      ta: 'எம்.டி.க்குப் பின் பெறும் மேல்நிலைச் சிறப்புத் தகுதி — எ.கா. இருதயவியல், நரம்பியல், சிறுநீரகவியல்.',
    },
  },
  {
    id: 'mch',
    category: 'qualification',
    term: { en: 'MCh', ta: 'எம்.சி.எச்.' },
    expansion: { en: 'Master of Chirurgiae', ta: 'மேல்நிலை அறுவை சிகிச்சை முனைவர்' },
    definition: {
      en: 'The surgical equivalent of DM — a super-speciality taken after MS, such as urology or neurosurgery.',
      ta: 'டி.எம்.க்கு இணையான அறுவை சிகிச்சைத் தகுதி — எ.கா. சிறுநீர் பாதை, நரம்பியல் அறுவை சிகிச்சை.',
    },
  },
  {
    id: 'dnb',
    category: 'qualification',
    term: { en: 'DNB', ta: 'டி.என்.பி.' },
    expansion: { en: 'Diplomate of National Board', ta: 'தேசிய வாரிய பட்டயம்' },
    definition: {
      en: 'A postgraduate qualification awarded by the National Board of Examinations, treated as equal to MD or MS.',
      ta: 'தேசிய தேர்வு வாரியம் வழங்கும் முதுகலைத் தகுதி — எம்.டி. / எம்.எஸ். அளவிற்கு சமமானது.',
    },
  },
  {
    id: 'diploma',
    category: 'qualification',
    term: { en: 'DCH, DGO, DLO, DO, D.Ortho', ta: 'DCH, DGO, DLO, DO, D.Ortho' },
    definition: {
      en: 'Two-year postgraduate diplomas in child health, gynaecology, ENT, eye care and orthopaedics respectively.',
      ta: 'குழந்தை நலம், மகளிர் நலம், காது மூக்கு தொண்டை, கண், எலும்பியல் ஆகியவற்றில் இரண்டாண்டு முதுகலை பட்டயங்கள்.',
    },
  },
  {
    id: 'bds',
    category: 'qualification',
    term: { en: 'BDS / MDS', ta: 'பி.டி.எஸ். / எம்.டி.எஸ்.' },
    expansion: {
      en: 'Bachelor / Master of Dental Surgery',
      ta: 'பல் மருத்துவ இளங்கலை / முதுகலை',
    },
    definition: {
      en: 'The basic and postgraduate dental degrees. MDS holders specialise — braces, root canals, jaw surgery.',
      ta: 'பல் மருத்துவத்தின் அடிப்படை மற்றும் முதுகலைப் பட்டங்கள். எம்.டி.எஸ். பெற்றவர்கள் சிறப்புத் துறைகளில் நிபுணர்கள்.',
    },
  },
  {
    id: 'fellowship',
    category: 'qualification',
    term: { en: 'Fellowship', ta: 'ஃபெலோஷிப்' },
    definition: {
      en: 'Extra training in a narrow area after the main degree — for example spine surgery or reproductive medicine.',
      ta: 'முதன்மைப் பட்டத்திற்குப் பின் ஒரு குறுகிய துறையில் பெறும் கூடுதல் பயிற்சி.',
    },
  },
  {
    id: 'frcp',
    category: 'qualification',
    term: { en: 'FRCP, MRCEM, FMAS, FVRS', ta: 'FRCP, MRCEM, FMAS, FVRS' },
    definition: {
      en: 'Memberships and fellowships of professional colleges, usually earned by further examination in India or the UK.',
      ta: 'இந்தியா அல்லது இங்கிலாந்தில் கூடுதல் தேர்வு மூலம் பெறப்படும் தொழில் கல்லூரி உறுப்பினர் தகுதிகள்.',
    },
  },

  /* ---------------- Grades ---------------- */
  {
    id: 'grade-chief',
    category: 'grade',
    term: { en: 'Chief Consultant', ta: 'தலைமை ஆலோசகர்' },
    definition: {
      en: 'The most senior doctor in the hospital or a department, usually with the longest experience.',
      ta: 'மருத்துவமனை அல்லது துறையின் மிக மூத்த மருத்துவர் — பொதுவாக அதிக அனுபவம் உள்ளவர்.',
    },
  },
  {
    id: 'grade-senior',
    category: 'grade',
    term: { en: 'Senior Consultant', ta: 'மூத்த ஆலோசகர்' },
    definition: {
      en: 'An experienced specialist who leads difficult cases and supervises junior doctors.',
      ta: 'கடினமான வழக்குகளை கையாளும், இளநிலை மருத்துவர்களை மேற்பார்வையிடும் அனுபவமிக்க நிபுணர்.',
    },
  },
  {
    id: 'grade-consultant',
    category: 'grade',
    term: { en: 'Consultant', ta: 'ஆலோசகர்' },
    definition: {
      en: 'A fully qualified specialist who runs their own clinic and treats patients independently.',
      ta: 'சொந்தமாக ஆலோசனை வழங்கி, தனித்து நோயாளிகளுக்குச் சிகிச்சை அளிக்கும் முழுத் தகுதி பெற்ற நிபுணர்.',
    },
  },
  {
    id: 'grade-visiting',
    category: 'grade',
    term: { en: 'Visiting Consultant', ta: 'வருகை ஆலோசகர்' },
    definition: {
      en: 'A specialist who attends only on fixed days — book early, as their slots are limited.',
      ta: 'குறிப்பிட்ட நாட்களில் மட்டும் வரும் நிபுணர் — நேரம் குறைவு என்பதால் முன்கூட்டியே பதிவு செய்யுங்கள்.',
    },
  },
  {
    id: 'grade-dmo',
    category: 'grade',
    term: { en: 'Duty Medical Officer', ta: 'பணி மருத்துவ அலுவலர்' },
    definition: {
      en: 'The doctor on shift in casualty who sees you first in an emergency and calls in specialists if needed.',
      ta: 'அவசரப் பிரிவில் பணியில் இருந்து முதலில் உங்களைப் பார்க்கும் மருத்துவர்; தேவைப்பட்டால் நிபுணரை அழைப்பார்.',
    },
  },

  /* ---------------- Tests & procedures ---------------- */
  {
    id: 'ecg',
    category: 'test',
    term: { en: 'ECG', ta: 'ஈ.சி.ஜி.', hi: 'ईसीजी' },
    expansion: { en: 'Electrocardiogram', ta: 'இதயத் துடிப்பு வரைபடம்', hi: 'इलेक्ट्रोकार्डियोग्राम' },
    definition: {
      en: 'A painless five-minute test that records the heart’s electrical activity using stickers on your chest.',
      ta: 'மார்பில் ஒட்டும் சிறு தகடுகள் மூலம் இதயத்தின் மின் இயக்கத்தைப் பதிவு செய்யும் வலியில்லாத ஐந்து நிமிடச் சோதனை.',
      hi: 'दिल की धड़कन की विद्युत गतिविधि दर्ज करने वाली त्वरित, दर्दरहित जाँच।',
    },
  },
  {
    id: 'echo',
    category: 'test',
    term: { en: 'Echo', ta: 'எக்கோ' },
    expansion: { en: 'Echocardiogram', ta: 'இதய ஒலி அலை ஸ்கேன்' },
    definition: {
      en: 'An ultrasound scan of the heart that shows how well the valves and pumping chambers work.',
      ta: 'இதய வால்வுகளும் அறைகளும் எப்படி இயங்குகின்றன என்பதைக் காட்டும் ஒலி அலை ஸ்கேன்.',
    },
  },
  {
    id: 'tmt',
    category: 'test',
    term: { en: 'TMT', ta: 'டி.எம்.டி.' },
    expansion: { en: 'Treadmill Test', ta: 'டிரெட்மில் சோதனை' },
    definition: {
      en: 'An ECG recorded while you walk on a treadmill, to see how the heart behaves under effort.',
      ta: 'டிரெட்மில்லில் நடக்கும்போது எடுக்கப்படும் ஈ.சி.ஜி. — உழைப்பின்போது இதயம் எப்படி செயல்படுகிறது எனக் காண.',
    },
  },
  {
    id: 'angiogram',
    category: 'test',
    term: { en: 'Angiogram', ta: 'ஆஞ்சியோகிராம்' },
    definition: {
      en: 'A dye is injected into the heart’s arteries and X-rayed to find blockages.',
      ta: 'இதய ரத்தக் குழாய்களில் சாயம் செலுத்தி எக்ஸ்-ரே எடுத்து அடைப்புகளைக் கண்டறியும் பரிசோதனை.',
    },
  },
  {
    id: 'angioplasty',
    category: 'test',
    term: { en: 'Angioplasty', ta: 'ஆஞ்சியோபிளாஸ்டி' },
    definition: {
      en: 'A blocked heart artery is opened with a small balloon and usually held open with a stent.',
      ta: 'அடைபட்ட இதயக் குழாயை சிறு பலூன் மூலம் திறந்து, ஸ்டெண்ட் பொருத்தி வைத்திருக்கும் சிகிச்சை.',
    },
  },
  {
    id: 'dialysis',
    category: 'test',
    term: { en: 'Dialysis', ta: 'டயாலிசிஸ்', hi: 'डायलिसिस' },
    definition: {
      en: 'A machine cleans waste and extra water from the blood when the kidneys can no longer do it.',
      ta: 'சிறுநீரகம் இயங்காதபோது, ரத்தத்திலிருந்து கழிவுகளையும் நீரையும் இயந்திரம் வடிகட்டும் சிகிச்சை.',
      hi: 'जब गुर्दे ठीक से काम नहीं करते, तब मशीन से खून साफ़ करने की प्रक्रिया।',
    },
  },
  {
    id: 'mri',
    category: 'test',
    term: { en: 'MRI', ta: 'எம்.ஆர்.ஐ.', hi: 'एमआरआई' },
    expansion: { en: 'Magnetic Resonance Imaging', ta: 'காந்த அதிர்வு படமெடுப்பு', hi: 'चुंबकीय अनुनाद इमेजिंग' },
    definition: {
      en: 'A scan that uses a strong magnet — no X-rays — to take detailed pictures of soft tissue like the brain, spine, joints and muscles. You lie still inside a tube for 20–45 minutes and it is noisy, but painless.',
      ta: 'வலிமையான காந்தத்தைப் பயன்படுத்தி — எக்ஸ்-கதிர் இல்லாமல் — மூளை, முதுகுத்தண்டு, மூட்டு, தசை போன்றவற்றின் விரிவான படங்களை எடுக்கும் ஸ்கேன். 20–45 நிமிடம் அசையாமல் படுக்க வேண்டும்; சத்தமாக இருக்கும், ஆனால் வலி இல்லை.',
      hi: 'एक जाँच जो चुम्बक और रेडियो तरंगों से शरीर के भीतर की विस्तृत तस्वीरें बनाती है। इसमें एक्स-रे विकिरण नहीं होता।',
    },
  },
  {
    id: 'ct',
    category: 'test',
    term: { en: 'CT scan', ta: 'சி.டி. ஸ்கேன்', hi: 'सीटी स्कैन' },
    expansion: { en: 'Computed Tomography', ta: 'கணினி டோமோகிராபி', hi: 'कंप्यूटेड टोमोग्राफ़ी' },
    definition: {
      en: 'A series of X-ray pictures built into cross-sections of the body. Faster than an MRI and better for bone, bleeding and chest problems. Takes a few minutes.',
      ta: 'உடலின் குறுக்குவெட்டுப் படங்களாக உருவாக்கப்படும் எக்ஸ்-கதிர் தொடர். எம்.ஆர்.ஐ.-ஐ விட வேகமானது; எலும்பு, ரத்தக்கசிவு, நெஞ்சுப் பிரச்சினைகளுக்கு ஏற்றது. சில நிமிடங்களே ஆகும்.',
      hi: 'कई एक्स-रे मिलाकर शरीर के भीतर की परत-दर-परत तस्वीरें बनाने वाली जाँच।',
    },
  },
  {
    id: 'xray',
    category: 'test',
    term: { en: 'X-ray', ta: 'எக்ஸ்-ரே', hi: 'एक्स-रे' },
    definition: {
      en: 'A quick picture of bones and the chest using a small dose of radiation. Takes a minute and is painless.',
      ta: 'குறைந்த அளவு கதிர்வீச்சைப் பயன்படுத்தி எலும்பு, நெஞ்சின் படம் எடுக்கும் விரைவான பரிசோதனை. ஒரு நிமிடம், வலி இல்லை.',
      hi: 'हड्डियों और छाती की तस्वीर लेने वाली त्वरित जाँच।',
    },
  },
  {
    id: 'ultrasound',
    category: 'test',
    term: { en: 'Ultrasound / Scan', ta: 'அல்ட்ராசவுண்ட் / ஸ்கேன்', hi: 'अल्ट्रासाउंड' },
    definition: {
      en: 'Sound waves are used to see inside the abdomen, or to check a baby during pregnancy. A gel is applied and a probe moved over the skin. No radiation, no pain.',
      ta: 'ஒலி அலைகள் மூலம் வயிற்றின் உள்ளே பார்க்கவும், கர்ப்ப காலத்தில் குழந்தையைப் பரிசோதிக்கவும் பயன்படும். ஜெல் தடவி, தோலின் மேல் கருவியை நகர்த்துவார்கள். கதிர்வீச்சு இல்லை, வலி இல்லை.',
      hi: 'ध्वनि तरंगों से शरीर के भीतर देखने वाली जाँच। गर्भावस्था में इसी से जाँच होती है; इसमें विकिरण नहीं होता।',
    },
  },
  {
    id: 'biopsy',
    category: 'test',
    term: { en: 'Biopsy', ta: 'பயாப்ஸி' },
    definition: {
      en: 'A small piece of tissue is taken and examined under a microscope to find out exactly what a lump or patch is. Being sent for one does not mean the result will be serious.',
      ta: 'ஒரு கட்டி அல்லது புள்ளி என்னவென்று துல்லியமாக அறிய, சிறிய திசுத் துண்டை எடுத்து நுண்ணோக்கியில் பரிசோதிப்பது. இது பரிந்துரைக்கப்படுவது தீவிரமான முடிவு என்று அர்த்தமல்ல.',
    },
  },
  {
    id: 'bloodtest',
    category: 'test',
    term: { en: 'Blood test / CBC', ta: 'ரத்தப் பரிசோதனை / சி.பி.சி.', hi: 'रक्त जाँच' },
    expansion: { en: 'Complete Blood Count', ta: 'முழு ரத்த எண்ணிக்கை' },
    definition: {
      en: 'A small sample of blood checked in the lab. A CBC counts the different blood cells and is the usual first test for fever, tiredness and infection. Some tests need you to come fasting — the lab will say.',
      ta: 'ஆய்வகத்தில் பரிசோதிக்கப்படும் சிறிய ரத்த மாதிரி. சி.பி.சி. வெவ்வேறு ரத்த அணுக்களை எண்ணும்; காய்ச்சல், சோர்வு, தொற்றுக்கு முதலில் செய்யப்படும் பரிசோதனை. சில பரிசோதனைகளுக்கு வெறும் வயிற்றில் வர வேண்டும் — ஆய்வகம் சொல்லும்.',
      hi: 'खून का नमूना लेकर की जाने वाली जाँच — जैसे शुगर, हीमोग्लोबिन या संक्रमण देखना।',
    },
  },
  {
    id: 'endoscopy',
    category: 'test',
    term: { en: 'Endoscopy', ta: 'எண்டோஸ்கோபி' },
    definition: {
      en: 'A thin tube with a camera is passed through the mouth to look inside the food pipe and stomach.',
      ta: 'கேமரா பொருத்திய மெல்லிய குழாயை வாய் வழியாகச் செலுத்தி உணவுக் குழாய், இரைப்பையைப் பார்க்கும் பரிசோதனை.',
    },
  },
  {
    id: 'eeg',
    category: 'test',
    term: { en: 'EEG', ta: 'ஈ.ஈ.ஜி.' },
    expansion: { en: 'Electroencephalogram', ta: 'மூளை அலை வரைபடம்' },
    definition: {
      en: 'Records the brain’s electrical waves through the scalp — mainly used to investigate fits.',
      ta: 'உச்சந்தலை வழியாக மூளையின் மின் அலைகளைப் பதிவு செய்யும் சோதனை — முக்கியமாக வலிப்புக்கு.',
    },
  },
  {
    id: 'audiometry',
    category: 'test',
    term: { en: 'Audiometry', ta: 'செவித்திறன் பரிசோதனை' },
    definition: {
      en: 'A hearing test with headphones that measures the softest sound each ear can pick up.',
      ta: 'ஹெட்ஃபோன் மூலம் ஒவ்வொரு காதும் கேட்கும் மென்மையான ஒலியை அளவிடும் சோதனை.',
    },
  },
  {
    id: 'phaco',
    category: 'test',
    term: { en: 'Phaco cataract surgery', ta: 'ஃபேக்கோ கண்புரை அறுவை சிகிச்சை' },
    definition: {
      en: 'The clouded lens is broken up by sound waves through a tiny cut and replaced with a clear lens.',
      ta: 'மங்கிய லென்ஸை ஒலி அலைகளால் உடைத்து, சிறு கீறல் வழியாக அகற்றி, தெளிவான லென்ஸ் பொருத்தும் சிகிச்சை.',
    },
  },
  {
    id: 'arthroscopy',
    category: 'test',
    term: { en: 'Arthroscopy', ta: 'ஆர்த்ரோஸ்கோபி' },
    definition: {
      en: 'Keyhole surgery on a joint — a camera and fine tools go in through two small cuts.',
      ta: 'மூட்டில் இரண்டு சிறு கீறல்கள் வழியாக கேமரா மற்றும் கருவிகள் செலுத்தி செய்யப்படும் அறுவை சிகிச்சை.',
    },
  },
  {
    id: 'chemo',
    category: 'test',
    term: { en: 'Chemotherapy', ta: 'கீமோதெரபி' },
    definition: {
      en: 'Cancer medicines given through a drip or as tablets, usually in cycles over several months.',
      ta: 'சொட்டு மருந்து அல்லது மாத்திரை வடிவில், பல மாதங்களுக்குச் சுழற்சி முறையில் தரப்படும் புற்றுநோய் மருந்துகள்.',
    },
  },
  {
    id: 'masterhealth',
    category: 'test',
    term: { en: 'Master health check-up', ta: 'முழு உடல் பரிசோதனை' },
    definition: {
      en: 'A bundled set of blood tests, scans and a doctor review, done once a year to catch problems early.',
      ta: 'ஆண்டுக்கு ஒருமுறை செய்யப்படும் ரத்தப் பரிசோதனை, ஸ்கேன் மற்றும் மருத்துவர் ஆய்வு அடங்கிய தொகுப்பு.',
    },
  },

  /* ---------------- Booking terms ---------------- */
  {
    id: 'slot',
    category: 'booking',
    term: { en: 'Time slot', ta: 'நேர இடைவெளி', hi: 'समय' },
    definition: {
      en: 'A 20-minute window reserved for you. Only one patient is booked per slot per doctor.',
      ta: 'உங்களுக்கு ஒதுக்கப்பட்ட 20 நிமிட நேரம். ஒரு மருத்துவரின் ஒரு நேரத்திற்கு ஒரு நோயாளி மட்டுமே.',
      hi: 'दिन का वह निश्चित समय जो आपकी अपॉइंटमेंट के लिए सुरक्षित रखा जाता है।',
    },
  },
  {
    id: 'session',
    category: 'booking',
    term: { en: 'Morning / Evening session', ta: 'காலை / மாலை அமர்வு' },
    definition: {
      en: 'Doctors consult in two blocks a day. Morning is roughly 8 am–1 pm, evening 4 pm–9 pm.',
      ta: 'மருத்துவர்கள் நாளொன்றுக்கு இரண்டு அமர்வுகளில் ஆலோசனை வழங்குகிறார்கள் — காலை 8–1, மாலை 4–9.',
    },
  },
  {
    id: 'appointment-id',
    category: 'booking',
    term: { en: 'Appointment ID', ta: 'சந்திப்பு எண்' },
    definition: {
      en: 'The DH-XXXXXX code given when you book. Show it at reception to find your booking instantly.',
      ta: 'பதிவு செய்யும்போது கிடைக்கும் DH-XXXXXX குறியீடு. வரவேற்பில் காட்டினால் உடனே பதிவு கிடைக்கும்.',
    },
  },
  {
    id: 'consulting-days',
    category: 'booking',
    term: { en: 'Consulting days', ta: 'ஆலோசனை நாட்கள்' },
    definition: {
      en: 'The days of the week a particular doctor sees patients. Other dates cannot be selected.',
      ta: 'ஒரு மருத்துவர் நோயாளிகளைப் பார்க்கும் வார நாட்கள். மற்ற தேதிகளைத் தேர்வு செய்ய முடியாது.',
    },
  },
  {
    id: 'reschedule',
    category: 'booking',
    term: { en: 'Reschedule', ta: 'நேரம் மாற்றுதல்' },
    definition: {
      en: 'Moving an existing booking to a different date or time. Your appointment ID stays the same.',
      ta: 'ஏற்கனவே உள்ள பதிவை வேறு தேதி அல்லது நேரத்திற்கு மாற்றுவது. சந்திப்பு எண் மாறாது.',
    },
  },

  /* ---------------- Payment terms ---------------- */
  {
    id: 'consultation-fee',
    category: 'payment',
    term: { en: 'Consultation fee', ta: 'ஆலோசனைக் கட்டணம்', hi: 'परामर्श शुल्क' },
    definition: {
      en: 'What the doctor charges for the visit itself. Tests, scans and medicines are billed separately.',
      ta: 'மருத்துவரைச் சந்திப்பதற்கான கட்டணம் மட்டும். பரிசோதனை, ஸ்கேன், மருந்துகள் தனியாகக் கணக்கிடப்படும்.',
      hi: 'डॉक्टर से एक बार मिलने का शुल्क। जाँच, स्कैन और दवाइयों का बिल अलग बनता है।',
    },
  },
  {
    id: 'convenience-fee',
    category: 'payment',
    term: { en: 'Convenience fee', ta: 'சேவைக் கட்டணம்' },
    definition: {
      en: 'A small charge added when you pay online. It is not charged if you pay at the hospital counter.',
      ta: 'இணையவழி கட்டணம் செலுத்தும்போது சேர்க்கப்படும் சிறு கட்டணம். மருத்துவமனையில் செலுத்தினால் இது இல்லை.',
    },
  },
  {
    id: 'upi',
    category: 'payment',
    term: { en: 'UPI', ta: 'யு.பி.ஐ.', hi: 'यूपीआई' },
    expansion: { en: 'Unified Payments Interface', ta: 'ஒருங்கிணைந்த கட்டண இடைமுகம்', hi: 'यूनिफ़ाइड पेमेंट्स इंटरफ़ेस' },
    definition: {
      en: 'India’s instant bank-to-bank payment system, used through apps like GPay, PhonePe and Paytm.',
      ta: 'ஜிபே, போன்பே, பேடிஎம் போன்ற செயலிகள் மூலம் பயன்படுத்தப்படும் இந்தியாவின் உடனடி வங்கிக் கட்டண முறை.',
      hi: 'भारत में तुरंत पैसे भेजने की व्यवस्था — जैसे GPay, PhonePe या Paytm से भुगतान।',
    },
  },
  {
    id: 'upi-id',
    category: 'payment',
    term: { en: 'UPI ID', ta: 'யு.பி.ஐ. முகவரி' },
    definition: {
      en: 'Your payment address, written like name@bank. It identifies your account without revealing the number.',
      ta: 'name@bank வடிவில் உள்ள உங்கள் கட்டண முகவரி. கணக்கு எண்ணைக் காட்டாமல் கணக்கை அடையாளம் காட்டும்.',
    },
  },
  {
    id: 'cvv',
    category: 'payment',
    term: { en: 'CVV', ta: 'சி.வி.வி.' },
    expansion: { en: 'Card Verification Value', ta: 'அட்டை சரிபார்ப்பு எண்' },
    definition: {
      en: 'The 3-digit number on the back of your card. Never share it over phone or message with anyone.',
      ta: 'அட்டையின் பின்புறம் உள்ள 3 இலக்க எண். இதை யாருடனும் தொலைபேசி அல்லது செய்தி வழியாகப் பகிர வேண்டாம்.',
    },
  },
  {
    id: 'reference',
    category: 'payment',
    term: { en: 'Payment reference', ta: 'கட்டணக் குறிப்பு எண்' },
    definition: {
      en: 'The transaction number for your payment. Quote it if a payment has to be traced or refunded.',
      ta: 'உங்கள் கட்டணத்தின் பரிவர்த்தனை எண். கட்டணத்தைக் கண்டறியவோ திரும்பப் பெறவோ இதைக் குறிப்பிடவும்.',
    },
  },
]

export const getGlossaryEntry = (id) => GLOSSARY.find((entry) => entry.id === id)
