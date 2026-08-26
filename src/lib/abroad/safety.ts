/**
 * Being an Israeli Jew in each of these places.
 *
 * You asked about antisemitism and about Muslim populations. These are two
 * different questions and the data does not join them up, so they are reported
 * separately and honestly.
 *
 * What predicts how comfortable a place is: whether there is a community and a
 * Chabad within reach, whether Israelis already live and holiday there, whether
 * the government and the street are hostile to Israel right now, and what the
 * incident monitors actually recorded. What does not predict it: the share of
 * the population that is Muslim. Albania is around half Muslim and is one of
 * the safest countries in Europe for a Jew — it is the country that sheltered
 * its Jews and finished the war with more of them than it started with. The UAE
 * is three-quarters Muslim and runs a synagogue in Abu Dhabi and a Chabad in
 * Dubai. Spain is about 4% Muslim and is the most uncomfortable country on this
 * list to be openly Israeli in. The religious composition is given because it
 * was asked for; it is not the variable that decides anything.
 *
 * Incident counts are near-useless raw and misleading per-capita when a
 * community is tiny — a hundred incidents against 5,000 Greek Jews and a
 * hundred against 45,000 Spanish Jews are not comparable rates of anything.
 * So the incident line says what was recorded and by whom, and the verdict is a
 * judgement that says it is one.
 */

export type Safety = {
  /** 0–5 on the criterion: community, comfort, and how Israelis are treated. */
  score: number
  /** The community: how big, and where it actually is. */
  community: string
  /** Chabad, kosher food and a minyan, in the towns on this list specifically. */
  chabad: string
  /** What the monitors recorded, attributed. */
  incidents: string
  /** How an Israeli is treated in practice — entry, flights, the street. */
  israelis: string
  /** Religious composition, as a plain demographic fact. */
  faith: string
  verdict: string
}

