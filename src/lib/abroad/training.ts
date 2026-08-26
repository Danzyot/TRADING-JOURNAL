/**
 * Training as a beginner, not as a competitor.
 *
 * The first version of this research ranked towns by how good their best room
 * was, which is the wrong question for someone who has never trained. A gym
 * full of professionals preparing for fights is worse for a white belt than a
 * mid-sized club with a fundamentals class four evenings a week and someone who
 * will explain a warm-up in English.
 *
 * So the criterion is: can you walk in next week, be shown what to do, and keep
 * going? Three things decide that — whether there is a beginners' class as
 * opposed to one open mat, whether you will be taught in a language you speak,
 * and whether a month costs a sensible amount without a contract.
 */

export type TrainingClimate = {
  /** What an unlimited month costs, in euros. */
  price: string
  /** What you will actually be taught in. */
  language: string
  /** Trial classes, contracts, gear — the friction of the first week. */
  joining: string
}

export const TRAINING_CLIMATE: Record<string, TrainingClimate> = {
  greece: { price: '€50–80 unlimited, gym on top at €30', language: 'Classes in Greek; coaches and most students speak English and will switch for you.', joining: 'A free trial is normal, monthly rolling, no contracts. A gi is €60–90 when you want one.' },
  cyprus: { price: '€60–90 unlimited', language: 'English throughout — the clubs are used to foreigners and to Israelis.', joining: 'Drop-ins and trials standard; several clubs run explicit beginner intakes.' },
  spain: { price: '€50–75 unlimited', language: 'Classes in Spanish. The bigger academies run English-friendly beginner groups; the small ones do not.', joining: 'Trial class free, monthly rolling. Some academies want a federation licence (~€40/year).' },
  portugal: { price: '€50–70 unlimited', language: 'Portuguese, with English readily spoken — Cascais and Lisbon clubs are full of foreigners.', joining: 'Trials normal, no contracts.' },
  italy: { price: '€50–70 unlimited', language: 'Italian, and less English than Spain outside the northern cities.', joining: 'An annual club membership and a medical certificate are usually required — a €40 sports physical, done in a day.' },
  malta: { price: '€70–100 unlimited', language: 'English is an official language; every class is in English.', joining: 'The most frictionless first week on this list. Drop-in, pay monthly, done.' },
  croatia: { price: '€45–65 unlimited', language: 'Croatian, English widely spoken in Split and Zadar.', joining: 'Trials normal; smaller clubs are informal about it.' },
  montenegro: { price: '€35–55 unlimited', language: 'Montenegrin; English is patchy outside the tourist towns.', joining: 'Turn up and ask. Nothing is formalised.' },
  albania: { price: '€25–45 unlimited', language: 'Albanian; English is common among young people.', joining: 'Informal throughout.' },
  bulgaria: { price: '€35–55 unlimited', language: 'Bulgarian, with English common in Varna and Sofia.', joining: 'Trials normal, monthly rolling.' },
  poland: { price: '€40–60 unlimited', language: 'Polish. English is common in the big-city clubs and less so elsewhere — and you will pick up the Polish.', joining: 'Well-organised: structured beginner courses with a fixed start date are normal here, which is the friendliest possible way in.' },
  georgia: { price: '€30–50 unlimited', language: 'Georgian and Russian. English is available in the Tbilisi clubs used to foreigners.', joining: 'Informal, cheap, and the wrestling base makes the rooms hard even at beginner level.' },
  uae: { price: '€120–200 unlimited', language: 'English throughout.', joining: 'Highly organised and expensive. Jiu-jitsu is a school subject here, so beginner pathways are excellent.' },
  thailand: { price: '€60–110 unlimited, or about €8 a session', language: 'English is the working language of every gym on this list — they exist for foreigners.', joining: 'The easiest beginners can get anywhere: walk in, pay for a week, borrow gloves, be taught from zero. No contract, no federation, no medical.' },
  'costa-rica': { price: '€60–90 unlimited', language: 'English and Spanish both; the coastal academies run in English.', joining: 'Drop-in culture, no contracts.' },
  mexico: { price: '€45–70 unlimited', language: 'Spanish, with English standard in Playa del Carmen and Tulum.', joining: 'Trials normal.' },
  panama: { price: '€60–85 unlimited', language: 'Spanish and English.', joining: 'Small clubs, informal, welcoming.' },
  usa: { price: '€130–200 unlimited', language: 'English.', joining: 'The best-structured beginner programmes anywhere — and often a 12-month contract to go with them.' },
}

/**
 * What a first month would actually be like, in the towns that have a room.
 *
 * Absent for a town with no mat: the entry's own training line already says
 * where the nearest one is, and inventing a beginner experience for a gym that
 * does not exist would be the worst kind of filler.
 */
