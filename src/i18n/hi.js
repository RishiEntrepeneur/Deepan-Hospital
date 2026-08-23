/**
 * Hindi.
 *
 * In its own file, unlike English and Tamil which share `translations.js`.
 * That shared file is two thousand-line blocks that must stay in lockstep, and
 * it caused four separate bugs in one day — Hindi text landing in the English
 * block, where a patient reading English would have been shown Hindi. A file
 * per language makes that mistake impossible to write.
 *
 * Coverage was deliberately partial for a long time — the booking journey
 * first — and it is complete now, so this file is held to the same parity as
 * Tamil: `npm run i18n:check` fails on a key English has and Hindi does not.
 * Anything missing would still fall back to English automatically (see
 * LanguageContext), so a gap reads as English rather than as a broken key —
 * that safety net stays, it is just no longer somewhere to leave work.
 *
 * Register: plain, respectful Hindi as spoken rather than Sanskritised
 * officialese — "अपॉइंटमेंट" and "डॉक्टर" are what people actually say, and a
 * hospital is no place to make someone decode vocabulary.
 */
export const hi = {
  /* ---------- Brand ---------- */
  'brand.name': 'दीपन अस्पताल',
  'brand.tagline': '1986 से सेवा में',
  'brand.short': 'दीपन',

  /* ---------- Navigation ---------- */
  'nav.home': 'होम',
  'nav.doctors': 'डॉक्टर',
  'nav.services': 'विभाग',
  'nav.appointments': 'मेरी अपॉइंटमेंट',
  'nav.health': 'मेरा स्वास्थ्य',
  'nav.glossary': 'मदद और शब्दावली',
  'nav.contact': 'संपर्क',
  'nav.privacy': 'निजता',
  'nav.menu': 'मेन्यू',
  'nav.openMenu': 'मेन्यू खोलें',
  'nav.closeMenu': 'मेन्यू बंद करें',
  'nav.language': 'भाषा',
  'nav.switchLanguage': 'भाषा बदलें',

  /* ---------- Common actions ---------- */
  'action.book': 'अपॉइंटमेंट बुक करें',
  'action.bookShort': 'बुक करें',
  'action.cancel': 'रद्द करें',
  'action.close': 'बंद करें',
  'action.back': 'पीछे',
  'action.next': 'आगे',
  'action.continue': 'जारी रखें',
  'action.confirm': 'पुष्टि करें',
  'action.search': 'खोजें',
  'action.clear': 'हटाएँ',
  'action.clearFilters': 'फ़िल्टर हटाएँ',
  'action.viewAll': 'सभी देखें',
  'action.learnMore': 'और जानें',
  'action.callNow': 'अभी कॉल करें',
  'action.download': 'डाउनलोड करें',
  'action.print': 'प्रिंट करें',
  'action.done': 'हो गया',
  'action.reschedule': 'समय बदलें',
  'action.cancelBooking': 'अपॉइंटमेंट रद्द करें',
  'action.keepIt': 'रहने दें',
  'action.yesCancel': 'हाँ, रद्द करें',
  'action.viewDetails': 'विवरण देखें',
  'action.hideDetails': 'विवरण छिपाएँ',
  'action.bookAnother': 'दूसरी अपॉइंटमेंट बुक करें',
  'action.copyNumber': 'नंबर कॉपी करें',
  'action.copied': 'कॉपी हो गया',
  'action.requestShort': 'कॉल का अनुरोध',

  /* ---------- Home ---------- */
  'home.heroTitle': 'आपका स्वास्थ्य, हमारी प्राथमिकता',
  'home.heroSubtitle':
    'एक मिनट से भी कम में हमारे विशेषज्ञों से अपॉइंटमेंट लें। चौबीसों घंटे आपातकालीन और गहन चिकित्सा, हर बड़े विभाग में विशेषज्ञ डॉक्टर।',
  'home.heroBadge': 'ऑनलाइन अपॉइंटमेंट चालू है',
  'home.statDoctors': 'विशेषज्ञ डॉक्टर',
  'home.statDepartments': 'विभाग',
  'home.statYears': 'वर्षों की सेवा',
  'home.quickTitle': 'सामान्य विभाग',
  'home.quickSubtitle': 'जिस विभाग की ज़रूरत हो उसे चुनें, समय चुनें और आ जाइए।',
  'home.whyTitle': 'परिवार दीपन को क्यों चुनते हैं',
  'home.whySubtitle': 'सहानुभूतिपूर्ण, किफ़ायती और हमेशा उपलब्ध।',
  'home.why1Title': '24×7 आपातकालीन सेवा',
  'home.why1Text': 'एम्बुलेंस, ट्रॉमा टीम और आईसीयू बेड चौबीसों घंटे उपलब्ध।',
  'home.why2Title': 'अनुभवी डॉक्टर',
  'home.why2Text': 'हर विभाग में योग्य विशेषज्ञ सलाहकार।',
  'home.why3Title': 'साफ़ और आधुनिक',
  'home.why3Text': 'साफ़-सुथरे वार्ड, आधुनिक जाँच और उसी दिन रिपोर्ट।',
  'home.why4Title': 'आपकी भाषा में',
  'home.why4Text': 'हमारे डॉक्टर तमिल, अंग्रेज़ी, हिंदी और तेलुगु में बात करते हैं।',
  'home.featuredDoctors': 'हमारे डॉक्टर',
  'home.featuredDoctorsSub': 'हर विभाग के विशेषज्ञ सलाहकार।',
  'home.ctaTitle': 'डॉक्टर से मिलने के लिए तैयार हैं?',
  'home.ctaText': 'अपना विभाग चुनें, समय चुनें और सीधे आइए — कतार नहीं।',

  /* ---------- Doctors ---------- */
  'doctors.title': 'हमारे डॉक्टर',
  'doctors.subtitle': 'दीपन अस्पताल में काम करने वाले विशेषज्ञ सलाहकार।',
  'doctors.searchPlaceholder': 'नाम या विशेषज्ञता से खोजें…',
  'doctors.filterByDept': 'विभाग से छाँटें',
  'doctors.allDepartments': 'सभी विभाग',
  'doctors.none': 'कोई डॉक्टर नहीं मिला',
  'doctors.noneHint': 'कोई दूसरा विभाग चुनें या खोज बदलें।',
  'doctors.experience': 'अनुभव',
  'doctors.languages': 'बोलते हैं',
  'doctors.room': 'कमरा',
  'doctors.fee': 'परामर्श शुल्क',
  'doctors.feeOnRequest': 'पूछने पर',
  'doctors.availableToday': 'आज उपलब्ध',
  'doctors.notToday': 'आज उपलब्ध नहीं',
  'doctors.regNo': 'पंजीकरण संख्या',
  'doctors.pendingNoticeTitle': 'सभी डॉक्टरों का समय अभी प्रकाशित नहीं है।',
  'doctors.pendingNoticeText':
    'जिनका समय तय है उन्हें आप सीधे बुक कर सकते हैं। बाकियों के लिए कॉल का अनुरोध करें — रिसेप्शन आपको फ़ोन करके समय तय करेगा।',

  'doctors.count': '{count} डॉक्टर उपलब्ध',
  'doctors.countOne': '1 डॉक्टर उपलब्ध',
  'doctors.timings': 'समय',
  'doctors.timingsOnRequest': 'समय पूछने पर',
  'services.byArrangement': 'रिसेप्शन को कॉल करके समय लें',
  'services.doctorsInDept': '{count} डॉक्टर',
  'services.doctorsInDeptOne': '1 डॉक्टर',
  'services.viewDoctors': 'डॉक्टर देखें',
  'booking.noDoctorsInDept': 'इस विभाग में अभी कोई डॉक्टर सूचीबद्ध नहीं है।',
  'doctor.listenSummary': 'डॉक्टर का विवरण सुनें',

  /* ---------- Doctor profile ---------- */
  'doctor.notFound': 'यह डॉक्टर सूची में नहीं हैं।',
  'doctor.noAbout':
    '{name} किन बीमारियों का इलाज करते हैं, यह परामर्श के समय पूछ लें — यहाँ विवरण प्रकाशित नहीं किया गया है।',
  'doctor.bookableNow': 'ऑनलाइन बुक कर सकते हैं',
  'doctor.callbackOnly': 'सिर्फ़ कॉल पर',
  'doctor.requestCallback': 'कॉल का अनुरोध करें',
  'doctor.callReception': 'रिसेप्शन को कॉल करें',
  'doctor.specialist': 'विशेषज्ञ',
  'doctor.superSpecialist': 'सुपर स्पेशलिस्ट',
  'doctor.yearsExperience': '{count} वर्ष का अनुभव',
  'doctor.regNoLine':
    'चिकित्सा पंजीकरण संख्या {number}। आप इसे तमिलनाडु मेडिकल काउंसिल की सार्वजनिक सूची में स्वयं जाँच सकते हैं।',
  'doctor.regNoMissing':
    'अस्पताल ने इन डॉक्टर की पंजीकरण संख्या अभी दर्ज नहीं की है। रिसेप्शन से पूछें, या तमिलनाडु मेडिकल काउंसिल की सूची में नाम से खोजें।',
  'doctor.department': 'विभाग',
  'doctor.consultingDays': 'परामर्श के दिन',
  'doctor.timingsNotPublished': 'अभी प्रकाशित नहीं — रिसेप्शन समय तय करेगा।',
  'doctor.speaks': 'बोलते हैं',
  'doctor.room': 'कमरा',
  'doctor.morning': 'सुबह',
  'doctor.evening': 'शाम',
  'doctor.awayBetween': 'ये डॉक्टर {from} से {to} तक उपलब्ध नहीं हैं। उन तारीख़ों के लिए बुकिंग बंद है।',
  'doctor.viewProfile': 'प्रोफ़ाइल देखें',

  /* ---------- Booking ---------- */
  'booking.title': 'अपॉइंटमेंट बुक करें',
  'booking.step': 'चरण {current} / {total}',
  'booking.step1': 'विभाग और डॉक्टर',
  'booking.step2': 'तारीख़ और समय',
  'booking.step3': 'मरीज़ का विवरण',
  'booking.guestTitle': 'अतिथि के रूप में बुकिंग',
  'booking.guestBody':
    'खाते की ज़रूरत नहीं है। नीचे विवरण भरें — अपॉइंटमेंट देखने या रद्द करने के लिए हम आपको एक रेफरेंस नंबर देंगे।',
  'booking.guestSignIn': 'इसके बजाय साइन इन करें',
  'booking.step4': 'भुगतान',
  'booking.step5': 'पुष्टि',
  'booking.selectDepartment': 'विभाग चुनें',
  'booking.selectDoctor': 'डॉक्टर चुनें',
  'booking.chooseDeptFirst': 'डॉक्टर देखने के लिए पहले विभाग चुनें।',
  'booking.selectDate': 'तारीख़ चुनें',
  'booking.selectSlot': 'समय चुनें',
  'booking.morningSlots': 'सुबह के समय',
  'booking.eveningSlots': 'शाम के समय',
  'booking.noSlots': 'इस दिन कोई समय उपलब्ध नहीं है।',
  'booking.patientDetails': 'मरीज़ का विवरण',
  'booking.summary': 'अपॉइंटमेंट का सारांश',
  'booking.successTitle': 'अपॉइंटमेंट पक्की हो गई',
  'booking.successText':
    'आपकी अपॉइंटमेंट बुक हो गई है और हम आपका इंतज़ार करेंगे। कृपया 15 मिनट पहले आएँ और पहचान पत्र साथ लाएँ।',
  'booking.heldTitle': 'आपका समय सुरक्षित है',
  'booking.heldText':
    'नीचे दिया गया समय आपके लिए रोक दिया गया है; कोई और इसे नहीं ले सकता। रिसेप्शन जल्द ही पुष्टि करेगा — “मेरी अपॉइंटमेंट” में देख सकते हैं। कृपया 15 मिनट पहले आएँ और पहचान पत्र साथ लाएँ।',
  'booking.rescheduleSuccessTitle': 'अपॉइंटमेंट का समय बदल गया',
  'booking.rescheduleSuccessText': 'आपकी अपॉइंटमेंट का समय बदल दिया गया है। नई तारीख़ और समय नीचे है।',
  'booking.appointmentId': 'अपॉइंटमेंट संख्या',
  'booking.saveId': 'यह संख्या सँभालकर रखें — रिसेप्शन पर इसकी ज़रूरत पड़ेगी।',
  'booking.forWhom': 'किसके लिए',
  'booking.holdSlot': 'मेरा समय रोकें',
  'booking.sendRequest': 'अनुरोध भेजें',
  'booking.signInTitle': 'बुक करने के लिए पहले साइन इन करें।',

  /* ---------- Form fields ---------- */
  'field.fullName': 'पूरा नाम',
  'field.fullNamePlaceholder': 'जैसे कविता रमन',
  'field.age': 'उम्र',
  'field.agePlaceholder': 'जैसे 34',
  'field.gender': 'लिंग',
  'field.male': 'पुरुष',
  'field.female': 'महिला',
  'field.other': 'अन्य',
  'field.phone': 'मोबाइल नंबर',
  'field.phonePlaceholder': '10 अंकों का मोबाइल नंबर',
  'field.reason': 'आने का कारण',
  'field.reasonPlaceholder': 'अपनी तकलीफ़ संक्षेप में लिखें',
  'field.optional': 'वैकल्पिक',

  /* ---------- Appointments ---------- */
  'appt.title': 'मेरी अपॉइंटमेंट',
  'appt.subtitle': 'आपकी आने वाली और पिछली अपॉइंटमेंट।',
  'appt.upcoming': 'आने वाली',
  'appt.past': 'पिछली',
  'appt.emptyUpcoming': 'अभी कोई अपॉइंटमेंट नहीं है।',
  'appt.emptyUpcomingHint': 'बुक करने पर वह यहाँ दिखेगी।',
  'appt.today': 'आज',
  'appt.tomorrow': 'कल',
  'appt.inDays': '{count} दिन बाद',
  'appt.statusPending': 'पुष्टि बाक़ी है',
  'appt.statusConfirmed': 'पक्की',
  'appt.statusCompleted': 'पूरी हुई',
  'appt.statusCancelled': 'रद्द',
  'appt.statusRequested': 'कॉल का इंतज़ार',
  'appt.pendingNote': 'रिसेप्शन ने अभी पुष्टि नहीं की है। तब तक आपका समय सुरक्षित रहेगा।',
  'appt.bookedToast': 'अपॉइंटमेंट पक्की हो गई।',
  'appt.heldToast': 'समय सुरक्षित है। रिसेप्शन जल्द पुष्टि करेगा।',
  'appt.cancelledToast': 'अपॉइंटमेंट रद्द कर दी गई।',
  'appt.rescheduledToast': 'अपॉइंटमेंट का समय बदल दिया गया।',
  'appt.requestedToast': 'कॉल का अनुरोध भेज दिया गया।',
  'appt.callbackPending': 'पुष्टि होनी है',

  /* ---------- Account ---------- */
  'account.signIn': 'साइन इन',
  'account.signInTitle': 'साइन इन करें',
  'account.signInSubtitle': 'अपनी अपॉइंटमेंट देखने और संभालने के लिए साइन इन करें।',
  'account.logIn': 'लॉग इन',
  'account.logInTitle': 'फिर से स्वागत है',
  'account.logInSubtitle': 'नीचे दिए नंबर से लॉग इन करें — हम एक बार का कोड भेजेंगे।',
  'account.logInCta': 'लॉग इन',
  'account.notYourNumber': 'आपका नंबर नहीं है? दूसरा नंबर इस्तेमाल करें',
  'account.account': 'मेरा खाता',
  'account.signOut': 'साइन आउट',
  'account.signedOut': 'साइन आउट हो गए।',
  'account.signedInAs': '{name} के रूप में साइन इन',
  'account.desk': 'डेस्क',
  'account.deskSession': 'डेस्क: {name}',
  'account.signOutDesk': 'डेस्क से साइन आउट',
  'account.goToDesk': 'डेस्क पर जाएँ',
  'account.otpSubtitle': 'हम आपके मोबाइल पर एक बार का कोड भेजेंगे।',
  'account.otpSentTo': '+91 {phone} पर कोड भेजा गया।',
  'account.sendCode': 'कोड भेजें',
  'account.enterCode': 'सत्यापन कोड',
  'account.verify': 'सत्यापित करके आगे बढ़ें',
  'account.resend': 'दोबारा भेजें',
  'account.resendIn': '{seconds} सेकंड में दोबारा भेजें',
  'account.changeNumber': 'नंबर बदलें',
  'account.devCode': 'एसएमएस चालू नहीं है, इसलिए कोड यहीं दिख रहा है:',
  'account.saveProfile': 'सहेजें',
  'account.completeProfileTitle': 'अपनी जानकारी पूरी करें',
  'account.completeProfileHint': 'अपना नाम बताएँ ताकि हम उसे आपकी पर्ची पर लिख सकें।',

  /* ---------- Payment ---------- */
  'pay.consultationFee': 'परामर्श शुल्क',
  'pay.convenienceFee': 'ऑनलाइन सुविधा शुल्क',
  'pay.waived': 'लागू नहीं',
  'pay.total': 'कुल देय',
  'pay.choose': 'भुगतान कैसे करेंगे',
  'pay.online': 'ऑनलाइन भुगतान',
  'pay.onlineHint': 'यूपीआई, कार्ड या नेट बैंकिंग',
  'pay.counter': 'अस्पताल में भुगतान',
  'pay.counterHint': 'आने पर बिलिंग काउंटर पर',
  'pay.counterNote':
    'आपका समय सुरक्षित है। डॉक्टर से मिलने से पहले बिलिंग काउंटर पर भुगतान कर दें — वहाँ नकद, कार्ड और यूपीआई सभी चलते हैं।',
  'pay.slotHeld': 'आपका समय सुरक्षित है। अपॉइंटमेंट {id}।',
  'pay.feeNotPublished': 'इन डॉक्टर का शुल्क अभी प्रकाशित नहीं है। रिसेप्शन बता देगा।',
  'pay.onlineUnavailableNote': 'ऑनलाइन भुगतान अभी चालू नहीं है — बिलिंग काउंटर पर भुगतान करें।',
  'pay.gatewayNote': 'भुगतान Razorpay के ज़रिए होता है। कार्ड की जानकारी इस साइट तक नहीं आती।',
  'pay.confirmCounter': 'अपॉइंटमेंट पक्की करें',
  'pay.payNow': '{amount} भुगतान करें',
  'pay.processing': 'हो रहा है…',
  'pay.status': 'भुगतान',
  'pay.paid': 'भुगतान हो गया',
  'pay.counterRecorded': 'काउंटर पर भुगतान दर्ज किया गया।',

  /* ---------- Errors ---------- */
  'error.nameTooShort': 'पूरा नाम लिखें।',
  'error.nameInvalid': 'नाम में सिर्फ़ अक्षर लिखें।',
  'error.ageInvalid': 'सही उम्र लिखें।',
  'error.underAge':
    'खाता रखने के लिए 18 वर्ष या उससे अधिक होना ज़रूरी है। अगर मरीज़ बच्चा है तो माता-पिता या अभिभावक खाता बनाएँ — फिर बच्चे के लिए बुक करते समय उसकी उम्र लिख दें।',
  'error.phoneInvalid': 'सही 10 अंकों का मोबाइल नंबर लिखें।',
  'error.emailInvalid': 'सही ईमेल पता लिखें।',
  'error.genderRequired': 'लिंग चुनें।',
  'error.reasonTooShort': 'आने का कारण थोड़ा विस्तार से लिखें।',
  'error.otpInvalid': 'भेजा गया कोड लिखें।',
  'error.deptRequired': 'विभाग चुनें।',
  'error.doctorRequired': 'डॉक्टर चुनें।',
  'error.dateRequired': 'तारीख़ चुनें।',
  'error.slotRequired': 'समय चुनें।',
  'error.network': 'अस्पताल के सर्वर से संपर्क नहीं हो सका। इंटरनेट जाँचें और फिर कोशिश करें।',
  'error.slotTaken': 'यह समय अभी किसी और ने ले लिया। कृपया दूसरा समय चुनें।',
  'error.demoOnly': 'इस हिस्से के लिए असली सर्वर चाहिए — इस प्रीव्यू में वह जुड़ा नहीं है।',
  'error.generic': 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।',
  'error.signInRequired': 'जारी रखने के लिए साइन इन करें।',

  /* ---------- Contact ---------- */
  'contact.title': 'संपर्क करें',
  'contact.emergency': 'आपातकालीन हेल्पलाइन',
  'contact.ambulance': 'एम्बुलेंस',
  'contact.reception': 'रिसेप्शन / अपॉइंटमेंट',
  'contact.email': 'ईमेल',
  'contact.address': 'पता',
  'contact.hours': 'समय',
  'contact.opdHours': 'सोम – शनि, सुबह 8:00 – रात 8:00',
  'contact.sundayHours': 'रविवार, सुबह 9:00 – दोपहर 1:00',
  'contact.emergencyHours': 'आपातकालीन और आईसीयू — 24 × 7 खुला',

  /* ---------- Services ---------- */
  'services.title': 'विभाग और सुविधाएँ',
  'services.subtitle': 'हम जिन बीमारियों का इलाज करते हैं और जो सुविधाएँ उपलब्ध हैं।',
  'services.departmentsHeading': 'विभाग',
  'services.facilitiesTitle': 'सुविधाएँ',
  'services.facilitiesSub': 'अस्पताल परिसर में उपलब्ध।',

  /* ---------- Footer ---------- */
  'footer.emergencyBanner': 'चिकित्सा आपातकाल? {number} पर कॉल करें — हम 24 × 7 उत्तर देते हैं।',
  'footer.quickLinks': 'त्वरित लिंक',
  'footer.departments': 'मुख्य विभाग',
  'footer.reachUs': 'संपर्क',
  'footer.rights': '© {year} दीपन अस्पताल। सर्वाधिकार सुरक्षित।',
  'footer.disclaimer': 'आपकी अपॉइंटमेंट की जानकारी अस्पताल सुरक्षित रखता है और सिर्फ़ आपकी देखभाल के लिए इस्तेमाल करता है।',

  /* ---------- Search assistant ---------- */
  'ai.title': 'अस्पताल खोज',
  'ai.subtitle': 'विभाग, डॉक्टर, समय या कोई शब्द खोजें',
  'ai.placeholder': 'अपना सवाल लिखें…',
  'ai.send': 'भेजें',
  'ai.empty': 'कृपया कुछ लिखें, मैं मदद करने की कोशिश करूँगा।',
  'ai.greeting': 'नमस्ते! आज मैं आपकी क्या मदद कर सकता हूँ?',
  'ai.welcome':
    'नमस्ते! मैं सही विभाग ढूँढने, डॉक्टर का समय देखने, किसी चिकित्सा शब्द का अर्थ बताने या अपॉइंटमेंट शुरू करने में मदद कर सकता हूँ।\n\nआपको क्या चाहिए?',
  'ai.whoAmI':
    'मैं एक खोज सुविधा हूँ, चैटबॉट नहीं। मैं इसी अस्पताल की अपनी सूचियों में — विभाग, डॉक्टर, समय, शुल्क और चिकित्सा शब्द — देखकर आपके लिखे से मिलान करता हूँ। मैं बातचीत करने या आपके लक्षणों पर सोच-विचार करने वाला एआई नहीं हूँ, और हर बार आपकी बात समझ नहीं पाऊँगा। किसी भी चिकित्सा प्रश्न के लिए कृपया डॉक्टर से मिलें।',
  'ai.disclaimer':
    'उत्तर इसी अस्पताल की सूचियों से आते हैं, किसी चैटबॉट से नहीं। यह चिकित्सा सलाह नहीं है — आप यहाँ जो लिखते हैं वह कहीं नहीं भेजा जाता और न ही कोई कर्मचारी उसे देखता है।',
  'ai.emergency':
    'चिकित्सा आपातकाल में तुरंत {emergency} पर कॉल करें — कैज़ुअल्टी चौबीसों घंटे खुली है।\nएम्बुलेंस के लिए {ambulance} पर कॉल करें।\n\nअपॉइंटमेंट का इंतज़ार न करें। सीधे कैज़ुअल्टी आ जाइए।',
  'ai.fees':
    'परामर्श शुल्क {min} से {max} तक है, जो डॉक्टर की विशेषज्ञता और वरिष्ठता पर निर्भर करता है। हर डॉक्टर का शुल्क उनके कार्ड पर दिखता है।\n\nजाँच, स्कैन और दवाइयों का बिल अलग बनता है। ऑनलाइन भुगतान पर थोड़ा सुविधा शुल्क लगता है; काउंटर पर भुगतान करने पर नहीं।',
  'ai.payment':
    'बुक करते समय आप यूपीआई, डेबिट या क्रेडिट कार्ड, या नेट बैंकिंग से भुगतान कर सकते हैं — या “अस्पताल में भुगतान” चुनकर बिलिंग काउंटर पर दे सकते हैं।\n\nअगर आपने अस्पताल में भुगतान चुना है, तब भी बाद में “मेरी अपॉइंटमेंट” से ऑनलाइन भुगतान कर सकते हैं।',
  'ai.manage':
    '“मेरी अपॉइंटमेंट” पर जाएँ। वहाँ हर पक्की अपॉइंटमेंट के साथ समय बदलने और रद्द करने के बटन हैं। समय बदलने पर अपॉइंटमेंट संख्या वही रहती है।',
  'ai.account':
    'आपका मोबाइल नंबर अस्पताल में आपकी पहचान है और अपॉइंटमेंट की पुष्टि तथा आपकी विज़िट के बारे में संपर्क के लिए इस्तेमाल होता है। आपका नाम और उम्र सहेज लिए जाते हैं ताकि अगली बार फ़ॉर्म अपने आप भर जाए।',
  'ai.bookHelp':
    'मैं शुरू कर देता हूँ। अपनी तकलीफ़ बताइए — जैसे “बुखार”, “दाँत में दर्द” या “सीने में दर्द” — और मैं सही विभाग बता दूँगा, या सीधे बुकिंग फ़ॉर्म खोल दूँगा।',
  'ai.language':
    'पूरा ऐप अंग्रेज़ी, तमिल और हिंदी में चलता है। ऊपर दिए EN / தமிழ் / हिंदी बटन से कभी भी बदल सकते हैं — आपकी पसंद याद रखी जाती है। पढ़ने के बजाय सुनना चाहें तो स्पीकर बटन दबाइए, वह आपकी चुनी हुई भाषा में पढ़कर सुनाएगा।',
  'ai.departmentNotOnline':
    'इस वेबसाइट पर जिन विभागों का अपॉइंटमेंट लिया जा सकता है, यह उनमें नहीं है। अस्पताल में इसका इलाज होता है या नहीं, यह रिसेप्शन बताएगा और होता हो तो समय भी तय कर देगा — {reception} पर कॉल कीजिए।\n\nअगर तुरंत ज़रूरत हो तो अपॉइंटमेंट का इंतज़ार मत कीजिए: सीधे कैज़ुअल्टी में आइए।',
  'ai.fallback':
    'मैं समझ नहीं पाया। मैं इनमें मदद कर सकता हूँ: डॉक्टर या विभाग ढूँढना, परामर्श का समय, शुल्क और भुगतान, अपॉइंटमेंट रद्द करना या समय बदलना, और चिकित्सा शब्दों का अर्थ।\n\nकोई लक्षण या शब्द लिखकर देखिए।',
  'ai.notAdvice':
    'यह सामान्य जानकारी है, कोई नुस्खा नहीं। अगर आपको कोई बीमारी है या आप दवा ले रहे हैं, तो खानपान बदलने से पहले डॉक्टर से पूछ लें।',
  'ai.askDoctor': 'परामर्श बुक करें',
  'ai.moreTerms': 'सभी शब्द देखें',
  'ai.deptIntro': 'यह {dept} का विषय लगता है।',
  'ai.deptDoctors': '{count} डॉक्टर सूचीबद्ध हैं, इनमें से {today} आज परामर्श दे रहे हैं:',
  'ai.andMore': '…और इस विभाग में {count} अन्य।',
  'ai.didYouMean': 'मुझे ठीक से समझ नहीं आया। क्या आप इनमें से कुछ पूछना चाहते थे?',
  'ai.noIdea':
    'मुझे इससे मिलता कुछ नहीं मिला — मैं सिर्फ़ इसी अस्पताल की सूचियों में खोजता हूँ, इसलिए बहुत कुछ छूट जाता है।\n\nजो मैं नहीं बता सकता, वह रिसेप्शन बता देगा — {reception}। या कोई लक्षण, विभाग या चिकित्सा शब्द बताइए, मैं फिर देखता हूँ।',
  'ai.notRecorded':
    'अस्पताल ने यह दर्ज नहीं किया है, इसलिए मैं सिर्फ़ अंदाज़ा लगाऊँगा। रिसेप्शन को पता होगा — वे आपकी पसंद के डॉक्टर से अपॉइंटमेंट भी करा देंगे।',
  'ai.howMany': '{departments} विभागों में {doctors} डॉक्टर।',
  'ai.admission':
    'अस्पताल में भर्ती की सुविधा है — सामान्य वार्ड से लेकर निजी कमरे तक — और चौबीसों घंटे गहन चिकित्सा वाला आईसीयू। किसी को भर्ती होना है या नहीं और कितने दिन, यह परामर्श के समय डॉक्टर तय करते हैं। कमरों के प्रकार और शुल्क रिसेप्शन बता देगा।',
  'ai.bestDoctor':
    'अस्पताल अपने डॉक्टरों की कोई क्रमवार सूची नहीं बनाता, और मैं अपनी तरफ़ से कोई क्रम नहीं बनाऊँगा — सभी {count} अपने-अपने क्षेत्र के योग्य विशेषज्ञ हैं।\n\nआमतौर पर यह ज़्यादा काम आता है: पहले अपनी तकलीफ़ के अनुसार विभाग चुनें, फिर ऐसे डॉक्टर जिनका समय और भाषा आपके अनुकूल हो। अगर सेवा के वर्ष आपके लिए मायने रखते हैं, तो {senior} मुख्य या वरिष्ठ सलाहकार हैं। अपना लक्षण बताइए, मैं सही विभाग बता दूँगा।',
  'ai.parkingUnknown':
    'पार्किंग की व्यवस्था मेरे पास दर्ज नहीं है, इसलिए मैं सिर्फ़ अंदाज़ा लगाऊँगा — और हो सकता है आप पहुँचकर गाड़ी खड़ी करने की जगह ही न पाएँ। रिसेप्शन आपको ठीक-ठीक बता देगा, {reception} पर। अस्पताल 50, बिशप रोड, पुथुर में है।',
  'ai.feesNotPublished':
    'परामर्श शुल्क अभी ऑनलाइन प्रकाशित नहीं हैं। किसी विशेष डॉक्टर का मौजूदा शुल्क जानने के लिए कृपया रिसेप्शन को कॉल करें।',
  'ai.doctorsReal':
    'हाँ — ये दीपन अस्पताल के अपने विशेषज्ञ हैं, और नाम तथा योग्यताएँ अस्पताल ने ही उपलब्ध कराई हैं।\n\nपरामर्श का समय और शुल्क सिर्फ़ उन डॉक्टरों के लिए दिखते हैं जिनका कार्यक्रम प्रकाशित हो चुका है। बाकी के लिए रिसेप्शन आपको फ़ोन करके समय तय करेगा।',
  'ai.sugFever': 'मुझे बुखार है',
  'ai.sugChild': 'मेरे बच्चे की जाँच करानी है',
  'ai.sugTooth': 'दाँत में दर्द',
  'ai.sugTimings': 'ओपीडी का समय क्या है?',
  'ai.sugOpd': 'ओपीडी का मतलब क्या है?',

  /* ---------- Remaining patient-journey copy ---------- */
  'contact.subtitle': 'हम चौबीसों घंटे उपलब्ध हैं। जिस तरह चाहें संपर्क करें।',
  'contact.whatsapp': 'व्हाट्सएप',
  'contact.emergencyNumber': 'आपातकालीन हेल्पलाइन',
  'contact.opd': 'ओपीडी',
  'contact.pharmacyHours': 'दवाख़ाना और लैब — 24 × 7 खुला',
  'contact.addressLine': '50, बिशप रोड, एम.ए. होंडा के सामने, पुथुर, तेन्नूर, तिरुचिरापल्ली – 620017, तमिलनाडु',
  'contact.findUs': 'हम यहाँ हैं',
  'contact.mapNote': 'पुथुर में बिशप रोड पर, एम.ए. होंडा शोरूम के ठीक सामने।',
  'contact.departmentsTitle': 'विभागों के सहायता केंद्र',

  'field.department': 'विभाग',
  'field.doctor': 'डॉक्टर',
  'field.date': 'तारीख़',
  'field.time': 'समय',
  'field.session': 'सत्र',
  'field.patient': 'मरीज़',
  'field.status': 'स्थिति',
  'field.fee': 'शुल्क',

  'doctors.years': '{count} वर्ष',
  'doctors.availableDays': 'उपलब्ध',
  'doctors.morning': 'सुबह',
  'doctors.evening': 'शाम',
  'doctors.timingsCallReception': 'परामर्श का समय अभी ऑनलाइन प्रकाशित नहीं है — रिसेप्शन को कॉल करें।',

  'dept.emergencyBlurb': 'चौबीसों घंटे ट्रॉमा और गहन चिकित्सा, एम्बुलेंस सहित।',
  'dept.generalBlurb': 'रोज़मर्रा की बीमारियाँ, बुखार, मधुमेह और नियमित स्वास्थ्य जाँच।',
  'dept.pediatricsBlurb': 'नवजात की देखभाल, टीकाकरण और बच्चों की बीमारियों का इलाज।',
  'dept.cardiologyBlurb': 'ईसीजी, इको, एंजियोग्राम और हृदय स्वास्थ्य की पूरी देखभाल।',

  'home.statPatients': 'इलाज किए गए मरीज़',
  'action.cancelRequest': 'अनुरोध रद्द करें',

  'appt.signInPrompt': 'अपनी अपॉइंटमेंट देखने के लिए साइन इन करें',
  'appt.signInText': 'आपकी बुकिंग आपके मोबाइल नंबर से जुड़ी होती है।',
  'appt.loading': 'आपकी अपॉइंटमेंट लाई जा रही हैं…',
  'appt.cancelled': 'रद्द',
  'appt.emptyPast': 'अभी कोई पिछली अपॉइंटमेंट नहीं है।',
  'appt.emptyPastHint': 'पूरी हुई और रद्द की गई विज़िट यहाँ दिखेंगी।',
  'appt.bookedOn': 'बुक किया गया',
  'appt.confirmCancelTitle': 'यह अपॉइंटमेंट रद्द करें?',
  'appt.confirmCancelText':
    '{date} को {time} बजे {doctor} के साथ आपका समय छोड़ दिया जाएगा। इसे वापस नहीं लिया जा सकता।',
  'appt.confirmCancelRequestText':
    '{doctor} के लिए आपका कॉल अनुरोध वापस ले लिया जाएगा। इसे वापस नहीं लिया जा सकता।',

  'booking.rescheduleTitle': 'अपॉइंटमेंट का समय बदलें',
  'booking.prefilled': 'आपके खाते से भरा गया — अगर यह विज़िट किसी और के लिए है तो बदल दें।',
  'booking.slotTaken': 'बुक हो चुका',
  'booking.dateHint': 'सिर्फ़ डॉक्टर के परामर्श वाले दिन चुने जा सकते हैं।',
  'booking.unavailable': 'उपलब्ध नहीं',
  'booking.summaryHeading': 'दीपन अस्पताल — अपॉइंटमेंट पर्ची',
  'booking.signInText':
    'हमें एक सत्यापित मोबाइल नंबर चाहिए ताकि हम आपकी अपॉइंटमेंट की पुष्टि कर सकें और ज़रूरत पड़ने पर आपसे संपर्क कर सकें।',
  'booking.loadingSlots': 'उपलब्ध समय देखा जा रहा है…',
  'booking.callbackNote':
    'इन डॉक्टर का ऑनलाइन समय अभी प्रकाशित नहीं है। रिसेप्शन आपको फ़ोन करके समय तय करेगा।',
  'booking.requestedTitle': 'अनुरोध मिल गया',
  'booking.requestedText':
    'रिसेप्शन नीचे दिए नंबर पर कॉल करके समय तय करेगा। कृपया फ़ोन पास रखें।',

  'ai.nutritionIntro': 'मैं रोज़मर्रा के खानपान के बारे में बता सकता हूँ। इनमें से किसी का नाम लेकर पूछिए:',
  'ai.nutritionVitamins': 'विटामिन और खनिज —',
  'ai.nutritionDiets': 'किसी बीमारी में खानपान —',
  'ai.sugVitaminD': 'विटामिन डी वाले खाद्य',
  'ai.sugIron': 'आयरन से भरपूर खाद्य',
  'ai.sugDiabetesDiet': 'मधुमेह में खानपान',

  /* ---------- Errors, account and payment ---------- */
  'error.nameRequired': 'कृपया मरीज़ का पूरा नाम लिखें।',
  'error.ageRequired': 'कृपया मरीज़ की उम्र लिखें।',
  'error.phoneRequired': 'कृपया मोबाइल नंबर लिखें।',
  'error.reasonRequired': 'कृपया बताएँ कि आप किस कारण आ रहे हैं।',
  'error.fixFields': 'कृपया चिह्नित ख़ानों को ठीक करें।',
  'error.methodRequired': 'कृपया भुगतान का तरीक़ा चुनें।',
  'error.upiRequired': 'कृपया अपनी यूपीआई आईडी लिखें।',
  'error.upiInvalid': 'सही यूपीआई आईडी लिखें, जैसे name@bank।',
  'error.cardRequired': 'कृपया कार्ड नंबर लिखें।',
  'error.cardInvalid': 'यह कार्ड नंबर सही नहीं लगता।',
  'error.cardNameRequired': 'कृपया कार्ड पर लिखा नाम डालें।',
  'error.expiryRequired': 'कृपया समाप्ति तिथि लिखें।',
  'error.expiryInvalid': 'MM/YY में सही भावी समाप्ति तिथि लिखें।',
  'error.cvvInvalid': '3 अंकों का सीवीवी लिखें।',
  'error.bankRequired': 'कृपया अपना बैंक चुनें।',
  'error.emailTaken': 'यह ईमेल पहले से किसी खाते में इस्तेमाल हो रहा है।',
  'error.phoneTaken': 'यह मोबाइल नंबर पहले से किसी खाते में इस्तेमाल हो रहा है।',
  'error.passwordRequired': 'कृपया पासवर्ड लिखें।',
  'error.passwordTooShort': 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।',
  'error.passwordMismatch': 'दोनों पासवर्ड मेल नहीं खाते।',
  'error.identifierRequired': 'अपना मोबाइल नंबर या ईमेल लिखें।',
  'error.noSuchAccount': 'इन विवरणों से कोई खाता नहीं मिला।',
  'error.wrongPassword': 'पासवर्ड ग़लत है। कृपया फिर कोशिश करें।',
  'error.alreadyRequested': 'आप यह पहले ही माँग चुके हैं। डॉक्टर इसे देखेंगे।',
  'error.notYours': 'यह आपका रिकॉर्ड नहीं है।',
  'error.otpIncorrect': 'यह कोड सही नहीं है।',
  'error.otpExpired': 'इस कोड की अवधि ख़त्म हो गई। नया कोड मँगाएँ।',
  'error.otpAttempts': 'बहुत बार ग़लत कोड डाला गया। नया कोड मँगाएँ।',
  'error.otpRateLimited': 'बहुत बार कोशिश हुई। कृपया कुछ मिनट रुकें।',
  'error.tooManyAttempts': 'इस कनेक्शन से बहुत बार कोशिश हुई। कृपया कुछ मिनट रुककर फिर कोशिश करें।',
  'error.doctorNotBookable': 'इन डॉक्टर की ऑनलाइन बुकिंग अभी चालू नहीं है।',
  'error.doctorNotThatDay': 'डॉक्टर उस दिन परामर्श नहीं देते।',
  'error.slotPast': 'वह समय निकल चुका है।',
  'error.alreadyPaid': 'इस अपॉइंटमेंट का भुगतान हो चुका है।',
  'error.onlinePaymentUnavailable': 'ऑनलाइन भुगतान अभी उपलब्ध नहीं है।',
  'error.offlineTitle': 'अस्पताल के सर्वर से संपर्क नहीं हो पा रहा',
  'error.offlineText': 'बुकिंग सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद कोशिश करें।',
  'error.retry': 'फिर कोशिश करें',
  'error.doctorUsernamePrefix': 'डॉक्टर के उपयोगकर्ता नाम की शुरुआत “doctor” से होनी चाहिए।',
  'error.reservedUsernamePrefix': '“doctor” से शुरू होने वाले उपयोगकर्ता नाम डॉक्टरों के लिए सुरक्षित हैं।',
  'error.invalidCredentials': 'उपयोगकर्ता नाम या पासवर्ड ग़लत है।',
  'error.claimProofRequired':
    'इस नंबर पर अस्पताल में पहले से रिकॉर्ड हैं। पासवर्ड बनाने के लिए नीचे अपनी किसी बुकिंग का संदर्भ नंबर डालें।',
  'error.weakPassword': 'कम से कम 8 अक्षर इस्तेमाल करें।',

  'account.title': 'मेरा खाता',
  'account.signUp': 'खाता बनाएँ',
  'account.signUpTitle': 'अपना मरीज़ खाता बनाएँ',
  'account.noAccountYet': 'खाता नहीं है? बनाइए',
  'account.haveAccount': 'पहले से खाता है? साइन इन करें',
  'account.signUpSubtitle': 'अगली बार तेज़ी से बुक करें — आपका विवरण अपने आप भर जाएगा।',
  'account.identifier': 'मोबाइल नंबर या ईमेल',
  'account.identifierPlaceholder': '9840012345 या name@example.com',
  'account.password': 'पासवर्ड',
  'account.passwordHint': 'कम से कम 8 अक्षर',
  'account.bookingReference': 'आपके किसी बुकिंग का संदर्भ नंबर',
  'account.bookingReferenceHint':
    'इस नंबर पर अस्पताल में पहले से रिकॉर्ड हैं, इसलिए यह पक्का करना ज़रूरी है कि यह आपका ही है। अपनी किसी भी बुकिंग का संदर्भ नंबर डालें — जैसे DH-4P2MYR। न हो तो रिसेप्शन से पूछ लें।',
  'account.confirmPassword': 'पासवर्ड दोबारा लिखें',
  'account.showPassword': 'पासवर्ड दिखाएँ',
  'account.hidePassword': 'पासवर्ड छिपाएँ',
  'account.createAccount': 'खाता बनाएँ',
  'account.welcomeBack': 'दीपन अस्पताल में साइन इन हैं',
  'account.patientId': 'मरीज़ आईडी',
  'account.signInPrompt': 'साइन इन',
  'account.whoAreYou': 'आप किस रूप में साइन इन कर रहे हैं?',
  'account.asPatient': 'मैं मरीज़ हूँ',
  'account.asPatientHint': 'अपनी अपॉइंटमेंट बुक करें और संभालें',
  'account.asDesk': 'मैं अस्पताल में काम करता/करती हूँ',
  'account.asDeskHint': 'रिसेप्शन और डॉक्टर — डेस्क और Klinique पोर्टल',
  'account.deskSignInTitle': 'स्टाफ़ साइन-इन',
  'account.deskSignInSubtitle':
    'अस्पताल द्वारा दिए गए उपयोगकर्ता नाम का उपयोग करें। रिसेप्शन और डॉक्टर दोनों यहीं साइन इन करते हैं।',
  'account.username': 'उपयोगकर्ता नाम',
  'account.usernameHint': 'अस्पताल द्वारा दिया गया नाम — फ़ोन नंबर नहीं।',
  'account.usernamePlaceholder': 'reception',
  'account.noDeskAccount': 'रिसेप्शन खाता नहीं है? ये अस्पताल प्रशासक बनाते हैं।',
  'account.otpPrivacyNote':
    'हम आपके मोबाइल नंबर का उपयोग अपॉइंटमेंट की पुष्टि करने और आपकी विज़िट के बारे में संपर्क करने के लिए करते हैं। और कुछ नहीं।',
  'account.editProfile': 'जानकारी बदलें',

  'pay.title': 'भुगतान',
  'pay.upi': 'यूपीआई',
  'pay.upiHint': 'GPay, PhonePe, Paytm या कोई भी यूपीआई ऐप',
  'pay.card': 'डेबिट / क्रेडिट कार्ड',
  'pay.cardHint': 'वीज़ा, मास्टरकार्ड या रुपे',
  'pay.netbanking': 'नेट बैंकिंग',
  'pay.netbankingHint': 'अपने बैंक खाते से भुगतान करें',
  'pay.upiId': 'यूपीआई आईडी',
  'pay.showQr': 'अस्पताल का क्यूआर कोड दिखाएँ',
  'pay.hideQr': 'क्यूआर कोड छिपाएँ',
  'pay.qrHint': 'किसी भी यूपीआई ऐप से स्कैन करें, फिर ऊपर अपनी यूपीआई आईडी लिखें।',
  'pay.qrAlt': 'अस्पताल का यूपीआई क्यूआर कोड',
  'pay.cardNumber': 'कार्ड नंबर',
  'pay.cardName': 'कार्ड पर नाम',
  'pay.cardNamePlaceholder': 'जैसा कार्ड पर छपा है',
  'pay.expiry': 'समाप्ति',
  'pay.cvv': 'सीवीवी',
  'pay.selectBank': 'बैंक',
  'pay.selectBankPlaceholder': 'अपना बैंक चुनें',
  'pay.secureNote': 'आपका विवरण इस उपकरण पर कभी सहेजा नहीं जाता',
  'pay.pending': 'अस्पताल में भुगतान',
  'pay.reference': 'संदर्भ',
  'pay.paidVia': 'भुगतान का माध्यम',
  'pay.payNowShort': 'अभी भुगतान करें',
  'pay.settleTitle': 'इस अपॉइंटमेंट का भुगतान करें',
  'pay.settled': 'भुगतान मिल गया।',

  /* ---------- What the fee includes ---------- */
  'pay.appointmentFee': 'अपॉइंटमेंट शुल्क',
  'fee.payShort': 'पहली बार {first} · दोबारा {review}',
  'fee.plusCaseSheet': 'इसके अलावा फ़ाइल शुल्क — पहली बार {first}, दोबारा {review}',
  'fee.payExplained': 'फ़ाइल शुल्क सहित, पहली बार {first} और दोबारा दिखाने पर {review} देना होता है।',

  /* ---------- Finding a booking (no accounts) ---------- */
  'find.title': 'मेरी अपॉइंटमेंट ढूँढें',
  'find.subtitle': 'अपनी बुकिंग का संदर्भ नंबर और जिस फ़ोन नंबर से बुक किया था, वह डालें।',
  'find.reference': 'बुकिंग संदर्भ',
  'find.cta': 'ढूँढें',

  /* ---------- First visit or review ---------- */
  'visit.question': 'यह पहली बार है या दोबारा दिखाने आए हैं?',
  'visit.hint': 'पहली बार आने पर नई फ़ाइल बनती है, जिसका थोड़ा अधिक शुल्क लगता है।',
  'visit.first': 'पहली बार',
  'visit.firstHint': 'आपने इन डॉक्टर को पहले नहीं दिखाया है',
  'visit.review': 'दोबारा दिखाना',
  'visit.reviewHint': 'पहले की विज़िट का अनुवर्ती परामर्श',
  'visit.firstCharge': 'नई फ़ाइल',
  'visit.reviewCharge': 'दोबारा दिखाने की फ़ाइल',
  'visit.chooseToSeeTotal': 'ऊपर चुनें',
  'error.visitTypeRequired': 'कृपया बताएँ कि यह पहली बार है या दोबारा दिखाने आए हैं।',

  /* ---------- Privacy notice (DPDP Act 2023) ----------
   * Translated so a Hindi-reading patient can actually read what they are
   * agreeing to. Consent to a notice you cannot read is not informed consent,
   * which is the point of the Act. Worth a lawyer's eye before it is relied
   * on — see the note in RUNBOOK.md.
   */
  'privacy.badge': 'आपका डेटा',
  'privacy.title': 'निजता सूचना',
  'privacy.intro':
    'इस ऐप का उपयोग करने पर दीपन अस्पताल क्या दर्ज करता है, क्यों करता है, कितने समय तक रखता है, और आप उसके बारे में हमसे क्या कह सकते हैं। यह भारत के डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के तहत लिखा गया है।',
  'privacy.whatTitle': 'हम क्या दर्ज करते हैं',
  'privacy.whatText':
    'आपका मोबाइल नंबर, और बुकिंग के समय दिया गया नाम, उम्र और लिंग। आपकी विज़िट का कारण, आपके अपने शब्दों में। आपने किस डॉक्टर को कब दिखाया। अस्पताल आपके रिकॉर्ड में जो भी पर्चा या रिपोर्ट दर्ज करता है। ऑनलाइन भुगतान करने पर हम केवल भुगतान संदर्भ रखते हैं — आपके कार्ड या यूपीआई का विवरण कभी नहीं, वह सीधे भुगतान सेवा को जाता है।',
  'privacy.whyTitle': 'हमें इसकी ज़रूरत क्यों है',
  'privacy.whyText':
    'आपकी अपॉइंटमेंट सुरक्षित रखने के लिए, रिसेप्शन और आपके डॉक्टर को यह बताने के लिए कि आप आ रहे हैं, और वह चिकित्सा रिकॉर्ड रखने के लिए जो हर अस्पताल को रखना होता है। इसमें से कुछ भी विज्ञापन के लिए इस्तेमाल नहीं होता, और हम इसे बेचते नहीं हैं।',
  'privacy.sharingTitle': 'इसे कौन देख सकता है',
  'privacy.sharingText':
    'रिसेप्शन के कर्मचारी आपकी बुकिंग और फ़ोन नंबर देख सकते हैं। कोई डॉक्टर केवल अपने ही मरीज़ों के रिकॉर्ड देख सकता है, किसी और के नहीं। भुगतान सेवा को उतना ही दिखता है जितना भुगतान लेने के लिए ज़रूरी है। इसके अलावा हम किसी को कुछ नहीं देते, जब तक क़ानून इसकी माँग न करे।',
  'privacy.keepTitle': 'हम इसे कितने समय रखते हैं',
  'privacy.keepText':
    'रद्द की गई बुकिंग 90 दिन बाद हटा दी जाती है। साइन-इन कोड और सत्र अवधि समाप्त होते ही हटा दिए जाते हैं। पर्चे, रिपोर्ट और पूरी हो चुकी अपॉइंटमेंट आपके चिकित्सा रिकॉर्ड का हिस्सा हैं और रखी जाती हैं, क्योंकि अस्पताल के लिए उन्हें रखना अनिवार्य है।',
  'privacy.rightsTitle': 'आप क्या माँग सकते हैं',
  'privacy.rightsText':
    'आपके बारे में हमारे पास जो कुछ है, आप उसे डाउनलोड कर सकते हैं, और उसे मिटाने के लिए कह सकते हैं। मिटाने पर आपका नाम और संपर्क विवरण तुरंत हट जाता है। जहाँ क़ानूनन चिकित्सा रिकॉर्ड रखना ज़रूरी है, वह रिकॉर्ड रहता है पर उससे आपकी पहचान नहीं होती।',
  'privacy.downloadCta': 'मेरा डेटा डाउनलोड करें',
  'privacy.eraseCta': 'मेरा डेटा मिटाएँ',
  'privacy.eraseWarning':
    'इससे आपका नाम, फ़ोन नंबर और प्रोफ़ाइल हट जाएगी और आप साइन आउट हो जाएँगे। इसे वापस नहीं लिया जा सकता। जो चिकित्सा रिकॉर्ड अस्पताल को क़ानूनन रखने होते हैं वे रहेंगे, पर उनसे आपकी पहचान नहीं जुड़ी होगी। पहले अपनी आने वाली अपॉइंटमेंट रद्द कर लें।',
  'privacy.eraseConfirm': 'हाँ, मिटा दें',
  'privacy.signInToUse': 'डेटा डाउनलोड करने या मिटाने के लिए साइन इन करें।',
  'privacy.contactTitle': 'सवाल',
  'privacy.contactText': 'हमें लिखिए, कोई व्यक्ति जवाब देगा:',
  'privacy.consentTitle': 'आगे बढ़ने से पहले',
  'privacy.consentText':
    'अपॉइंटमेंट बुक करने के लिए हमें आपका नाम, उम्र, मोबाइल नंबर और विज़िट का कारण दर्ज करना होगा, और जिस डॉक्टर से आप मिल रहे हैं उन्हें बताना होगा। आप इसे कभी भी वापस ले सकते हैं और अपना डेटा मिटा सकते हैं।',
  'privacy.consentRead': 'पूरी निजता सूचना पढ़ें',
  'privacy.consentAgree': 'मैं सहमत हूँ',
  'privacy.consentLater': 'अभी नहीं',

  /* ---------- Read aloud ---------- */
  'speech.listen': 'इसे सुनें',
  'speech.stop': 'पढ़ना बंद करें',
  'speech.unavailable': 'यह उपकरण इसे पढ़कर नहीं सुना सकता।',

  /* ---------- Triage (booking form) ---------- */
  'triage.urgentTitle': 'इसमें तुरंत इलाज की ज़रूरत हो सकती है — अपॉइंटमेंट का इंतज़ार न करें',
  'triage.urgentText':
    'आपने जो बताया है वह गंभीर हो सकता है। कृपया अभी आपातकालीन नंबर पर कॉल करें, या सीधे कैज़ुअल्टी में आ जाएँ — वहाँ दिन-रात डॉक्टर मौजूद रहते हैं। चाहें तो नीचे बुकिंग भी कर सकते हैं, पर इलाज में देरी न करें।',
  'triage.callNow': 'अभी {number} पर कॉल करें',
  'triage.mismatchText': 'आपने जो बताया है वह आमतौर पर {department} में देखा जाता है। {doctor} दूसरे विभाग में हैं।',
  'triage.mismatchHint':
    'यह सिर्फ़ आपके लिखे शब्दों के आधार पर सुझाव है — चिकित्सा सलाह नहीं। अगर आप इन्हीं डॉक्टर से मिलना चाहते हैं तो आगे बढ़ें।',

  /* ---------- Health record ---------- */
  'health.title': 'मेरा स्वास्थ्य रिकॉर्ड',
  'health.subtitle': 'आपकी क़तार की स्थिति, दवा की पर्चियाँ और रिपोर्ट — सब एक ही जगह।',
  'health.queueTitle': 'चालू क़तार',
  'health.noQueue': 'अभी टोकन जारी नहीं हुआ है। डॉक्टर के बैठते ही यह बन जाता है।',
  'health.tokenNumber': 'आपका टोकन',
  'health.nowServing': 'अभी देखे जा रहे हैं',
  'health.aheadOfYou': 'आपसे पहले {count} लोग',
  'health.estWait': 'लगभग {count} मिनट',
  'health.beingSeen': 'आपकी बारी है — कृपया अंदर जाइए।',
  'health.queuePaused': 'डॉक्टर ने यह बैठक कुछ देर के लिए रोकी है।',
  'health.queueNotStarted': 'यह बैठक अभी शुरू नहीं हुई है।',
  'health.rxTitle': 'दवा की पर्चियाँ',
  'health.noRx': 'अभी तक कोई पर्ची नहीं।',
  'health.recordsTitle': 'रिपोर्ट और रिकॉर्ड',
  'health.noRecords': 'अभी तक कोई रिपोर्ट दर्ज नहीं हुई है।',
  'health.followUp': '{date} को दोबारा दिखाएँ',
  'health.askRepeat': 'वही दवा दोबारा माँगें',
  'health.repeatAsked': 'डॉक्टर को भेज दिया गया',
  'health.repeatApproved': 'मंज़ूर — नई पर्ची नीचे है',
  'health.repeatDeclined': 'मना कर दिया गया',
  'health.repeatNote': 'डॉक्टर को कुछ बताना चाहेंगे? (ज़रूरी नहीं)',
  'health.repeatSend': 'अनुरोध भेजें',
  'health.repeatHelp':
    'वही दवाएँ दोबारा लेने के लिए। हर अनुरोध डॉक्टर ख़ुद देखते हैं — कुछ भी अपने आप जारी नहीं होता।',
  'health.signInPrompt': 'अपना स्वास्थ्य रिकॉर्ड देखने के लिए साइन इन कीजिए',
  'health.diagnosis': 'निदान',
  'health.advice': 'सलाह',

  /* ---------- Kinds of record ---------- */
  'record.lab': 'लैब रिपोर्ट',
  'record.imaging': 'स्कैन',
  'record.discharge': 'डिस्चार्ज सारांश',
  'record.note': 'चिकित्सकीय टिप्पणी',
  'record.vaccination': 'टीकाकरण',

  'common.loading': 'लोड हो रहा है…',

  /* ---------- Bottom navigation bar (phones) ---------- */
  'tab.home': 'होम',
  'tab.doctors': 'डॉक्टर',
  'tab.book': 'बुकिंग',
  'tab.appointments': 'अपॉइंटमेंट',
  'tab.health': 'स्वास्थ्य',

  /* ---------- Message reception sends a patient ---------- */
  'sms.confirmed':
    '{hospital}\nअपॉइंटमेंट पक्का हो गया है।\n\nसंदर्भ संख्या: {ref}\n{doctor}\n{when}\n\n{address}\n\nसंदर्भ संख्या साथ लाइए। बदलने या रद्द करने के लिए {phone} पर कॉल कीजिए।',
  'sms.cancelled':
    '{hospital}\nअपॉइंटमेंट {ref} रद्द कर दिया गया है।\n\n{doctor}\n{when}\n\nदूसरा समय लेने के लिए {phone} पर कॉल कीजिए।',

  /* ---------- Opening screen ---------- */
  'opening.title': 'दीपन अस्पताल में आपका स्वागत है',
  'opening.h1a': 'बेहतर इलाज,',
  'opening.h1b': 'फिर से चलने-फिरने की आज़ादी।',
  'opening.lede':
    'त्रिची में बहु-विशेषज्ञता अस्पताल। हड्डी रोग, जोड़ों का इलाज, सामान्य चिकित्सा और गहन चिकित्सा में {years} वर्षों से भी अधिक का अनुभव।',
  'opening.scroll': 'नीचे जाइए',
  'opening.skip': 'छोड़ें',
  'opening.entering': 'आपको वेबसाइट पर ले जा रहे हैं…',
  'opening.ch2Label': 'हड्डी रोग और जोड़ों का इलाज',
  'opening.ch2Title': 'ढाँचा, फिर से जुड़ता हुआ।',
  'opening.ch2Body':
    'जोड़ प्रत्यारोपण, आर्थ्रोस्कोपी और हड्डी टूटने का इलाज — दशकों का अनुभव रखने वाले डॉक्टरों से। चलना, वज़न उठाना और रात भर चैन से सोना फिर से आम बात बन जाए।',
  'opening.ch3Label': 'आपातकालीन और गहन चिकित्सा',
  'opening.ch3Title': 'रात तीन बजे भी कोई जागता है।',
  'opening.ch3Body':
    'कैज़ुअल्टी, गहन चिकित्सा और बेहोशी विशेषज्ञ की सेवा, चौबीसों घंटे। न अपॉइंटमेंट चाहिए, न सुबह का इंतज़ार — इस स्क्रीन के ऊपर लिखा नंबर हर समय उठाया जाता है।',
  'opening.ch4Label': 'हर बड़ा विभाग',
  'opening.ch4Title': 'एक ही छत के नीचे, आपकी भाषा में।',
  'opening.ch4Body':
    'हृदय रोग, तंत्रिका रोग, गुर्दा रोग, बाल रोग, प्रसूति और भी बहुत कुछ — और इस साइट की हर स्क्रीन हिन्दी, तमिल और अंग्रेज़ी में चलती है।',
  'opening.closeTitle': 'डॉक्टर से मिलने के लिए तैयार हैं?',
  'opening.closeBody':
    'विभाग चुनिए, समय चुनिए और आ जाइए। बुकिंग में लगभग एक मिनट लगता है।',
  'opening.book': 'अपॉइंटमेंट बुक करें',
  'opening.browse': 'पहले देख लीजिए',
  'opening.emergency': 'चिकित्सा आपातकाल? {number} पर कॉल कीजिए — हम चौबीसों घंटे उपलब्ध हैं',
  'opening.noAccount':
    'बुकिंग के लिए खाता ज़रूरी नहीं। खाता होने से आपकी सारी अपॉइंटमेंट एक ही जगह रहती हैं।',

  /* ---------- Guided tour ---------- */
  'tour.start': 'थोड़ा घूमकर देखिए',
  'tour.skip': 'छोड़ें',
  'tour.done': 'हो गया',
  'tour.replay': 'मुझे घुमाकर दिखाइए',
  'tour.p1Title': 'लगभग एक मिनट में बुकिंग',
  'tour.p1Body':
    'विभाग चुनिए, फिर डॉक्टर और समय — बस हो गया। रिसेप्शन पर दिखाने के लिए एक रेफ़रेंस नंबर मिल जाएगा।',
  'tour.p2Title': 'हिन्दी, तमिल या अंग्रेज़ी',
  'tour.p2Body':
    'हर स्क्रीन तीनों भाषाओं में चलती है। जब चाहें बदल लीजिए — आपकी पसंद इसी डिवाइस पर याद रहती है।',
  'tour.p3Title': 'सही डॉक्टर ढूँढ़िए',
  'tour.p3Body':
    'विभाग के हिसाब से देखिए, या अगर पहले से पता है कि किससे मिलना है तो नाम या विशेषज्ञता से खोजिए।',
  'tour.p5Title': 'आपका स्वास्थ्य रिकॉर्ड',
  'tour.p5Body':
    'उस दिन का क़तार टोकन, आपकी दवा की पर्चियाँ, और अस्पताल में दर्ज लैब रिपोर्ट — सब एक ही जगह।',
  'tour.p6Title': 'कुछ पूछिए',
  'tour.p6Body':
    'अपनी तकलीफ़ लिखिए — यह सही विभाग बताएगा, किसी चिकित्सकीय शब्द का मतलब समझाएगा, या समय देख देगा। यह डॉक्टर नहीं है और कोई निदान नहीं करता।',
  'tour.p7Title': 'आपात स्थिति में',
  'tour.p7Body':
    'बुकिंग मत कीजिए। इस नंबर पर कॉल कीजिए या सीधे कैज़ुअल्टी आ जाइए — वहाँ दिन-रात डॉक्टर मौजूद रहते हैं।',

  /* ---------- Glossary ---------- */
  'glossary.badge': 'आसान भाषा में',
  'glossary.title': 'किस शब्द का क्या मतलब',
  'glossary.subtitle':
    'अस्पताल के शब्द, डॉक्टर के नाम के आगे लगे अक्षर, जाँचें और भुगतान से जुड़े शब्द — हिन्दी, तमिल और अंग्रेज़ी में आसान भाषा में समझाए गए।',
  'glossary.searchPlaceholder': 'कोई शब्द खोजिए, जैसे ओपीडी, एमबीबीएस, एंजियोग्राम…',
  'glossary.all': 'सभी',
  'glossary.count': '{count} शब्द',
  'glossary.none': 'आपकी खोज से कोई शब्द मेल नहीं खाता।',
}
