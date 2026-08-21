# Prop-trader tax: structures and countries (researched August 2026)

For an Israeli-resident futures prop trader considering entities ("S corp?")
and relocation (Cyprus, Greece, Thailand, Costa Rica, Dubai, and the rest of
Europe). Everything here is arithmetic on published rules with sources — it is
**not advice**. Rules in this space change yearly and every serious move below
needs a licensed advisor *in that country* plus an Israeli advisor for the
exit. See the disclaimer at the end for exactly what to ask them.

---

## 1. The S-corp idea, answered first

**You cannot use an S corporation, and the advice doesn't transfer to you.**

- An S corp is a *US tax election*. Its shareholders must be US citizens or
  US residents — a non-resident alien is a prohibited shareholder under IRC
  §1361(b)(1)(C), and a single ineligible shareholder kills the election.
  As an Israeli tax resident you are exactly that prohibited shareholder.
- The reason US traders love S corps doesn't exist for you anyway: the trick
  reduces **US self-employment tax** (15.3%) by splitting income into salary
  + distributions. You don't pay US self-employment tax. Your equivalent is
  Israeli Bituach Leumi, and an S corp does nothing about that.
- The generalized version — "run everything through a foreign company and
  write off expenses" — fails against two Israeli rules:
  1. **Management and control**: a company incorporated anywhere is an
     *Israeli* company for tax if its real decisions are made from Israel.
     You, trading from your apartment, are the management and the control.
  2. **CFC rules**: even a genuinely foreign company that is >50% Israeli-
     owned with passive low-taxed profits gets its undistributed profits
     attributed to you as deemed dividends.
- A **US LLC** (Wyoming/Delaware, disregarded) is a different animal and is
  sometimes worth having — not for tax, but for banking/receiving payouts.
  A non-US person performing services outside the US through a disregarded
  LLC generally owes no US tax (file the 5472/1120 information return, give
  the firm a W-8BEN). But **all of the income is still yours, taxed where
  you live**. The LLC changes plumbing, not tax.

**Bottom line: entities don't lower your tax while you live in Israel.
Only two things do: (a) deductions/status optimization inside Israel —
which this app already does — or (b) genuinely moving your life.**

"Writing off as much as possible" *is* real and already available to you as
an osek: evaluations, resets, data feeds, platforms, hardware, part of rent
and internet, accountant fees — all deductible against business income, and
your foreign payouts are zero-rated for VAT (s.30(a)(5)) while input VAT on
Israeli purchases comes back. That part of the advisor's instinct is right,
no company required. The Tax page and docs/TAX-ISRAEL.md cover it.

## 2. The framework: residency decides, not paperwork

Tax follows your **tax residency**, and Israeli residency follows your
**center of life** (family, home, belongings, economic ties), helped by day
counts: 183+ days in Israel presumes residency, as does 30+ days in a year
totalling 425 over three years. A 2025 draft reform is moving this toward
conclusive day-count tests (e.g. 75+ days plus 183 weighted days over three
years ⇒ resident). Until your center of life actually moves — home leased
abroad, days out of Israel, ties re-anchored — Israel taxes your worldwide
income, whatever passports, visas or companies you collect.

Practical exit checklist (what advisors actually have you do):
- Establish the new home *before or at* departure (lease/buy, utilities).
- Keep Israel visits low — ideally <30 days/yr in the first two years,
  never near 183.
- File the residency-departure position; expect the year of departure to be
  a split/argued year. Consider National Insurance continuation payments so
  health coverage doesn't lapse if you might return.
- Close or adapt the osek (VAT deregistration), final return with the
  departure date documented.
- The s.100A exit tax taxes *appreciated assets* on departure — a service
  trader with no big asset positions usually has little exposure, but list
  everything (crypto, stocks) with the advisor.

Also worth knowing for later: if you ever come back after 6+ years abroad,
returning-resident benefits give years of exemption on foreign income.

## 3. Baseline: what Israel costs you today

At ~$100k/yr of payouts (≈ ₪370k), osek murshe, single with base credit
points, before deductions: income tax ≈ ₪75k after credits, plus
self-employed National Insurance + health ≈ ₪50–57k (partly deductible) —
roughly **30–33% all-in**, falling meaningfully once real expenses are
deducted. At ₪150k/yr of payouts the effective rate is far lower (~12–18%)
because the low brackets and credit points do the work — which is why
relocation only starts paying at real income. VAT: zero-rated exports either
way. The app's Tax page computes your actual number.

## 4. Country cards

Every "effective rate" below is a rough all-in (income tax + social) on
~$100k of prop payouts as self-employment-type income, before special
deductions, using 2026 rules.

### 🇨🇾 Cyprus — the standard European answer
- **Residency**: 183 days, or the **60-day rule** (60+ days in Cyprus, a
  permanent home there, business/employment ties, <183 days in any other
  single country; from 2026 you no longer must prove non-residency
  elsewhere).
- **Non-dom status**: 17 years of exemption from the Special Defence
  Contribution ⇒ **0% tax on dividends** (only GESY health at 2.65%,
  capped).
