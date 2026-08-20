# Israeli tax for a funded futures trader

**This is research, not advice.** Every figure is a published statutory rate and
every claim is one you can check. But classification questions in Israeli tax
turn on facts about *you*, and getting one wrong is expensive in both
directions — over-paying quietly, or under-paying and finding out with interest
and penalties attached. Take this document to an Israeli accountant and use it
to ask better questions than "how much tax do I pay".

Rates below are for the **2026** tax year and live in
`src/lib/tax/rates.ts` — one file to edit each January.

---

## 1. The classification that changes everything

Most funded traders assume a payout is a capital gain taxed at 25%. It is not.

A capital gain requires an asset that you owned and disposed of. In a prop
arrangement you never owned the capital — the firm did. What you sold them was
a **service**: your trading performance, priced as a share of the profit it
produced. Israel taxes that as **business income** (הכנסה מעסק, section 2(1) of
the Income Tax Ordinance) at marginal rates, with National Insurance on top.

Three consequences follow, and they are not all bad:

**It costs more at the margin.** Marginal income tax reaches 47%, plus a 3%
surtax above ₪721,560, plus National Insurance and health contributions. That is
materially more than 25% once you are earning well.

**But it is taxed on profit, not revenue.** Every genuine business expense comes
off before tax is calculated. A funded trader's cost base is unusually large
relative to revenue — evaluations, resets, data feeds, platforms, copiers,
hardware, a share of internet and workspace. This is the single biggest lever
you have, and it is entirely legitimate.

**And your customers are foreign.** The prop firms are foreign residents buying
a service from Israel. That is an **export of services**, zero-rated for VAT
under section 30(a)(5) of the VAT Law. See §4.

> ⚠️ Separate point worth raising with your accountant: trading *your own*
> money in a personal brokerage account is a different question again, and the
> Tax Authority can reclassify frequent personal trading from capital gains
> (25%) to business income (up to 50%) on a multi-factor test — frequency,
> holding period, financing, expertise, scale. Keep personal investing and prop
> trading clearly separate, in separate accounts, so the argument about one does
> not contaminate the other.

---

## 2. The 2026 numbers

### Income tax bands (annual taxable income, ₪)

| From | To | Rate |
|---|---|---|
| 0 | 84,120 | 10% |
| 84,120 | 120,720 | 14% |
| 120,720 | 228,000 | 20% |
| 228,000 | 301,200 | 31% |
| 301,200 | 560,280 | 35% |
| 560,280 | — | 47% |

Amendment 288 (published 31 March 2026, effective January 2026) widened the 20%
and 31% bands — the 20% band now runs to ₪19,000/month rather than ₪16,150. If
you earn above the old threshold this is worth roughly ₪5,000 a year.

**Surtax (מס יסף):** an additional **3%** on total annual income above
**₪721,560**, taking the top marginal rate to 50%.

### National Insurance and health, self-employed

| Band (monthly) | Combined rate | Split |
|---|---|---|
| Up to ₪7,703 | 7.70% | 4.47% NI + 3.23% health |
| ₪7,704 – ₪51,910 | 18.00% | 12.83% NI + 5.17% health |

- Contributions are charged on a **minimum** of ₪3,442/month even if you earn
  less, and stop entirely above ₪51,910/month (₪622,920/year).
- **52% of the National Insurance component** (not the health component) is
  deductible against taxable income under section 47A. The app applies this.
- Registering as self-employed with Bituach Leumi is a separate step from
  registering with the Tax Authority and VAT. Do all three. Skipping Bituach
  Leumi does not save money — it accrues, and it also means no disability or
  injury cover while you trade.

### Credit points (נקודות זיכוי)

One point is worth **₪2,904/year** (₪242/month). A resident male gets 2.25
points as standard (2.75 for a female).

**If you have completed military or national service**, you are entitled to an
additional credit for **36 months following release** — this is worth real money
at your income level and is one of the most commonly missed entitlements for
someone your age. Set it explicitly in Settings → Tax profile rather than
leaving the 2.25 default.

### VAT

- Standard rate: **18%**
- Osek patur / osek zair turnover ceiling: **₪122,833** (prorated for a part
  year — see §3)

### Company route

