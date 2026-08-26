/**
 * The connection at the address, not the country's average.
 *
 * "Greece has fibre" is true and useless: a house in Akrotiri is on gigabit and
 * a house twenty minutes inland is on 10 Mbps copper, and the difference decides
 * whether you can hold a position. What is genuinely national is who the
 * carriers are, what a line costs, and where to check an address before signing.
 * What is local is whether the street has been built out and how the connection
 * fails when it fails — and that lives on each town's own entry.
 *
 * The rule this page exists to enforce: check the exact address, on the
 * provider's own coverage map, before you sign anything. Every landlord says
 * there is fibre.
 */

export type Connectivity = {
  /** The carriers that actually serve these towns. */
  carriers: string
  /** What a residential line costs and delivers. */
  line: string
  /** The mobile network you would fall back to, and what it does. */
  mobile: string
  /** Where to check a specific address. */
  checker: string
  /** How much a fallback matters here, 1–5. */
  fallbackMatters: number
}

export const CONNECTIVITY: Record<string, Connectivity> = {
  greece: { carriers: 'Cosmote, Nova, Vodafone', line: 'Cosmote Fiber 100–1000 Mbps, €30–45. Outside the FTTH footprint it is VDSL at 24–50 Mbps, or worse.', mobile: 'Cosmote 5G is the best network; 100–300 Mbps in the towns. A 100 GB data SIM is about €20.', checker: 'Cosmote and Nova both publish an address-level availability check — use the street number, not the village.', fallbackMatters: 4 },
  cyprus: { carriers: 'Cyta, Epic, PrimeTel', line: 'Cyta gigabit FTTH across the coastal towns, €35–50. Coverage is close to universal in Limassol and Paphos.', mobile: 'Epic and Cyta 5G, 200–400 Mbps almost everywhere.', checker: 'Cyta address check. Almost everything on the list is covered.', fallbackMatters: 1 },
  spain: { carriers: 'Movistar, Orange, Vodafone, Digi', line: 'Spain has the deepest FTTH network in Europe. 600 Mbps–1 Gbps for €30, symmetric, in every town here.', mobile: '5G everywhere, 200–400 Mbps. Digi sells 100 GB for €10.', checker: 'Movistar cobertura by address — but in Spain the answer is almost always yes.', fallbackMatters: 1 },
  portugal: { carriers: 'MEO, NOS, Vodafone, Digi', line: 'Gigabit FTTH in the coastal towns for €35–45.', mobile: '5G strong along the coast, 150–300 Mbps.', checker: 'MEO and NOS both check by address.', fallbackMatters: 1 },
  italy: { carriers: 'TIM, Fastweb, Vodafone, Iliad, Open Fiber', line: 'FTTH in the cities and the larger coastal towns at 1 Gbps for €25–35. The south is patchier than the north and "fibra" often means FTTC at 100/20.', mobile: 'Iliad and TIM 5G, 100–250 Mbps, and cheap.', checker: 'Open Fiber and TIM publish civic-number checks. Insist on FTTH, not FTTC.', fallbackMatters: 3 },
  malta: { carriers: 'GO, Melita', line: 'Near-universal gigabit. Melita and GO both do 1 Gbps for €40.', mobile: '5G island-wide.', checker: 'Barely necessary — Malta is one of the best-connected countries in the EU.', fallbackMatters: 1 },
  croatia: { carriers: 'Hrvatski Telekom, A1, Optima', line: 'FTTH in Split, Zadar and Rijeka at 300 Mbps–1 Gbps for €30–40. Island and village coverage is thin.', mobile: 'A1 and HT 5G along the coast, 100–250 Mbps.', checker: 'HT address check.', fallbackMatters: 2 },
  montenegro: { carriers: 'Crnogorski Telekom, One, m:tel', line: 'FTTH in the coastal towns at 100–300 Mbps for €25–35. Reliability is the weak point, not speed.', mobile: '4G everywhere, 5G in Podgorica and the main coast. 50–150 Mbps.', checker: 'Ask the landlord for the router model and run a speed test in the flat before signing.', fallbackMatters: 4 },
  albania: { carriers: 'One Albania, Vodafone, Digicom', line: 'Albania built late and therefore built fibre — 100–1000 Mbps for €20–30 in the coastal towns, and it is better than its reputation.', mobile: '4G and 5G along the coast, 50–200 Mbps, very cheap.', checker: 'One Albania coverage map; village addresses need checking in person.', fallbackMatters: 3 },
  bulgaria: { carriers: 'Vivacom, A1, Yettel', line: 'Among the fastest and cheapest in Europe: gigabit for €15–20 in Varna, Burgas and Sofia.', mobile: '5G in the cities, 150–400 Mbps.', checker: 'Vivacom address check; coverage in the towns here is dense.', fallbackMatters: 1 },
  poland: { carriers: 'Orange, Play, T-Mobile, Vectra, Netia', line: 'Gigabit FTTH across the Tri-City, Kraków and Warsaw, €12–20. Among the best value on this list.', mobile: '5G everywhere, 200–500 Mbps, and mobile data is nearly free.', checker: 'Orange światłowód by address.', fallbackMatters: 1 },
  turkey: { carriers: 'Türk Telekom, Superonline, Vodafone', line: 'Superonline fibre at 100–1000 Mbps in Antalya and İzmir. Speeds are good; the throttling and regulatory blocks are the annoyance.', mobile: 'Turkcell 5G, 100–300 Mbps. Foreign phones must be registered after 120 days or they are blocked.', checker: 'Superonline address check — and ask specifically about upload.', fallbackMatters: 3 },
  georgia: { carriers: 'Magti, Silknet, Caucasus Online', line: 'Fibre in Tbilisi and Batumi at 100–500 Mbps for €15–25, and a large remote-work population keeps it honest.', mobile: 'Magti 4G/5G, 50–200 Mbps, very cheap.', checker: 'Magti coverage; Batumi towers are well served, the hills behind are not.', fallbackMatters: 2 },
  uae: { carriers: 'Etisalat (e&), du', line: 'Fibre to essentially every building. 500 Mbps–1 Gbps, and expensive by every other standard here: AED 400–600 a month.', mobile: '5G everywhere, 300–700 Mbps.', checker: 'Not needed. The UAE is the most reliably connected place on this list.', fallbackMatters: 1 },
  thailand: { carriers: 'AIS, True, 3BB', line: 'AIS Fibre 500 Mbps–1 Gbps for ฿600–900 (€16–24). Cheap, fast and genuinely everywhere on these islands.', mobile: 'AIS and True 5G, 100–300 Mbps, ฿300 a month.', checker: 'AIS coverage by address; the real check is the power, not the line.', fallbackMatters: 4 },
  'costa-rica': { carriers: 'Kölbi (ICE), Liberty, Tigo', line: 'Fibre in the towns at 100–500 Mbps for $40–60. Outside them it stops abruptly.', mobile: 'Kölbi 4G/5G, 30–120 Mbps, patchy on the coast road.', checker: 'Ask the specific house, not the town. Starlink is the standard answer and works well.', fallbackMatters: 5 },
  mexico: { carriers: 'Telmex, Totalplay, Izzi', line: 'Totalplay fibre 200–500 Mbps for $30–45 in the Riviera Maya cities.', mobile: 'Telcel 5G, 80–250 Mbps, best coverage by a distance.', checker: 'Totalplay and Telmex both check by address; Tulum beach road is the known weak spot.', fallbackMatters: 3 },
  panama: { carriers: 'Cable & Wireless, Tigo', line: 'The region’s cables land here. 200–600 Mbps in the city for $40–60; the coast and islands are much weaker.', mobile: '4G/5G solid in the city, thin in Bocas.', checker: 'Ask for a speed test in the actual unit.', fallbackMatters: 3 },
  usa: { carriers: 'Xfinity, AT&T Fiber, Frontier, Spectrum', line: 'Gigabit almost everywhere, $60–90 — the most expensive on this list and the most dependable.', mobile: '5G everywhere, 200–600 Mbps.', checker: 'Address lookup on any carrier site; competition is the only real variable.', fallbackMatters: 1 },
}

/** What to do about it, wherever you land. */
export const FALLBACK_RULE = [
  'Run a speed test standing in the actual flat, at the hour you would be trading, before you sign anything.',
  'Ask for the upload figure, not the download. A 500/20 line is a bad trading line.',
  'Buy a local data SIM in week one and test tethering under load — that is your real fallback, not a promise.',
  'A €70 UPS keeps the router and the laptop alive through the short cuts that take out a whole street.',
  'Where the fallback score is 4 or 5, budget for Starlink or a second line rather than hoping.',
]