- **The setup**: Cyprus Ltd earns the payouts → corporate tax (12.5%,
  **rising to 15% under the 2026 reform**) → pay yourself a small salary +
  the rest as dividends. All-in effective on €100k ≈ **15–20%**. Straight
  self-employment instead: 0% band to €19.5k then 20–35%, plus 16.6% social
  and 4% GESY ⇒ ~25–30%, so the company earns its fees above ~€50k income.
- **Trader notes**: profits from trading in *securities* are tax-exempt in
  Cyprus, but prop payouts are service/business income, not securities
  gains — plan on the company route. EU banking, English-speaking
  professionals everywhere, 300+ days of sun, 4h flight to Israel.
- **Costs/frictions**: company setup + annual accounting/audit (~€2–4k/yr),
  real substance expected (office/home, resident director helps).

### 🇬🇷 Greece — half your tax off for 7 years
- **Article 5C inbound regime**: move tax residency to Greece to work or
  run a business ⇒ **50% of employment/self-employment income exempt for 7
  years**. A freelancer physically working from Greece for foreign clients
  qualifies (the work is Greek-sourced, which is exactly what the regime
  wants).
- Standard rates 9–44% + EFKA social ⇒ with the exemption, effective on
  €100k lands around **15–20%**.
- The €100k lump-sum non-dom (5A) needs a €500k investment — not for you.
- **Gotchas**: lose the regime if you stop the activity >12 months;
  bureaucracy is real; social contributions still due in full.

### 🇦🇪 Dubai / UAE — the 0%, if you actually live there
- **0% personal income tax.** For a sole trader/freelancer: corporate tax
  is 9% only on profit above AED 375k (~$102k), and **Small Business
  Relief elects 0% up to AED 3M revenue through end-2026** (watch for its
  extension). A qualifying free-zone company can keep 0% beyond that.
- Freelance permit + residency visa from ~AED 8.5k (~$2.3k) for two years;
  processing ~10 days. Maintain residency with periodic presence (and be
  actually resident there if Israel is to release you — a visa alone moves
  nothing).
- Israel–UAE tax treaty exists (2021) and thousands of Israeli traders
  have made exactly this move; flights are short.
- **Gotchas**: high cost of living (rent can eat the tax saving at modest
  income), summer climate, and the whole plan fails if your center of life
  stays in Israel while you hold a Dubai visa.

### 🇧🇬 Bulgaria — the quiet EU workhorse
- **10% flat tax** on everything (self-employment, capital gains,
  dividends 5%), no brackets, no special regime to qualify for or lose.
  Social contributions are capped at a modest insurable maximum ⇒ all-in on
  $100k ≈ **12–15%**.
- EU member, low cost of living, 183-day (or center-of-life) residency.
- **Gotchas**: less English in the bureaucracy, less glamour; but for a
  freelancer profile most 2026 comparisons rank it the cleanest EU answer.

### 🇬🇪 Georgia (country) — 1% if it fits, with a caveat that matters
- **Small Business Status**: individual entrepreneurs pay **1% of
  turnover** up to 500k GEL (~$180k). Foreign clients fine; register in a
  day; 365-day visa-free stay for Israelis.
- **The caveat**: SBS *excludes* certain activities including some
  trading/financial activities. Whether prop-firm payouts (a fee-for-
  service split from a foreign firm) qualify as eligible service turnover
  or excluded trading income is exactly the question a Georgian accountant
  must answer in writing before you rely on this. Get it wrong and you're
  at 20%.
- Not EU; banking and geopolitical risk are real considerations.

### 🇲🇹 Malta — good headline, wrong shape for you
- Non-dom remittance basis: foreign income kept offshore is untaxed.
  **But income from work physically performed while sitting in Malta is
  Malta-source** — a trader trading from Malta can't call the payouts
  foreign income. The famous structures need two companies and real fees.
  Skip unless an advisor shows you a working trader-specific setup.

### 🇦🇩 Andorra — 10% cap, tiny and real
- Personal income tax capped at **10%**, healthy banking, between France
  and Spain. Active residency requires forming a local company or
  employment plus real presence (90/183-day flavors) and a government
  deposit. Works, but it's a small mountain country — lifestyle decision
  first, tax second.

### 🇮🇹 Italy — decent, not a headline
- Impatriati regime (2024 version): **50% of employment/self-employment
  income exempt** for 5 years (cap €600k), requires prior non-residency
  and commitment to stay. Effective on €100k ≈ **18–24%** incl. social.
  The €200k lump-sum non-dom is for the very rich. Spain's Beckham law is
  employment-only — wrong shape for a self-employed trader.

### 🇵🇹 Portugal — the door closed
- Old NHR ended for new applicants (final transition window closed March
  2025). Its replacement (IFICI, "NHR 2.0") is narrow — tech/research
  roles, not traders. Standard Portuguese rates are high. No longer a
  trader destination.

### 🇹🇭 Thailand — livable, gray for a working trader
- Tax resident at **180 days**/calendar year. Since 2024, foreign-source
  income **remitted to Thailand** is taxable (progressive to 35%); pre-2024
  savings remit tax-free with evidence. The DTV (nomad visa, ~5 years,
  180+180 days per entry) explicitly *permits* remote work but does not
  exempt tax.
