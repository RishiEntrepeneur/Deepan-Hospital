/**
 * Fills in the Hindi columns on departments and doctors.
 *
 * Run once after the Hindi columns are added; safe to run again. It only
 * writes rows whose Hindi field is still empty, so anything the hospital
 * corrects by hand afterwards is left alone.
 *
 *   npm run seed-hindi           write
 *   npm run seed-hindi -- --dry  show what would change
 *
 * Doctors' names are transliterated into Devanagari, following the convention
 * already used for Tamil — the same name in a script the reader can read. A
 * Hindi speaker who cannot read Latin gets a name they can pronounce; one who
 * can read Latin loses nothing, since the English name is one language switch
 * away.
 *
 * Anything not listed here keeps falling back to English, which is the correct
 * behaviour and not a gap to be filled with a guess. Qualifications in
 * particular are left in Latin deliberately: "MBBS, MS (Ortho)" is how the
 * degree is written on the certificate, in every language.
 */
import { db } from '../src/db.js'

const DEPARTMENTS = {
  emergency: ['आपातकालीन एवं गहन चिकित्सा', 'कैज़ुअल्टी, आईसीयू और एनेस्थीसिया — चौबीसों घंटे।'],
  'general-medicine': ['सामान्य चिकित्सा', 'बुखार, संक्रमण, मधुमेह, रक्तचाप और सामान्य चिकित्सा।'],
  'general-surgery': ['सामान्य शल्य चिकित्सा', 'हर्निया, अपेंडिक्स, पित्ताशय और अन्य सामान्य ऑपरेशन।'],
  orthopedics: ['हड्डी रोग', 'हड्डी टूटना, जोड़ों की तकलीफ़, आर्थ्रोस्कोपी और खेल में लगी चोटें।'],
  gynecology: ['प्रसूति एवं स्त्री रोग', 'गर्भावस्था की देखभाल, प्रसव, लेप्रोस्कोपिक सर्जरी और महिला स्वास्थ्य।'],
  pediatrics: ['बाल एवं नवजात रोग', 'नवजात की देखभाल, बच्चों की बीमारियाँ, विकास और टीकाकरण।'],
  'pediatric-surgery': ['बाल शल्य चिकित्सा', 'शिशुओं और बच्चों की लेप्रोस्कोपिक तथा खुली सर्जरी।'],
  cardiology: ['हृदय रोग', 'ईसीजी, इको, एंजियोग्राम, एंजियोप्लास्टी और हृदय की नियमित देखभाल।'],
  neurology: ['तंत्रिका रोग', 'लकवा, मिर्गी, सिरदर्द, पार्किंसंस और नसों के रोग।'],
  neurosurgery: ['तंत्रिका शल्य चिकित्सा', 'मस्तिष्क और रीढ़ की सर्जरी, सिर की चोट और ट्यूमर का इलाज।'],
  nephrology: ['गुर्दा रोग', 'गुर्दे की बीमारी, डायलिसिस और प्रत्यारोपण के बाद की देखभाल।'],
  urology: ['मूत्र रोग', 'गुर्दे की पथरी, प्रोस्टेट की तकलीफ़ और मूत्र मार्ग की सर्जरी।'],
  gastroenterology: ['जठर एवं आंत रोग', 'अम्लता, अल्सर, यकृत रोग, एंडोस्कोपी और पेट की सर्जरी।'],
  pulmonology: ['फेफड़ा रोग', 'दमा, सीओपीडी, तपेदिक और छाती के संक्रमण।'],
  dermatology: ['त्वचा रोग', 'त्वचा, बाल और नाखून की तकलीफ़ें, एलर्जी और सौंदर्य उपचार।'],
  ent: ['कान, नाक और गला', 'कान, नाक और गले के रोग, साइनस तथा सुनने की तकलीफ़।'],
  ophthalmology: ['नेत्र रोग', 'मोतियाबिंद, ग्लूकोमा, रेटिना की देखभाल और दृष्टि सुधार।'],
  maxillofacial: ['मुख एवं जबड़ा शल्य चिकित्सा', 'जबड़े, चेहरे और दाँत की सर्जरी, चोट तथा सुधारात्मक ऑपरेशन।'],
  'plastic-surgery': ['प्लास्टिक एवं पुनर्निर्माण सर्जरी', 'चोट या जलने के बाद पुनर्निर्माण और सुधारात्मक ऑपरेशन।'],
  oncology: ['कैंसर रोग', 'कैंसर की जाँच, दवा और सर्जरी द्वारा इलाज तथा सहायक देखभाल।'],
  psychiatry: ['मनोरोग', 'अवसाद, घबराहट, नींद की तकलीफ़, नशे की लत और परामर्श।'],
}