- Corporate tax **23%** on profit
- Dividend tax **30%** on distribution to a shareholder holding 10% or more
  (25% below that)

---

## 3. Which status to register

The app computes all four side by side on your actual numbers — Tax → *Which
status keeps the most*. What follows is why the answer often surprises people.

### Osek patur (עוסק פטור)

Below the ₪122,833 ceiling. Charges no VAT, files one annual VAT declaration,
issues receipts rather than tax invoices.

**The catch for you:** an osek patur cannot reclaim input VAT. Every shekel of
Israeli VAT you pay on business purchases is a sunk cost.

### Osek zair (עוסק זעיר) — new in 2026

Same ceiling. Deduct a flat **30% of turnover** as a normative expense instead
of itemising, with no advance payments, a simplified return, and exemption from
the capital declaration.

**When it wins:** your real expenses are below 30% of turnover and you value not
keeping receipts. **When it loses:** your real expenses exceed 30% — which for
an active funded trader running multiple evaluations they often do. The app
compares both and tells you which way round you are.

### Osek murshe (עוסק מורשה)

Charges 18% VAT to Israeli customers, reclaims input VAT, files monthly or
bi-monthly. Mandatory above the ceiling.

**Why this often wins even below the ceiling — the non-obvious part.** Your
customers are foreign prop firms. Under section 30(a)(5) your sales to them are
**zero-rated**: you charge them nothing. But you still reclaim the VAT on your
Israeli purchases. So you get the input-VAT refund with none of the output-VAT
burden.

The honest counterweight: how much Israeli VAT do you actually pay? Apex,
Tradovate, TradingView and CME are all foreign suppliers with no Israeli VAT on
the invoice. Your Israeli VAT-bearing costs are things like internet, phone,
your accountant, locally-bought hardware, and a coworking desk. If that comes to
a few thousand shekels a year, the refund is a few hundred — possibly less than
the extra bookkeeping costs you. **Add up your Israeli-invoiced costs before
deciding**; the app tracks them in the "Israeli VAT paid" field on each expense.

> Also ask your accountant about **reverse-charge VAT on imported services**
> (חשבונית עצמית). An osek murshe buying services from abroad self-invoices the
> VAT and reclaims it in the same return, so it nets to zero — but it is a
> filing obligation, not an optional one.

### Company (חברה בע"מ)

Rarely right at the start. Corporate tax plus dividend tax comes to roughly 46%
if you distribute everything in the same year — no better than being self-employed,
with far more administration and an obligation to pay yourself a market salary.

**It becomes interesting when you stop needing all the money.** Profit retained
inside the company is taxed at 23% and the dividend tax is deferred until you
take it out. If you are earning well beyond your living costs and want to
compound the surplus, that deferral is the entire argument. Below roughly
₪400–500k of profit, it usually is not worth it.

---

## 4. Deductible expenses

The app's defaults are in `src/lib/tax/israel.ts` and reflect customary
treatment, not the most aggressive position available.

| Category | Typical | Notes |
|---|---|---|
| Evaluation fees, resets, activation | 100% | No private use whatsoever. The cleanest deduction you have. |
| Market data (CME, exchange fees) | 100% | Direct input to the work. |
| Platform subscriptions | 100% | TradingView, Tradovate, Tradecopia, NinjaTrader. |
| Broker commissions | 100% | |
| Hardware | 100%, depreciated | Computers are capitalised and written down (commonly 33%/year), not expensed in one go. Your accountant makes the adjustment. |
| Education | 100% | Maintaining or sharpening an existing skill is deductible. Training that creates a *new* qualification generally is not. |
| Internet | ~50% | Business/private split. 50% is the customary starting point. |
| Phone | ~50% | Same. |
| Home office | ~25% | Proportional to floor area used exclusively for work. Be able to point at the room. |
| Accounting, bank and FX fees | 100% | |
| Travel | Case by case | See below. |

**Keep every receipt.** Israeli record-keeping rules require it, and a
deduction you cannot evidence is a deduction you do not have. Photograph
receipts as they arrive; the categories in this app are structured so your
accountant can work straight from an export.

