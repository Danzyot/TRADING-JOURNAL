# Getting paid, holding it, spending it

Researched August 2026. Published-terms summaries, not advice; fintech pricing
moves faster than tax law, so re-check before acting on a number here.

This assumes the move to Cyprus has actually happened — see
[TAX-RELOCATION.md](TAX-RELOCATION.md). Where money sits never changes what is
owed on it; where you live does. What the structure below decides is how much
of each payout survives the trip.

## Four layers

Each guards against a different failure, which is why one account cannot do the
job. A payout arriving is an FX problem. Money you spend is an availability
problem — a frozen card on a Tuesday. Money you keep is a protection problem,
where the deposit guarantee is the only thing that matters. Past the guarantee
it stops being a banking question.

| Layer | Account | Holds | Guards against |
|---|---|---|---|
| 1 · Inbound and FX | **Wise** | Transit only, days not months | Correspondent banks skimming a wire, and converting at whatever rate applies the moment money lands. Real USD details make a payout a domestic-style transfer; conversion is 0.33–0.57% when *you* choose. No deposit guarantee — survivable only because nothing stays. |
| 2 · Daily spending | **Revolut** | One to two months of costs | A freeze taking your net worth with it. Capping the balance turns that into an inconvenience. Spending EUR from a EUR balance never touches the €1,000/month conversion allowance. |
| 3 · Reserve | **bunq** | Everything else, to €100,000 | Everything. Full Dutch banking licence, €100,000 DGS cover on the free plan. No payment traffic runs through it — nothing that triggers a compliance review. |
| 4 · Above the guarantee | **Interactive Brokers** | Past €100,000 | The €100k per-bank cap. Segregated client assets, and cash in a EUR overnight-rate ETF earns roughly the ECB rate. Only relevant well into six figures. |

Keep a bunq debit card with €1–2k on it somewhere other than your wallet. That
is the third rail when Revolut locks and your wallet is gone.

## The rails

The firm picks the processor; you pick the exit. That distinction is worth more
than the difference between a 90% and an 85% split — 90% paying through PayPal
is worse than 85% through Rise on stablecoin.

Costs on a $2,000 payout:

| Rail | Cost | Speed |
|---|---|---|
| Rise → USDC → exchange → EUR | ~$6 | Minutes |
| Firm → Wise directly (USD) | ~$10 | 1–3 days |
| Rise → USD → Wise → EUR | ~$30 | T+1 to T+4 |
| Rise → EUR bank | ~$33 | T+1 |
| WorkMarket → PayPal | ~$70 | 1–3 days |

Two crossovers worth knowing, both encoded in the tests:

- **Below roughly $670**, direct-to-Wise beats stablecoin — a flat fee costs
  more than a percentage on a small payout. Above it, stablecoin wins and keeps
  winning, because its only variable cost is a small exchange spread rather
  than a 1.15% FX margin.
- **On a $500 payout, PayPal is cheaper than Rise's $20 USD leg.** Flat fees
  bite hardest at the bottom. It is still the worst rail at any size worth
  collecting.

Rise's country appendix lists EUR withdrawals for France, Germany, Italy,
Netherlands, Poland, Romania and Spain — Cyprus is not among them, and
unlisted countries default to the $20 USD withdrawal. Check the dashboard
rather than assuming EUR-direct exists.

**WorkMarket** is ADP's US-contractor system; its bank leg expects a US bank
tied to a US tax identity, and non-US people get pushed to PayPal at 3–4% FX.
Where a firm offers only WorkMarket or crypto — Lucid, for instance — take the
crypto. If you want to test whether Wise's USD details pass ADP's checks, test
with a small payout, never a large one.

**Do not park in Rise Earn.** It is yield on USDC through Aave: smart-contract
and depeg risk on money meant to be in transit for 48 hours. A couple of
percent annualised on a three-day float is worth nothing against that tail.

## Rules that pay for themselves

| Rule | Why |
|---|---|
| Convert USD → EUR only at Wise | Revolut's free allowance is €1,000/month, then 1%. One payout blows through it. |
| Never convert Friday evening to Sunday evening | 1% weekend markup on Revolut Standard. Waiting costs nothing. |
| Always choose EUR at a terminal or ATM | Dynamic currency conversion skims 3–8% — the biggest avoidable cost while travelling. |
| Batch ATM withdrawals | Wise free to €250/month then 1.75%; Revolut Standard free to €200. |
| Stay on free plans | Nothing here needs a paid tier. |
| Don't spend abroad on bunq | Free plan covers €1,000/year of foreign-currency card spend, then 3%. |

## Setting it up without getting frozen

- **Open everything before you move**, using your current address, then update
  in-app. A new account receiving a large first payout from an unfamiliar
  sender is the textbook freeze trigger — season each with small, ordinary
  transactions first.
- **The Polish passport is the KYC key.** An EEA identity document avoids the
  residence-permit friction non-EU citizens hit; onboarding is minutes.
- **Skip a Cypriot bank for a short stay** — it needs you present with a Yellow
  Slip and takes four to eight weeks.
- **Do not change your address of record on every move.** Changing registered
  country re-triggers KYC at every provider simultaneously, which is how people
  get locked out of everything at once.
- **Keep the evidence folder ready.** Payout confirmations, statements and ID,
  reachable from your phone — the Documents page in this app is that folder.
  Answering a source-of-funds request within the hour is the difference between
  a two-day hold and a three-week one.
- **Every crypto leg is a disposal.** USDC → EUR is a near-zero gain but still
  a transaction to record — and that record is also what answers the
  compliance request.

## What a foreign account does not do

It does not change what you owe, and it is not invisible. Israel — or any
country you are resident in — taxes worldwide income, and since 1 January 2026
CRS 2.0 explicitly covers e-money and digital wallets, so Wise and Revolut
balances are exchanged with your country of tax residence exactly like a bank
account. Both ask you to self-certify that residence; certifying a country you
do not live in is a false declaration, not a loophole. Relocation is the thing
that changes the tax — the account structure only changes the fees.

## Sources

- Wise / Revolut pricing and allowances — [Wise comparison](https://wise.com/us/blog/revolut-vs-wise), [Revolut fees](https://www.revolut.com)
- bunq licence and DGS cover — [bunq](https://www.bunq.com)
- Rise withdrawal methods, fees and country appendix — [Rise](https://www.riseworks.io)
- Prop-firm payout processors — [PropScope](https://propscope.net/en/payout-methods/)
- CRS 2.0 scope from 1 January 2026 — [Azola Legal](https://azolalegal.com/en/blog/poshyreni-mify-shhodo-crs-ta-shho-ochikuvaty-u-2026-rotsi/)
- Israeli residence and worldwide taxation — [PwC](https://taxsummaries.pwc.com/israel/individual/residence)