const SPECIALIZATIONS = {
  Cardiologist: 'हृदय रोग विशेषज्ञ',
  'Chief Physician': 'मुख्य चिकित्सक',
  Dermatologist: 'त्वचा रोग विशेषज्ञ',
  'ENT Surgeon': 'कान, नाक, गला सर्जन',
  'Faciomaxillary Surgeon': 'मुख एवं जबड़ा सर्जन',
  Gastroenterologist: 'जठर एवं आंत रोग विशेषज्ञ',
  'General Surgeon': 'सामान्य सर्जन',
  'Intensivist & Anaesthesiologist': 'गहन चिकित्सा एवं निश्चेतना विशेषज्ञ',
  'Medical Oncologist': 'कैंसर रोग विशेषज्ञ',
  Nephrologist: 'गुर्दा रोग विशेषज्ञ',
  'Neuro Physician': 'तंत्रिका रोग विशेषज्ञ',
  Neurosurgeon: 'तंत्रिका शल्य विशेषज्ञ',
  'Obstetrician & Gynaecologist': 'प्रसूति एवं स्त्री रोग विशेषज्ञ',
  'Ophthalmic Surgeon': 'नेत्र शल्य विशेषज्ञ',
  'Orthopaedic & Arthroscopy Surgeon': 'हड्डी एवं आर्थ्रोस्कोपी सर्जन',
  'Orthopaedic Surgeon': 'हड्डी रोग सर्जन',
  'Paediatric Laparoscopic Surgeon': 'बाल लेप्रोस्कोपिक सर्जन',
  'Paediatrician & Neonatologist': 'बाल एवं नवजात रोग विशेषज्ञ',
  'Plastic Surgeon': 'प्लास्टिक सर्जन',
  Psychiatrist: 'मनोरोग विशेषज्ञ',
  Pulmonologist: 'फेफड़ा रोग विशेषज्ञ',
  'Senior General Surgeon': 'वरिष्ठ सामान्य सर्जन',
  'Surgical Gastroenterologist': 'जठर एवं आंत शल्य विशेषज्ञ',
  'Surgical Oncologist': 'कैंसर शल्य विशेषज्ञ',
  Urologist: 'मूत्र रोग विशेषज्ञ',
}

const NAMES = {
  'gunasekaran-r': 'डॉ. रा. गुनशेकरन',
  'joseph-c-mathuram': 'डॉ. जोसेफ़ सी. मधुरम',
  'deepan-g': 'डॉ. गो. दीपन',
  'priyanka-v': 'डॉ. व. प्रियंका',
  'kawin-g': 'डॉ. गो. कविन',
  'vaishnavi-rm': 'डॉ. रम. वैष्णवी',
  'rajagopal-p': 'डॉ. प. राजगोपाल',
  'venkateswaran-n': 'डॉ. न. वेंकटेश्वरन',
  'sridharan-s': 'डॉ. स. श्रीधरन',
  'krishnasamy-kannan': 'डॉ. कृष्णसामी कण्णन',
  'murali-r': 'डॉ. रा. मुरली',
  'senthilkumar-r': 'डॉ. रा. सेंथिलकुमार',
  'narmadha-s': 'डॉ. स. नर्मदा',
  'vijayakumar-b': 'डॉ. ब. विजयकुमार',
  'vignesh-g': 'डॉ. गो. विघ्नेश',
  'hari-prasad': 'डॉ. हरि प्रसाद',
  'subramanian-p': 'डॉ. प. सुब्रमणियन',
  'thirupathi-sp': 'डॉ. सप. तिरुपति',
  'priya-r': 'डॉ. रा. प्रिया',
  'sujatha-s': 'डॉ. स. सुजाता',
  'ashwin-raja': 'डॉ. अश्विन राजा',
  'ramanan-r': 'डॉ. रा. रामनन',
  'kader-sahib-a': 'डॉ. अ. क़ादर साहिब',
  'srinivas-sp': 'डॉ. सप. श्रीनिवास',
  jayakumar: 'डॉ. जयकुमार',
  nithya: 'डॉ. नित्या',
}

const dry = process.argv.includes('--dry')
let written = 0
let skipped = 0

const setDepartment = db.prepare(
  "UPDATE departments SET name_hi = ?, description_hi = ? WHERE id = ? AND name_hi = ''",
)
const setDoctorName = db.prepare("UPDATE doctors SET name_hi = ? WHERE id = ? AND name_hi = ''")
const setDoctorSpec = db.prepare("UPDATE doctors SET spec_hi = ? WHERE id = ? AND spec_hi = ''")

for (const [id, [name, description]] of Object.entries(DEPARTMENTS)) {
  const row = db.prepare('SELECT name_hi FROM departments WHERE id = ?').get(id)
  if (!row) {
    console.warn(`  ? no such department: ${id}`)
    continue
  }
  if (row.name_hi) {
    skipped += 1
    continue
  }
  if (!dry) setDepartment.run(name, description, id)
  console.log(`  department  ${id.padEnd(20)} ${name}`)
  written += 1
}

for (const row of db.prepare('SELECT id, name_en, spec_en, name_hi, spec_hi FROM doctors').all()) {
  const name = NAMES[row.id]
  const spec = SPECIALIZATIONS[row.spec_en]

  if (name && !row.name_hi) {
    if (!dry) setDoctorName.run(name, row.id)
    console.log(`  doctor      ${row.id.padEnd(20)} ${name}`)
    written += 1
  } else if (!name) {
    console.warn(`  ? no Hindi name for ${row.id} (${row.name_en}) — stays English`)
  }

  if (spec && !row.spec_hi) {
    if (!dry) setDoctorSpec.run(spec, row.id)
    written += 1
  } else if (!spec) {
    console.warn(`  ? no Hindi for specialization "${row.spec_en}" — stays English`)
  }
}

console.log()
console.log(`  ${dry ? 'would write' : 'wrote'} ${written} field(s); ${skipped} already set`)
if (dry) console.log('  (dry run — nothing changed)')
console.log()