export const BEGINNER: Record<string, string> = {
  chania: 'Chania Combat Sports runs a mixed-level evening schedule rather than a separate beginners class — small enough that you are coached individually, which for a first month is better than a big room.',
  heraklion: 'The biggest scene on Crete and the only one with enough students to run a genuine beginners group year-round.',
  'athens-riviera': 'Alliance and Kimura both run structured fundamentals programmes with their own timetable. If you want to be taught properly from zero in Greece, this is where.',
  kalamata: 'The Camp 10 is a general athletic club with an MMA section, so the room is used to people arriving with no background at all.',
  thessaloniki: 'Several clubs, real beginner intakes, and a student city where turning up alone is normal.',
  limassol: 'Gracie Barra runs the standard worldwide fundamentals syllabus and Checkmat has a beginners track. Both are used to Israelis walking in.',
  paphos: 'Furious Fighters and Kings BJJ both take absolute beginners and teach in English. Small rooms, lots of attention.',
  nicosia: 'City clubs with regular beginner intakes.',
  valencia: 'Michal Adamczak’s academy is the analytical, detail-heavy one and the best of the four for a first year. Fight4Life is the big room with a cage — impressive, and not where to start.',
  malaga: 'Rilion Gracie runs the classic fundamentals curriculum. Scramble is world-class and openly welcomes beginners, but you would be the smallest fish in a serious pond.',
  alicante: 'Fightzone runs over 100 classes a week, which means genuine beginner slots at sensible hours. Climent Club is a professional fight team — go and watch, do not start there.',
  marbella: 'Facilities built for a paying membership rather than a fight team, which for a beginner is the right way round.',
  palma: 'SurUnion and BJJPalma both run beginner classes; the island scene is small and friendly.',
  'las-palmas': 'Team Romero is a full club — BJJ, grappling, Muay Thai — and used to teaching people from scratch.',
  cascais: 'Flow MMA deliberately runs small classes with a wellness-and-beginners orientation. Of everywhere on this list, this is the softest possible landing.',
  carcavelos: 'Local clubs plus everything in Lisbon 20 minutes away; Gracie Barra Campolide runs the standard fundamentals programme.',
  'aci-castello': 'Five rooms means you can choose the one that suits — Fundamental BJJ is the beginner-oriented one by name and by practice.',
  cagliari: 'CL Fight Team and Riot Academy both take beginners; Wolfpack is the harder room.',
  sliema: 'Malta Fight Co. is the single most beginner-friendly answer in Europe: everything in English, around 20 classes a week, €70–100 unlimited, no contract.',
  gzira: 'Malta Fight Co., a 15-minute walk. Same answer.',
  split: 'Mizfits runs a fundamentals class and is used to foreigners passing through for a season.',
  budva: 'MMA Klub Budva at the town sports centre — small, informal, and it will take you from nothing.',
  varna: 'House of Jiu-Jitsu runs beginner classes; Yagadome’s camps are for people with a base.',
  sofia: 'Champions Academy and a full set of city clubs with structured beginner tracks.',
  sopot: 'Akademia Sarmatia runs fixed-start beginner courses — you join a group of people who all started the same week, which is the easiest way in that exists.',
  gdynia: 'The Tri-City clubs share students; Sarmatia in Gdańsk is 20 minutes by train and runs the beginner intakes.',
  krakow: 'Sixteen BJJ gyms in the city, several with dedicated beginner courses starting each term.',
  warsaw: 'Atos and Akademia Gorila both run beginner programmes, in the deepest scene in the country.',
  opatija: 'The Rijeka clubs, 15 minutes away, run regular beginner intakes.',
  tbilisi: 'Warriors and Legion both take beginners. The wrestling culture means the average training partner is stronger than you expect — good for learning, hard for the first month.',
  jbr: 'Jiu-jitsu is state-supported here and every academy runs a structured beginner pathway. The Forge and Alliance both have proper fundamentals programmes.',
  'dubai-hills': 'Everything the city has, within 20 minutes.',
  saadiyat: 'Federation-accredited schools with formal beginner grading. The most structured start on this list.',
  rawai: 'Tiger Muay Thai runs beginner Muay Thai and BJJ every day, in English, for people who have never trained. You can start on a Monday having never thrown a punch. This is the most beginner-friendly place on earth for this.',
  bangtao: 'Bangtao runs beginner classes daily alongside the professional side, same walk-in model.',
  'koh-samui': 'Superpro takes beginners daily; smaller and calmer than the Phuket camps.',
  'chiang-mai': 'Tiger’s Chiang Mai location and Santai both teach from zero, in English, to a mostly foreign room.',
  tamarindo: 'Hero Academy teaches a lot of complete beginners and runs kids’ programmes alongside, so the coaching is patient by habit.',
  'santa-teresa': 'Santa Teresa MMA is small and mixed-level; you would be coached personally.',
  'playas-del-coco': 'Coco Beach MMA is a small club used to travellers arriving with no experience.',
  'playa-del-carmen': 'Gracie Barra runs the worldwide fundamentals syllabus in English and Spanish — the most predictable beginner start in Latin America.',
  tulum: 'Jiujitsu Tulum takes beginners; the B-Team base is for people with a base.',
  merida: 'City academies with beginner classes, and almost no foreigners in them.',
  'panama-city': 'The Atos affiliate runs a fundamentals programme.',
  'fort-lauderdale': 'Every famous academy here runs a beginners programme, because that is what pays for the fight team. Expect a contract.',
  'st-petersburg': 'South Tampa Jiu-Jitsu runs six days a week with a proper beginner track.',
  'san-diego': 'The Arena runs 30+ adult BJJ classes a week with strong fundamentals teaching — built for beginners in a city of world champions.',
  austin: 'Gracie Humaitá runs the standard fundamentals curriculum.',
}
