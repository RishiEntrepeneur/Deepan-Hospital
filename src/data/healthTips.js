/**
 * General nutrition and wellness information, written for a Tamil Nadu
 * household and kept deliberately non-prescriptive.
 *
 * These are everyday dietary pointers, not treatment. Anything specific to a
 * person's condition belongs with a doctor or dietician, and the assistant
 * always says so when it uses this file.
 */

export const HEALTH_TOPICS = [
  /* ---------------- Vitamins & minerals ---------------- */
  {
    id: 'vitamin-a',
    group: 'vitamin',
    keywords: ['vitamin a', 'eyesight food', 'night blindness', 'retinol', 'வைட்டமின் ஏ', 'வைட்டமின் a'],
    title: { en: 'Vitamin A — eyes, skin and immunity', ta: 'வைட்டமின் ஏ — கண், தோல், நோய் எதிர்ப்பு' },
    body: {
      en: 'Best everyday sources: drumstick leaves (murungai keerai), carrot, pumpkin, papaya, mango, sweet potato, egg yolk and milk.\n\nOrange and dark green foods are the giveaway. A little oil or ghee in the same meal helps the body absorb it.',
      ta: 'சிறந்த ஆதாரங்கள்: முருங்கைக் கீரை, கேரட், பரங்கிக்காய், பப்பாளி, மாம்பழம், சர்க்கரைவள்ளிக் கிழங்கு, முட்டையின் மஞ்சள் கரு, பால்.\n\nஆரஞ்சு நிற மற்றும் அடர் பச்சை உணவுகளில் இது அதிகம். அதே உணவில் சிறிது எண்ணெய் அல்லது நெய் இருந்தால் உடல் நன்றாக உறிஞ்சும்.',
    },
  },
  {
    id: 'vitamin-b12',
    group: 'vitamin',
    keywords: ['vitamin b12', 'b12', 'cobalamin', 'வைட்டமின் பி12', 'பி12'],
    title: { en: 'Vitamin B12 — nerves and blood', ta: 'வைட்டமின் பி12 — நரம்பு மற்றும் ரத்தம்' },
    body: {
      en: 'Found almost entirely in animal foods: milk, curd, paneer, egg, fish, chicken and mutton.\n\nStrict vegetarians and vegans commonly run low — tiredness, tingling hands and feet are typical signs. A blood test settles it, and a supplement is usually all that is needed.',
      ta: 'பெரும்பாலும் விலங்கு உணவுகளில் மட்டுமே: பால், தயிர், பன்னீர், முட்டை, மீன், கோழி, ஆட்டிறைச்சி.\n\nமுழு சைவ உணவு உண்பவர்களுக்கு இது குறையலாம் — சோர்வு, கை கால் மரத்துப் போதல் ஆகியவை அறிகுறிகள். ரத்தப் பரிசோதனையில் தெரியும்; பொதுவாக மாத்திரை போதுமானது.',
    },
  },
  {
    id: 'vitamin-c',
    group: 'vitamin',
    keywords: ['vitamin c', 'ascorbic', 'immunity food', 'வைட்டமின் சி', 'நோய் எதிர்ப்பு உணவு'],
    title: { en: 'Vitamin C — healing and immunity', ta: 'வைட்டமின் சி — காயம் ஆறுதல், நோய் எதிர்ப்பு' },
    body: {
      en: 'Amla (nellikai) is the richest local source by far. Also guava, lemon, orange, sweet lime, tomato, capsicum and cabbage.\n\nIt is destroyed by long cooking, so eat these raw or lightly cooked. Taking vitamin C with an iron-rich meal helps you absorb the iron.',
      ta: 'நெல்லிக்காயில் மிக அதிகம். கொய்யா, எலுமிச்சை, ஆரஞ்சு, சாத்துக்குடி, தக்காளி, குடைமிளகாய், முட்டைகோஸ் ஆகியவற்றிலும் உண்டு.\n\nநீண்ட நேரம் சமைத்தால் இது அழிந்துவிடும் — பச்சையாகவோ குறைவாக வேகவைத்தோ சாப்பிடுங்கள். இரும்புச்சத்து உணவுடன் சேர்த்தால் இரும்பு நன்றாக உறிஞ்சப்படும்.',
    },
  },
  {
    id: 'vitamin-d',
    group: 'vitamin',
    keywords: ['vitamin d', 'sunlight', 'bone weakness', 'வைட்டமின் டி', 'வெயில்'],
    title: { en: 'Vitamin D — bones and muscles', ta: 'வைட்டமின் டி — எலும்பு மற்றும் தசை' },
    body: {
      en: 'Mostly made by your own skin: 15–20 minutes of morning sun on the arms and face, most days.\n\nFood sources are limited — oily fish (sardine, mackerel), egg yolk and fortified milk. Deficiency is very common in people who work indoors, and shows up as body ache and tiredness.',
      ta: 'பெரும்பாலும் உங்கள் தோலே தயாரிக்கிறது: காலை வெயிலில் கை, முகம் படும்படி 15–20 நிமிடம் இருங்கள்.\n\nஉணவில் குறைவே — மத்தி, கானாங்கெளுத்தி போன்ற எண்ணெய் மீன், முட்டை மஞ்சள் கரு, சத்து சேர்க்கப்பட்ட பால். உள்ளரங்கில் வேலை செய்பவர்களுக்கு இது அடிக்கடி குறையும்; உடல் வலி, சோர்வாக வெளிப்படும்.',
    },
  },
  {
    id: 'iron',
    group: 'mineral',
    keywords: ['iron', 'anaemia', 'anemia', 'haemoglobin', 'hemoglobin', 'இரும்புச்சத்து', 'ரத்த சோகை', 'ஹீமோகுளோபின்'],
    title: { en: 'Iron — for haemoglobin', ta: 'இரும்புச்சத்து — ரத்தத்திற்கு' },
    body: {
      en: 'Best local sources: agathi keerai, murungai keerai and other greens, ragi, dates, raisins, jaggery, black gram, and liver or red meat if you eat them.\n\nTwo practical tips: squeeze lemon over greens (vitamin C doubles absorption), and avoid tea or coffee for an hour after meals — they block iron.',
      ta: 'சிறந்த ஆதாரங்கள்: அகத்திக் கீரை, முருங்கைக் கீரை மற்றும் பிற கீரைகள், கேழ்வரகு, பேரீச்சம்பழம், உலர் திராட்சை, வெல்லம், உளுந்து, ஈரல் அல்லது சிவப்பு இறைச்சி.\n\nஇரண்டு குறிப்புகள்: கீரையில் எலுமிச்சை பிழியுங்கள் (வைட்டமின் சி உறிஞ்சுதலை இரட்டிப்பாக்கும்); சாப்பிட்ட ஒரு மணி நேரத்திற்குள் தேநீர்/காபி வேண்டாம் — அவை இரும்பைத் தடுக்கும்.',
    },
  },
  {
    id: 'calcium',
    group: 'mineral',
    keywords: ['calcium', 'bone strength', 'osteoporosis', 'கால்சியம்', 'எலும்பு வலிமை'],
    title: { en: 'Calcium — bones and teeth', ta: 'கால்சியம் — எலும்பு மற்றும் பல்' },
    body: {
      en: 'Milk, curd and buttermilk are the easiest. Ragi is exceptionally rich — a ragi kanji or dosa is a cheap daily source.\n\nAlso sesame (ellu), almonds, greens, and small fish eaten with the bones. Calcium needs vitamin D to be absorbed, so get some sun too.',
      ta: 'பால், தயிர், மோர் எளிதானவை. கேழ்வரகில் மிக அதிகம் — கேழ்வரகு கஞ்சி அல்லது தோசை தினசரி மலிவான ஆதாரம்.\n\nஎள், பாதாம், கீரை, முள்ளுடன் சாப்பிடும் சிறு மீன்களிலும் உண்டு. கால்சியம் உறிஞ்சப்பட வைட்டமின் டி தேவை — எனவே வெயிலும் படட்டும்.',
    },
  },
  {
    id: 'folic-acid',
    group: 'vitamin',
    keywords: ['folic acid', 'folate', 'b9', 'ஃபோலிக்', 'கருவுற்ற உணவு'],
    title: { en: 'Folic acid — especially in pregnancy', ta: 'ஃபோலிக் அமிலம் — குறிப்பாக கர்ப்ப காலத்தில்' },
    body: {
      en: 'Greens, beans, peas, groundnut, citrus fruits and whole grains.\n\nIt matters most before and during early pregnancy, when it protects the baby’s spine and brain — which is why doctors start folic acid tablets before conception, not after.',
      ta: 'கீரை, பீன்ஸ், பட்டாணி, நிலக்கடலை, சிட்ரஸ் பழங்கள், முழு தானியங்கள்.\n\nகர்ப்பத்திற்கு முன்பும் ஆரம்ப மாதங்களிலும் இது மிக முக்கியம் — குழந்தையின் முதுகுத்தண்டு மற்றும் மூளையைப் பாதுகாக்கும். அதனால்தான் கருத்தரிப்பதற்கு முன்பே மருத்துவர்கள் ஃபோலிக் மாத்திரை தொடங்குகிறார்கள்.',
    },
  },
  {
    id: 'protein',
    group: 'nutrient',
    keywords: ['protein', 'muscle food', 'புரதம்', 'தசை உணவு'],
    title: { en: 'Protein — repair and strength', ta: 'புரதம் — உடல் பழுதுபார்ப்பு மற்றும் வலிமை' },
    body: {
      en: 'Vegetarian: dal of any kind, rajma, chana, soya, groundnut, curd, paneer, milk.\nNon-vegetarian: egg, fish, chicken.\n\nSpread it across the day rather than one large meal — a little at breakfast makes a bigger difference than most people expect.',
      ta: 'சைவம்: எல்லா வகை பருப்பு, ராஜ்மா, கொண்டைக்கடலை, சோயா, நிலக்கடலை, தயிர், பன்னீர், பால்.\nஅசைவம்: முட்டை, மீன், கோழி.\n\nஒரே வேளையில் அதிகம் சாப்பிடாமல் நாள் முழுவதும் பிரித்துச் சாப்பிடுங்கள் — காலை உணவில் சிறிது புரதம் நினைப்பதை விட அதிக மாற்றம் தரும்.',
    },
  },
  {
    id: 'zinc',
    group: 'mineral',
    keywords: ['zinc', 'ஜின்க்', 'துத்தநாகம்'],
    title: { en: 'Zinc — healing and immunity', ta: 'துத்தநாகம் — காயம் ஆறுதல், நோய் எதிர்ப்பு' },
    body: {
      en: 'Pulses, chickpeas, pumpkin seeds, sesame, cashew, whole grains, egg and seafood.\n\nSoaking or sprouting dals and grains before cooking makes the zinc in them easier to absorb.',
      ta: 'பருப்பு வகைகள், கொண்டைக்கடலை, பரங்கி விதை, எள், முந்திரி, முழு தானியம், முட்டை, கடல் உணவு.\n\nபருப்பு, தானியங்களை ஊற வைத்தோ முளைகட்டியோ சமைத்தால் துத்தநாகம் எளிதில் உறிஞ்சப்படும்.',
    },
  },

  /* ---------------- Condition-linked eating ---------------- */
  {
    id: 'diabetes-diet',
    group: 'diet',
    keywords: [
      'diabetes diet', 'sugar diet', 'diabetic food', 'diabetic diet', 'diabetes eat',
      'சர்க்கரை நோய் உணவு', 'நீரிழிவு உணவு',
    ],
    title: { en: 'Eating with diabetes', ta: 'நீரிழிவு நோயாளிகளுக்கான உணவு' },
    body: {
      en: 'General pointers: swap white rice for hand-pounded rice, ragi, kambu or wheat; fill half the plate with vegetables; keep fruit whole rather than juiced; eat at fixed times.\n\nSugar control is very individual — your dose, kidney function and other conditions all change the advice. Please see our diabetologist rather than follow general rules.',
      ta: 'பொதுவான குறிப்புகள்: பச்சரிசிக்குப் பதிலாக கைக்குத்தல் அரிசி, கேழ்வரகு, கம்பு அல்லது கோதுமை; தட்டில் பாதி காய்கறி; பழச்சாறு வேண்டாம், பழமாகவே சாப்பிடுங்கள்; நேரம் தவறாமல் சாப்பிடுங்கள்.\n\nசர்க்கரைக் கட்டுப்பாடு ஒவ்வொருவருக்கும் வேறுபடும் — மருந்தளவு, சிறுநீரக நிலை எல்லாம் ஆலோசனையை மாற்றும். பொதுவான விதிகளைப் பின்பற்றாமல் எங்கள் நீரிழிவு நிபுணரைச் சந்தியுங்கள்.',
    },
    departmentId: 'general',
  },
  {
    id: 'bp-diet',
    group: 'diet',
    keywords: ['blood pressure diet', 'bp diet', 'salt', 'hypertension food', 'ரத்த அழுத்த உணவு', 'உப்பு'],
    title: { en: 'Eating with high blood pressure', ta: 'உயர் ரத்த அழுத்தத்திற்கான உணவு' },
    body: {
      en: 'The single biggest lever is salt — under one teaspoon a day, counting pickles, papad, packet snacks and dried fish.\n\nMore potassium helps: banana, coconut water, greens, tomato, orange. Cut down on fried items and stay active most days.',
      ta: 'மிக முக்கியமானது உப்பு — ஊறுகாய், அப்பளம், பாக்கெட் தின்பண்டங்கள், கருவாடு உட்பட நாளொன்றுக்கு ஒரு டீஸ்பூனுக்கும் குறைவாக.\n\nபொட்டாசியம் உதவும்: வாழைப்பழம், இளநீர், கீரை, தக்காளி, ஆரஞ்சு. பொரித்த உணவைக் குறைத்து, தினமும் உடற்பயிற்சி செய்யுங்கள்.',
    },
    departmentId: 'general',
  },
  {
    id: 'pregnancy-diet',
    group: 'diet',
    keywords: [
      'pregnancy diet', 'pregnant food', 'pregnant eat', 'pregnancy food', 'pregnant nutrition',
      'கர்ப்ப கால உணவு', 'கர்ப்பிணி உணவு', 'கர்ப்ப உணவு',
    ],
    title: { en: 'Eating during pregnancy', ta: 'கர்ப்ப காலத்தில் உணவு' },
    body: {
      en: 'Focus on iron (greens, dates, ragi), calcium (milk, curd, ellu), folic acid (greens, beans) and protein (dal, egg, fish).\n\nSmall frequent meals help with nausea. Avoid papaya in excess, raw or undercooked meat and fish, unpasteurised milk, and any tablet not prescribed to you.',
      ta: 'இரும்புச்சத்து (கீரை, பேரீச்சை, கேழ்வரகு), கால்சியம் (பால், தயிர், எள்), ஃபோலிக் அமிலம் (கீரை, பீன்ஸ்), புரதம் (பருப்பு, முட்டை, மீன்) ஆகியவற்றில் கவனம் செலுத்துங்கள்.\n\nகுறைந்த அளவில் அடிக்கடி சாப்பிட்டால் குமட்டல் குறையும். அதிக பப்பாளி, பச்சை அல்லது சரியாக வேகாத இறைச்சி/மீன், பதப்படுத்தாத பால், பரிந்துரைக்கப்படாத மாத்திரைகள் ஆகியவற்றைத் தவிர்க்கவும்.',
    },
    departmentId: 'gynecology',
  },
  {
    id: 'child-nutrition',
    group: 'diet',
    keywords: [
      'child food', 'kids nutrition', 'baby food', 'weight gain child', 'child eat', 'child diet',
      'குழந்தை உணவு', 'குழந்தை ஊட்டச்சத்து', 'குழந்தை சாப்பிட',
    ],
    title: { en: 'Feeding children well', ta: 'குழந்தைகளுக்கு நல்ல உணவு' },
    body: {
      en: 'Breast milk only for the first six months, then add mashed rice, ragi kanji, dal water, well-cooked vegetables and egg from six months.\n\nFor older children: milk or curd daily, a fruit a day, greens twice a week, and fewer biscuits and packaged snacks. Growth is best judged by the weight chart, not by appetite.',
      ta: 'முதல் ஆறு மாதங்கள் தாய்ப்பால் மட்டும். ஆறு மாதத்திற்குப் பின் மசித்த சாதம், கேழ்வரகு கஞ்சி, பருப்புத் தண்ணீர், நன்கு வேகவைத்த காய்கறி, முட்டை சேர்க்கலாம்.\n\nபெரிய குழந்தைகளுக்கு: தினமும் பால் அல்லது தயிர், ஒரு பழம், வாரம் இருமுறை கீரை; பிஸ்கட், பாக்கெட் தின்பண்டங்களைக் குறையுங்கள். வளர்ச்சியை பசியை வைத்தல்ல, எடை அட்டவணையை வைத்தே அளவிட வேண்டும்.',
    },
    departmentId: 'pediatrics',
  },
  {
    id: 'cholesterol-diet',
    group: 'diet',
    keywords: ['cholesterol', 'fat diet', 'heart healthy food', 'கொலஸ்ட்ரால்', 'கொழுப்பு உணவு'],
    title: { en: 'Eating for your heart', ta: 'இதய நலனுக்கான உணவு' },
    body: {
      en: 'Cut reused frying oil, vanaspati, bakery items and fatty red meat. Prefer groundnut, sesame or rice bran oil, and change it around.\n\nAdd oats, ragi, greens, garlic, nuts and fish twice a week. Thirty minutes of brisk walking most days does as much as diet.',
      ta: 'மீண்டும் பயன்படுத்திய பொரிக்கும் எண்ணெய், வனஸ்பதி, பேக்கரி பொருட்கள், கொழுப்பு நிறைந்த இறைச்சியைக் குறையுங்கள். நிலக்கடலை, எள் அல்லது தவிட்டு எண்ணெயை மாற்றி மாற்றிப் பயன்படுத்துங்கள்.\n\nஓட்ஸ், கேழ்வரகு, கீரை, பூண்டு, கொட்டைகள், வாரம் இருமுறை மீன் சேர்த்துக்கொள்ளுங்கள். தினமும் 30 நிமிட வேக நடையும் உணவைப் போலவே முக்கியம்.',
    },
    departmentId: 'cardiology',
  },
  {
    id: 'kidney-diet',
    group: 'diet',
    keywords: ['kidney diet', 'renal diet', 'சிறுநீரக உணவு'],
    title: { en: 'Eating with kidney problems', ta: 'சிறுநீரக பிரச்சினைக்கான உணவு' },
    body: {
      en: 'This is the one area where general advice can genuinely harm you. Depending on your stage, you may need to *limit* the very foods that are healthy for others — bananas, coconut water, greens, dal.\n\nPlease do not follow internet diets. Our nephrology team will set limits from your blood reports.',
      ta: 'பொதுவான ஆலோசனை உண்மையிலேயே தீங்கு விளைவிக்கக்கூடிய ஒரே பகுதி இதுதான். உங்கள் நிலையைப் பொறுத்து, மற்றவர்களுக்கு நல்லது என்று கருதப்படும் வாழைப்பழம், இளநீர், கீரை, பருப்பு போன்றவற்றையே *குறைக்க* வேண்டியிருக்கும்.\n\nஇணையத்தில் உள்ள உணவுத் திட்டங்களைப் பின்பற்ற வேண்டாம். உங்கள் ரத்த அறிக்கையைப் பார்த்து எங்கள் சிறுநீரகவியல் குழு வரம்புகளை நிர்ணயிக்கும்.',
    },
    departmentId: 'nephrology',
  },
  {
    id: 'weight-loss',
    group: 'diet',
    keywords: [
      'weight loss', 'reduce weight', 'lose weight', 'obesity', 'overweight',
      'எடை குறைப்பு', 'உடல் எடை',
    ],
    title: { en: 'Losing weight sensibly', ta: 'சரியான முறையில் எடை குறைத்தல்' },
    body: {
      en: 'Nothing beats the basics: smaller rice portions, vegetables at every meal, no sugary drinks, and 30–45 minutes of walking daily.\n\nAim for half a kilo a week. Rapid crash diets almost always come back, and can mask thyroid or hormonal causes worth testing for.',
      ta: 'அடிப்படைகளே சிறந்தவை: சாத அளவைக் குறையுங்கள், ஒவ்வொரு வேளையிலும் காய்கறி, இனிப்பு பானங்கள் வேண்டாம், தினமும் 30–45 நிமிட நடை.\n\nவாரத்திற்கு அரை கிலோ குறைவதே சரியான வேகம். விரைவான உணவுக் கட்டுப்பாடு மீண்டும் எடையை ஏற்றிவிடும்; தைராய்டு போன்ற காரணங்களையும் மறைத்துவிடும்.',
    },
    departmentId: 'general',
  },
  {
    id: 'hydration',
    group: 'wellness',
    keywords: ['water intake', 'how much water', 'dehydration', 'தண்ணீர்', 'நீரேற்றம்'],
    title: { en: 'How much water', ta: 'எவ்வளவு தண்ணீர்' },
    body: {
      en: 'Two to three litres a day for most adults, and more in Trichy’s summer or if you work outdoors.\n\nThe simplest check is your urine — pale straw is right, dark yellow means drink more. People with kidney or heart failure should follow the limit their doctor set instead.',
      ta: 'பெரும்பாலான பெரியவர்களுக்கு நாளொன்றுக்கு இரண்டு முதல் மூன்று லிட்டர்; திருச்சி வெயிலிலோ வெளியில் வேலை செய்பவர்களுக்கோ இன்னும் அதிகம்.\n\nஎளிய சோதனை சிறுநீரின் நிறம் — வெளிர் மஞ்சள் சரி, அடர் மஞ்சள் என்றால் இன்னும் குடிக்க வேண்டும். சிறுநீரக அல்லது இதய செயலிழப்பு உள்ளவர்கள் மருத்துவர் சொன்ன அளவையே பின்பற்றவும்.',
    },
  },
  {
    id: 'immunity',
    group: 'wellness',
    keywords: ['immunity', 'resistance', 'falling sick often', 'நோய் எதிர்ப்பு சக்தி', 'அடிக்கடி நோய்'],
    title: { en: 'Building resistance to illness', ta: 'நோய் எதிர்ப்பு சக்தியை வளர்ப்பது' },
    body: {
      en: 'There is no single food that does it. What actually works: seven to eight hours of sleep, a fruit and some greens daily, curd, enough protein, regular exercise, and no smoking.\n\nIf you are falling ill unusually often, that is worth a check-up rather than a supplement — diabetes and anaemia both show up this way.',
      ta: 'இதற்கென ஒரே உணவு எதுவும் இல்லை. உண்மையில் பயன்படுவது: ஏழு முதல் எட்டு மணி நேர தூக்கம், தினமும் ஒரு பழமும் கீரையும், தயிர், போதிய புரதம், வழக்கமான உடற்பயிற்சி, புகைப்பழக்கம் இல்லாமை.\n\nவழக்கத்திற்கு மாறாக அடிக்கடி நோய்வாய்ப்பட்டால், சத்து மாத்திரையை விட ஒரு முழு பரிசோதனையே தேவை — நீரிழிவு, ரத்த சோகை இரண்டும் இப்படித்தான் வெளிப்படும்.',
    },
    departmentId: 'general',
  },
]

/** Words that mean "tell me about food/vitamins" without naming one. */
export const NUTRITION_HINTS = [
  'food', 'diet', 'nutrition', 'vitamin', 'vitamins', 'mineral', 'eat', 'nutrients', 'healthy food',
  'உணவு', 'சத்து', 'வைட்டமின்', 'ஊட்டச்சத்து', 'சாப்பிட',
]
