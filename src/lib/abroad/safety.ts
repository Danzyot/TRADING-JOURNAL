/**
 * Whether it is safe and comfortable to be there on an Israeli passport.
 *
 * Not community, not kosher food, not synagogues — just the thing that decides
 * whether you would be relaxed walking around: what the street is like, what
 * the monitors actually recorded, and whether any government has said anything
 * that changes your plans.
 *
 * One thing worth stating once, because it is the finding rather than an
 * opinion: the share of a country's population that is Muslim does not predict
 * any of this. Albania is around half Muslim and among the safest countries in
 * Europe for a Jew. The UAE is three-quarters Muslim and runs an Israeli
 * business community and direct flights. Spain is about 4% Muslim and is the
 * most uncomfortable country on this list to be openly Israeli in, because of
 * its politics rather than its demographics. The variable that matters is the
 * government's current position and the temperature of the street, and both are
 * given below.
 */

export type Safety = {
  /** 0–5: how comfortable an Israeli would actually be, day to day. */
  score: number
  /** What it is like in practice — language, reactions, whether you would hide it. */
  street: string
  /** What incident monitors recorded, attributed, with the caveat it needs. */
  incidents: string
  /** Advisories, government positions, flights — anything official that binds. */
  official: string
  verdict: string
}

export const SAFETY: Record<string, Safety> = {
  greece: {
    score: 4,
    street: 'Hebrew on Crete is unremarkable — hundreds of thousands of Israelis holiday in Greece every year and Chania in particular is used to them. No reason to keep your passport quiet.',
    incidents: 'Greece polls badly on classical antisemitic attitudes and always has, going back well before 2023. Recorded violent incidents are rare: the high per-capita rate in the 2025 figures comes from a Jewish population of about 5,000, not from a wave of attacks.',
    official: 'Close defence and energy relationship with Israel, daily direct flights Athens–Tel Aviv, seasonal direct flights from Heraklion. No advisories in either direction.',
    verdict: 'Comfortable. The attitude surveys look worse than daily life does.',
  },
  cyprus: {
    score: 5,
    street: 'Enough Israelis live in Limassol that Hebrew is a normal shop language. You would be one of many, not a curiosity.',
    incidents: 'Very few recorded. What friction exists is political and aimed at the state, not at people in the street.',
    official: 'Forty-five minutes from Tel Aviv, several flights a day, and a close working relationship. No advisories.',
    verdict: 'The easiest place on this list to be an Israeli, by a distance.',
  },
  spain: {
    score: 2,
    street: 'This is the hard part. Public sentiment is the most hostile to Israel in Western Europe, and demonstrations are frequent and large. Nothing stops you living there and nobody will trouble you personally — but being openly Israeli is more uncomfortable here than anywhere else on this list.',
    incidents: 'The Observatorio de Antisemitismo recorded around 100 offline incidents in its most recent annual report. The climate is the issue rather than the count.',
    official: 'Spain recognised Palestine in 2024 and imposed an arms embargo on Israel. Direct flights continue and there is no advisory in either direction.',
    verdict: 'Best day-to-day life on the list, worst political climate in Europe for an Israeli. Worth knowing before rather than after.',
  },
  portugal: {
    score: 4,
    street: 'Quiet and neutral. Portugal has stayed out of the argument almost entirely and the public temperature is low.',
    incidents: 'Among the lowest recorded levels in Western Europe.',
    official: 'No advisories, direct flights to Lisbon, and a decade of granting citizenship to Sephardic descendants behind it.',
    verdict: 'Calm and uneventful, which is the point.',
  },
  italy: {
    score: 4,
    street: 'Neutral to warm. Demonstrations happen in the northern cities; Sicily and Puglia are unaffected.',
    incidents: 'Monitors recorded a moderate rise in 2025 over 2024, off a low base.',
    official: 'The current government is among the friendlier in Europe to Israel. Frequent direct flights.',
    verdict: 'Comfortable, and the south more so than the north.',
  },
  malta: {
    score: 3,
    street: 'Untroubled and indifferent. Everything runs in English and nobody has an opinion about your passport.',
    incidents: 'Negligible. The island is genuinely safe by any measure.',
    official: 'No advisories. Direct flights are seasonal — otherwise it is a connection through Rome or Athens.',
    verdict: 'Safe and neutral. You would be one of very few Israelis and nobody would notice.',
  },
  croatia: {
    score: 3,
    street: 'Neutral. Large Israeli tourist numbers in summer and no friction on the street.',
    incidents: 'Low by any measure, though the country still argues publicly about its wartime record and the Ustaše period.',
    official: 'No advisories. No direct winter flights — you would connect through Vienna or Zagreb.',
    verdict: 'Untroubled and unremarkable — nobody there has an opinion about your passport.',
  },
  montenegro: {
    score: 3,
    street: 'Welcoming, and visibly so — there is substantial Israeli tourism and property buying on the coast.',
    incidents: 'Very few recorded, and no monitoring organisation of its own, which means low and also means nobody is counting carefully.',
    official: 'No advisories. Not in the EU, so entry is 90 days visa-free on either passport.',
    verdict: 'Friendly and low-profile — a lot of Israelis already holiday and buy on that coast.',
  },
  albania: {
    score: 4,
    street: 'Israelis are visibly welcome and tourism from Israel is growing fast. Albania sheltered its Jews under occupation and finished the war with more than it started with — it is the only country in Europe of which that is true, and the country knows it.',
    incidents: 'Essentially none recorded. Antisemitism is not a live phenomenon here.',
    official: 'Warm at state level. An Israeli passport gets a full year visa-free, which is more than the Polish one gets.',
    verdict: 'Among the safest and warmest places on this list, and around half the population is Muslim — which is the clearest evidence that the demographic tells you nothing.',
  },
  bulgaria: {
    score: 4,
    street: 'Neutral to warm, with heavy Israeli holiday traffic to the Black Sea coast.',
    incidents: 'The 2025 per-capita figures placed Bulgaria high, which is a very small denominator doing the work; the recorded incidents are mostly vandalism and rhetoric.',
    official: 'No advisories, direct flights to Sofia and seasonal ones to Varna and Burgas. Bulgaria saved its 48,000 Jews from deportation in 1943.',
    verdict: 'Historically decent and practically fine.',
  },
  poland: {
    score: 3,
    street: 'The street is neutral and Israeli traffic is constant. The friction is political and historical — the memory laws, the arguments about wartime responsibility — rather than anything personal.',
    incidents: 'Żydowskie Stowarzyszenie Czulent recorded around 100 offline incidents in its most recent report. Attitude polling is worse than the incident count.',
    official: 'No advisories. Daily direct flights. As a citizen you have unconditional right of residence.',
    verdict: 'Practically comfortable; emotionally not neutral, and you would know that going in.',
  },
  georgia: {
    score: 5,
    street: 'Genuinely warm. Enormous Israeli tourism, and a 2,600-year-old Jewish presence that has left almost no tradition of antisemitism behind it.',
    incidents: 'Historically among the lowest in the world, and regularly cited as such.',
    official: 'Direct Tel Aviv flights, 365 days visa-free on either passport, no advisories. The land border with Russia is a separate political risk.',
    verdict: 'The best answer on this criterion outside Israel.',
  },
  uae: {
    score: 4,
    street: 'A growing Israeli business population in Dubai and a state that does not tolerate incidents. Comfortable in practice.',
    incidents: 'Rare. The risk here is political weather rather than street-level.',
    official: 'Direct flights, visa-free entry on either passport, and a decade of normalisation — but it is a relationship between governments and it can cool.',
    verdict: 'Comfortable while the politics hold, and three-quarters Muslim, which again is not the variable.',
  },
  thailand: {
    score: 5,
    street: 'The largest Israeli traveller presence in Asia by a wide margin. Hebrew menus and Israeli restaurants in every town on this list, and nobody thinks twice about it.',
    incidents: 'Negligible. Thailand has no antisemitic tradition.',
    official: 'No advisories. 60 days visa-exempt on either passport, extendable by 30.',
    verdict: 'As easy as it gets outside Europe.',
  },
  'costa-rica': {
    score: 4,
    street: 'A well-worn Israeli travel route and a warm reception. No friction anywhere.',
    incidents: 'Very few recorded, and the community is small enough that no dedicated monitor publishes numbers.',
    official: 'Among Israel’s oldest friends in Latin America. No advisories, up to 180 days as a visitor.',
    verdict: 'Safe and welcoming, and a very long way away.',
  },
  mexico: {
    score: 4,
    street: 'Neutral to warm, with a large Israeli traveller presence on the Riviera Maya.',
    incidents: 'Low. The security concern in Quintana Roo is cartel-related and general, not directed at anyone in particular.',
    official: 'No advisories relating to Israelis. Up to 180 days as a visitor.',
    verdict: 'Fine on this criterion; the security question here is about crime, not about you.',
  },
  panama: {
    score: 5,
    street: 'Panama has the highest share of Jews of any Latin American country and the community is prominent and untroubled. Completely unremarkable to be Israeli.',
    incidents: 'Very low, and the community is prominent enough that incidents would be reported.',
    official: 'Long-standing warm relations, 90 days visa-free.',
    verdict: 'Excellent on this criterion, which does not fix the fact that there is little else to do there.',
  },
  usa: {
    score: 4,
    street: 'South Florida is functionally an Israeli suburb — Aventura, Surfside, Hollywood. The reception there is as good as it gets anywhere.',
    incidents: 'The ADL has recorded record incident numbers since 2023, including on campuses, and the absolute counts are the highest anywhere in the diaspora.',
    official: 'No advisories. Israel joined the Visa Waiver Programme in 2023, so 90 days on ESTA — as a visitor, with no work rights.',
    verdict: 'The most comfortable place in the world to be Israeli outside Israel, in a country you have no right to live in.',
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
]