**On travel — read this before you book.** You said you plan to travel. Travel
is deductible only where the *purpose* is genuinely business, and "I traded from
Thailand" is not a business purpose: you would have traded from anywhere. A
conference, a meeting with a firm, or a trip whose reason you could explain to
an assessor with a straight face is different. Mixed trips get apportioned. This
is a well-known audit trigger, so document the reason at the time rather than
reconstructing it later.

---

## 5. Reserving, advances, and the ambush

**No one withholds tax on a prop payout.** The full amount arrives, feels like
yours, and gets spent. The bill arrives months later as a single number.

The app reserves a percentage of every payout automatically (Money → allocation
plan) and computes the rate from your actual marginal position. **Move it to a
separate account on the day the payout lands** — a reserve that lives in your
current account is not a reserve.

**Advance payments (מקדמות)** are set by the Tax Authority from your *last filed
return*, as a percentage of turnover. This produces a specific trap for a first
profitable year: no prior return means no advances, so you pay nothing during
the year and then face the entire liability as one balancing payment — often
alongside newly-set advances for the following year. Two years of tax in one
quarter has ended more trading careers than drawdown has.

If your income drops materially, you can apply to **reduce** your advances
rather than lending the state money interest-free. If it rises, over-reserve.

---

## 6. Travelling, and leaving

You are 21 and planning to travel. Two very different situations:

### Travelling while remaining an Israeli resident

Nothing changes. Israel taxes residents on **worldwide income** regardless of
where you physically are. Trading from Bali for four months does not make the
income foreign, and does not reduce anything. Your obligations continue exactly
as they are.

### Actually ceasing to be a resident

Much harder than leaving, and the rules are tightening.

**The test is "centre of life"** (מרכז החיים) — where your permanent home is,
where your family is, where your economic interests are, where you are
registered and connected. Day counts create *rebuttable presumptions*: 183+ days
in Israel in a year, or 30+ days in the year plus 425 across three years,
presume residency.

**Severing residency requires a sustained pattern**, not a departure: broadly,
183+ days outside Israel in each of the first two years *and* centre of life
outside Israel in the third and fourth. Form 1348 is the declaration.

**The profile the test catches** is exactly the digital nomad's: no clear new
tax home, an apartment or family still in Israel, Israeli bank accounts,
drifting between countries on tourist visas. Ambiguity resolves toward
residency, and you will be arguing the point years later without the
contemporaneous evidence you would have kept had you known.

**Exit tax (section 100A)** deems your assets sold the day before residency
ceases. Payment can be deferred until actual disposal, but the Israeli portion
of the gain is locked in. At 21 with a modest portfolio this may be small —
which is precisely why, if you are seriously going to leave, doing it *before*
you accumulate is cheaper than after.

**A reform is in progress.** A draft bill published July 2025 would replace the
rebuttable presumptions with *conclusive* numerical ones, including residency by
irrebuttable presumption through marital ties to an Israeli partner. If leaving
is a real plan rather than a daydream, get advice before the rules change under
you, not after.

**A practical point people miss:** many prop firms restrict or exclude residents
of particular countries, and your firm's terms are tied to the residency you
declared. Changing where you live can affect which firms will keep you. Check
before you move, not after.

---

## 7. What to actually do

1. **Register** with the Tax Authority, VAT, and Bituach Leumi. All three.
2. **Choose a status** using the comparison on the Tax page, with your real
   Israeli-invoiced costs in front of you.
3. **Set your credit points** correctly, including the discharged-soldier credit
   if it applies.
4. **Reserve on every payout**, into a separate account, the day it lands.
5. **Log every expense** with a receipt. This is the largest legitimate lever
   you have and it costs you nothing but discipline.
6. **Find an accountant who has handled a funded trader.** The classification
   question in §1 is not universally understood, and an accountant who files
   your payouts as capital gains has created a problem, not solved one.

---

## Sources

- Income Tax Ordinance, Amendment 288 (bracket widening, effective January 2026)
- Income Tax Ordinance s.121B (surtax), s.47A (NI deduction), s.100A (exit tax)
- VAT Law s.30(a)(5) and s.30(c) (zero-rating of exported services); Tax
  Authority circular 4/16
- National Insurance Institute, self-employed contribution rates 2026
- VAT Regulations s.13 (professions required to register as osek murshe)
- Israel Tax Authority, osek zair regime (effective 2026)
- Ministry of Finance draft bill on individual tax residency, July 2025