export const SAFETY: Record<string, Safety> = {
  greece: {
    score: 4,
    community: 'About 5,000 Jews, mostly Athens and Thessaloniki. Chania has Etz Hayyim, the restored 15th-century synagogue — arson-attacked in 2010, rebuilt, and running since.',
    chabad: 'Chabad in Athens, Thessaloniki, Rhodes and Chania. The Crete house runs Passover to November and is quiet in winter; Athens is year-round with kosher groceries and delivery to the islands.',
    incidents: 'Greece polls badly on classical antisemitic attitudes and always has; recorded violent incidents are rare, and the per-capita rate that put it high in the 2025 figures is a tiny denominator, not a wave of attacks.',
    israelis: 'Close defence and energy relationship, daily direct flights from Athens and seasonal ones from Heraklion, and a large annual Israeli tourist presence. Speaking Hebrew on Crete is unremarkable.',
    faith: 'Around 90% Greek Orthodox; roughly 2% Muslim, concentrated in Thrace and among recent migrants.',
    verdict: 'Comfortable, with a real community in Athens and a seasonal one on Crete. The attitude surveys look worse than daily life does.',
  },
  cyprus: {
    score: 5,
    community: 'A young community of roughly 3,000, grown almost entirely by Israelis moving over in the last fifteen years.',
    chabad: 'Chabad in Larnaca, Limassol, Paphos, Nicosia and Ayia Napa, kosher shops, a mikveh and a Jewish school in Larnaca. The best Jewish infrastructure per head on this list.',
    incidents: 'Very few recorded. The friction that exists is political and directed at the state, not at people in the street.',
    israelis: 'Forty-five minutes from Tel Aviv, several flights a day, and enough Israelis in Limassol that Hebrew is a normal shop language.',
    faith: 'The Republic is around 90% Greek Orthodox; the Turkish Cypriot north is separate and majority Muslim.',
    verdict: 'The easiest place on this list to be an Israeli, by a distance. It is also the least like a change of life.',
  },
  spain: {
    score: 2,
    community: 'Around 45,000 Jews — Madrid, Barcelona, Málaga and Marbella, which has a real community and a kosher supply.',
    chabad: 'Chabad in Madrid, Barcelona, Valencia, Málaga, Marbella, Alicante and Las Palmas. Marbella is the one with actual kosher shops.',
    incidents: 'The Observatorio de Antisemitismo recorded around 100 offline incidents in its most recent annual report. The bigger issue is climate rather than count.',
    israelis: 'This is the hard part. Spain recognised Palestine in 2024, imposed an arms embargo, and public sentiment is the most hostile to Israel in Western Europe. Nothing stops you living there; being openly Israeli is more uncomfortable than anywhere else on this list bar Turkey.',
    faith: 'Around 4–5% Muslim, mostly of Moroccan origin, concentrated in Catalonia, Madrid and the south.',
    verdict: 'Best day-to-day life on the list, worst political climate in Europe for an Israeli. Worth knowing before, not after.',
  },
  portugal: {
    score: 4,
    community: 'Small — roughly 3,000 — with Lisbon and Porto both active, and Porto unusually well resourced.',
    chabad: 'Chabad in Lisbon and Cascais, kosher available in Lisbon. Nothing in the Algarve.',
    incidents: 'Among the lowest recorded levels in Western Europe.',
    israelis: 'Quiet and neutral. Portugal spent years granting citizenship to Sephardic descendants and the public temperature is low.',
    faith: 'Under 1% Muslim. Overwhelmingly Catholic by heritage and largely secular in practice.',
    verdict: 'Calm and uneventful, which is the point. Cascais has a Chabad; the Algarve has nothing.',
  },
  italy: {
    score: 4,
    community: 'Around 28,000, the oldest continuous Jewish presence in Europe. Rome and Milan are strong; Sicily and Puglia have essentially nothing.',
    chabad: 'Chabad across the northern and central cities and in Rome. Catania and the Puglian towns on this list are on their own — Rome is the nearest real infrastructure.',
    incidents: 'Monitors recorded a moderate rise in 2025 over 2024, off a low base.',
    israelis: 'The current government is among the friendlier in Europe to Israel, and direct flights are frequent.',
    faith: 'Around 5% Muslim nationally, concentrated in the industrial north rather than the south.',
    verdict: 'Fine as a country, thin in exactly the towns this list recommends. Catania is a four-hour trip from a minyan.',
  },
  malta: {
    score: 3,
    community: 'Perhaps 150 people. It is a community in name.',
    chabad: 'One Chabad, in Ta’ Xbiex, ten minutes from Sliema. Kosher is special order.',
    incidents: 'Negligible, and the island is genuinely safe.',
    israelis: 'Neutral, English-speaking and untroubled. Direct flights are seasonal.',
    faith: 'Around 3% Muslim; officially and culturally Roman Catholic.',
    verdict: 'Safe and empty. You would be one of very few, with one Chabad and a plane ride to anything else.',
  },
  croatia: {
    score: 3,
    community: 'About 1,700, essentially all in Zagreb. The coast has none.',
    chabad: 'Chabad Zagreb. Nothing in Split, Zadar or anywhere else on this list.',
    incidents: 'Low, though the country still argues publicly about its wartime record.',
    israelis: 'Large Israeli tourist numbers in summer and a neutral street. No direct flights in winter.',
    faith: 'Around 1.5% Muslim; predominantly Catholic.',
    verdict: 'Untroubled and unsupported. A pleasant coast with no Jewish life on it at all.',
  },
  montenegro: {
    score: 3,
    community: 'A few hundred. Judaism became an officially recognised religion in 2012, which tells you the scale.',
    chabad: 'No permanent Chabad. Seasonal presence only, and Dubrovnik or Belgrade for anything more.',
    incidents: 'Very few recorded, and no monitoring organisation of its own — which means low, and also means nobody is counting carefully.',
    israelis: 'Substantial Israeli tourism and property buying on the coast, and a welcoming attitude that follows the money.',
    faith: 'Around 19% Muslim, mostly Bosniak and Albanian communities in the east and north; the coast is Orthodox.',
    verdict: 'Friendly, cheap and entirely without infrastructure.',
  },
  albania: {
    score: 4,
    community: 'Tiny today, but the history matters: Albania sheltered its Jews and refugees under occupation, through the code of besa, and finished the war with more Jews than it started with. It is the only country in Europe of which that is true.',
    chabad: 'Chabad Tirana, which serves the whole country and runs Passover programmes. Nothing on the coast.',
    incidents: 'Essentially none recorded. Antisemitism is not a live phenomenon here.',
    israelis: 'Israelis are visibly welcome, tourism is growing fast, and the relationship is warm at state level.',
    faith: 'Around half to sixty percent Muslim by heritage, alongside Orthodox and Catholic minorities — and one of the most secular and religiously indifferent populations in Europe. This is the case that shows the demographic tells you nothing: a majority-Muslim country that is among the safest in Europe to be a Jew.',
    verdict: 'Warm, safe, and with no community to be part of. Cheapest coast in Europe, and you would be the only one.',
  },
  bulgaria: {
    score: 4,
    community: 'Around 2,000, mostly Sofia. Bulgaria saved its 48,000 Jews from deportation in 1943 and the country knows it.',
    chabad: 'Chabad Sofia with kosher supply. Varna and Burgas have no permanent presence.',
    incidents: 'The 2025 per-capita figures placed Bulgaria high, which is a very small denominator doing the work; the recorded incidents are mostly vandalism and rhetoric.',
    israelis: 'Heavy Israeli holiday traffic to the Black Sea, direct flights, and a neutral-to-warm street.',
    faith: 'Around 10% Muslim — a long-established Turkish and Pomak minority, not a recent one.',
    verdict: 'Historically decent, practically fine, and the coast has nothing organised.',
  },
  poland: {
    score: 3,
    community: 'Somewhere between 10,000 and 20,000 identifying Jews and a genuine revival — the Warsaw and Kraków JCCs, POLIN, Kazimierz. Also the heaviest history on this list.',
    chabad: 'Chabad in Warsaw, Kraków, Gdańsk and several other cities, with kosher supply in Warsaw and Kraków.',
    incidents: 'Żydowskie Stowarzyszenie Czulent recorded around 100 offline incidents in its most recent report. Attitudes polling is worse than the incident count.',
    israelis: 'Constant Israeli traffic, direct flights daily, and a street that is neutral. The friction is political and historical — the memory laws, the arguments about wartime responsibility — rather than personal.',
    faith: 'Under 0.1% Muslim. One of the most religiously homogeneous countries in Europe.',
    verdict: 'Real Jewish life in the cities and real historical weight to live alongside. Practically comfortable; emotionally not neutral.',
  },
  turkey: {
    score: 1,
    community: 'Around 14,500, almost all in Istanbul, and shrinking.',
    chabad: 'Chabad Istanbul. Nothing on the coast where this list points.',
    incidents: 'The environment is the problem rather than any single count. In April 2026 gunmen exchanged fire with police near the Israeli consulate in Istanbul.',
    israelis: 'Israel has a standing "do not travel" advisory for Turkey, rated at its most severe level as of June 2026, and the diplomatic relationship is at its worst in decades. Whatever Antalya costs, this is not a place to spend three months on an Israeli passport right now.',
    faith: 'Around 98% Muslim, and a government that has made hostility to Israel a central theme.',
    verdict: 'Ruled out on this criterion alone, and it is the criterion that should rule it out. Re-check if the relationship changes.',
  },
  georgia: {
    score: 5,
    community: 'One of the oldest Jewish communities on earth — 2,600 years — with synagogues in Tbilisi, Kutaisi and Batumi still in use.',
    chabad: 'Chabad in both Tbilisi and Batumi, with kosher restaurants and Shabbat meals in each. Unusually good for the size of the country.',
    incidents: 'Historically among the lowest in the world. Georgia has close to no tradition of antisemitism and is regularly cited as such.',
    israelis: 'Enormous Israeli tourism, direct Tel Aviv flights, 365 days visa-free, and a genuinely warm reception.',
    faith: 'Around 10% Muslim, mostly Azeri and Adjarian communities; the country is overwhelmingly Georgian Orthodox.',
    verdict: 'The best answer on this criterion outside Israel, and it comes with a 1% tax rate and no sea worth the name.',
  },
  uae: {
    score: 4,
    community: 'The Jewish Community of the Emirates, formalised after the Abraham Accords, with a growing Israeli business population in Dubai.',
    chabad: 'Chabad Dubai, kosher supply and restaurants, and a synagogue at the Abrahamic Family House in Abu Dhabi.',
    incidents: 'Rare, and the state does not tolerate them. The risk here is political weather rather than street-level.',
    israelis: 'Direct flights, visa-free entry, and a decade of normalisation behind it — but it is a relationship between governments, and it can cool.',
    faith: 'Around three-quarters Muslim, and a state religion. The second case that breaks the proxy: a Muslim state that is among the most practically comfortable places on this list.',
    verdict: 'Good infrastructure, real community, and a comfort level that depends on politics staying where it is.',
  },
  thailand: {
    score: 5,
    community: 'No resident community to speak of, and the largest Israeli traveller presence in Asia by a wide margin.',
    chabad: 'Chabad in Bangkok, Phuket, Koh Samui, Chiang Mai and Krabi, with kosher restaurants at several. Every town on this list is covered.',
    incidents: 'Negligible. Thailand has no antisemitic tradition.',
    israelis: 'Hebrew menus, Israeli restaurants and Chabad Shabbat dinners in every place named here. Practically speaking this is the easiest non-European country on the list.',
    faith: 'Around 94% Buddhist; roughly 5% Muslim, concentrated in the deep southern provinces, several hundred kilometres from anywhere on this list.',
    verdict: 'Chabad in every town, and the only real objection to Thailand remains the trading clock.',
  },
  'costa-rica': {
    score: 4,
    community: 'Around 3,000, well organised, almost entirely in San José.',
    chabad: 'Chabad Costa Rica in San José with kosher supply. The Pacific coast towns have none — Tamarindo is four hours away.',
    incidents: 'Very few recorded, and the community is small enough that there is no dedicated monitor publishing numbers.',
    israelis: 'A well-worn Israeli travel route and a warm reception; Costa Rica is among Israel’s oldest friends in Latin America.',
    faith: 'Predominantly Catholic; under 1% Muslim.',
    verdict: 'Safe and welcoming, with the community and the kosher shop on the wrong side of the country.',
  },
  mexico: {
    score: 4,
    community: 'Around 40,000 — one of the strongest and most organised communities in Latin America, concentrated in Mexico City.',
    chabad: 'Chabad in Playa del Carmen, Cancún and Tulum, with kosher restaurants in Playa. Mexico City has everything.',
    incidents: 'Low, and the community is confident and visible.',
    israelis: 'Large Israeli traveller presence on the Riviera Maya, and a neutral-to-warm reception.',
    faith: 'Overwhelmingly Catholic; under 1% Muslim.',
    verdict: 'Genuinely good on this criterion, and Playa del Carmen is the one Latin American town on the list with Chabad on the doorstep.',
  },
  panama: {
    score: 5,
    community: 'Around 15,000 — the highest share of Jews in any Latin American country, and a community with real institutional weight.',
    chabad: 'Several synagogues in Panama City, kosher supermarkets, restaurants and schools. The strongest kosher infrastructure in the Americas outside the US.',
    incidents: 'Very low. The community is prominent and untroubled.',
    israelis: 'Long-standing warm relations and an established Israeli business presence.',
    faith: 'Predominantly Catholic; around 1% Muslim.',
    verdict: 'Excellent on this criterion, which does not fix the fact that there is little else to do there.',
  },
  usa: {
    score: 4,
    community: 'The largest Jewish population outside Israel. South Florida in particular — Aventura, Surfside, Hollywood — is functionally an Israeli suburb.',
    chabad: 'Everywhere. Kosher supermarkets, Israeli restaurants, Hebrew-speaking schools, and a minyan on every side of town in Miami.',
    incidents: 'The ADL has recorded record incident numbers since 2023, including on campuses, and the absolute counts are the highest anywhere in the diaspora.',
    israelis: 'A very large Israeli community, and the reception in South Florida specifically is as good as it gets.',
    faith: 'Around 1.3% Muslim, and around 2% Jewish — the highest Jewish share of any country on this list.',
    verdict: 'The best Jewish infrastructure in the world outside Israel, in a country you have no right to live in.',
  },
}

export const SAFETY_SOURCES = [
  {
    label: 'Antisemitism Worldwide Report 2025 — Tel Aviv University',
    url: 'https://cst.tau.ac.il/wp-content/uploads/2026/04/Data.pdf',
  },
  {
    label: 'J7 report on antisemitic attacks, 2025 — ADL',
    url: 'https://www.adl.org/resources/press-release/j7-report-2025-was-deadliest-year-antisemitic-attacks-diaspora-over-30',
  },
  {
    label: 'Monitoring antisemitism in the EU — EU Agency for Fundamental Rights',
    url: 'https://fra.europa.eu/en/publication/2026/antisemitism-overview',
  },
  { label: 'Chabad centre directory', url: 'https://www.chabad.org/jewish-centers/' },
]