- **The gray zone**: income from work physically performed in Thailand is
  arguably Thai-source (taxable regardless of remittance). Enforcement on
  nomads has been thin, but building a life on non-enforcement is not a
  plan. The LTR visa's remote-worker track carries a statutory foreign-
  income exemption (Royal Decree 743) but requires a $80k income history
  and an established employer — prop traders rarely fit.
- Stay under 180 days/yr and it's simply a place you visit, tax-free —
  but then you haven't left Israel either (see §2).

### 🇨🇷 Costa Rica — genuinely territorial
- **Territorial system**: only Costa-Rican-source income is taxed, and the
  digital-nomad framework explicitly exempts foreign-earned income even
  past 183 days. Requirements: ~$3k/month income proof, insurance.
- **Gotchas**: far from Israel and from CME hours (trading NY open =
  morning, actually pleasant); banking and bureaucracy are slow; the
  "services performed in CR" theory exists here too but the nomad regime
  explicitly answers it, which is why CR is cleaner than Thailand.

## 5. Comparison at a glance (~$100k prop income, 2026)

| Destination | Effective all-in | Min. presence | Complexity | The catch |
| --- | --- | --- | --- | --- |
| **Israel (stay, optimized)** | ~25–33% | — | none — app does it | The rate itself |
| **UAE (Dubai)** | **~0–3%** | be resident in fact | Low-mid | Cost of living; must truly relocate |
| **Georgia (SBS 1%)** | **~1–5%** | 183d for residency | Low | Activity eligibility must be confirmed |
| **Bulgaria** | ~12–15% | 183d / center of life | Low | Unglamorous |
| **Cyprus (Ltd + non-dom)** | ~15–20% | **60 days** + home | Mid | Company upkeep; CIT now 15% |
| **Greece (5C)** | ~15–20% | resident, 7-yr regime | Mid | Social contributions; bureaucracy |
| **Italy (impatriati)** | ~18–24% | resident, 5 yrs | Mid | Must commit to stay |
| **Costa Rica (nomad)** | ~0% + IL? | visa terms | Low | Distance; only works if Israel released you |
| **Thailand** | 0–35% (remit) | <180d or resident | Low | Gray zone on locally-performed work |
| **Andorra** | ~10% | 90–183d + company | Mid | Tiny; deposit; lifestyle |
| **Malta** | n/a for traders | — | High | Work done in Malta isn't "foreign income" |
| **Portugal** | high | — | — | NHR closed |

**The two-step that actually matters**: none of these numbers exist for you
until Israel lets go. A Dubai visa + 200 days on Rothschild Boulevard = you
still pay Israel. The order is: pick the life you want → move it for real →
then the destination's regime applies.

## 6. Recommendations by scenario

1. **Staying in Israel (now, at your current scale)** — entity games gain
   nothing; osek patur/murshe choice + logging every deductible expense +
   VAT zero-rating is the whole optimization, and the app computes it.
   Revisit relocation when payouts are consistently >$70–100k/yr — below
   that, Israel's low brackets + credit points mean the saving doesn't
   cover the cost of moving your life.
2. **"I want to travel soon" (months, not moving)** — you remain Israeli-
   taxed everywhere; nothing changes except keeping receipts. Stay under
   other countries' residency triggers (180d Thailand, 183d most others).
   Travel costs with a business purpose are partly deductible — log them.
3. **Actually relocating, EU + close to home** — **Cyprus** is the default
   (60-day rule, non-dom dividends, English, 4h away); **Greece 5C** if
   you want to live there; **Bulgaria** if you want simplicity over scene.
4. **Actually relocating, maximum savings** — **Dubai** (0%, Israeli
   community, treaty) if the income justifies the cost of living;
   **Georgia** as the budget extreme *if* a local accountant confirms SBS
   eligibility for prop payouts in writing.
5. **Lifestyle-first** — **Costa Rica** is the cleanest genuinely-
   territorial option; Thailand only with the remittance rules respected
   and eyes open about the gray zone.
6. **Whatever you do** — before moving: one session with an Israeli
   international-tax advisor (exit mechanics, NI continuation, departure
   year), one with a local advisor in the destination. Bring them §2's
   checklist. The fees are hundreds; the mistakes are five figures.

---

*Compiled August 2026 from: IRS/S-corp shareholder rules (IRC §1361), PwC
Worldwide Tax Summaries (Israel corporate residence & CFC), Herzog/ITA
guidance on management-and-control and the 2025 residency draft bill, KPMG
Cyprus 2026 tax-residency note and the Cyprus 2026 tax reform, Greek 5A/5C
regime guides, Thai Revenue Department remittance guidance (2024 change) and
Royal Decree 743, Costa Rica digital-nomad framework, UAE Corporate Tax law
incl. Small Business Relief, Bulgarian PITA Art. 48, Georgian SBS rules,
Maltese remittance basis, Andorran and Italian regimes, and Portugal's
IFICI. Rates rot: re-verify before acting. This document is information,
not tax advice.*
