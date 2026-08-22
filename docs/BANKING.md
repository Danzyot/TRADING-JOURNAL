# Getting paid — rails, accounts and what receiving costs

Researched August 2026. Published-terms summaries, not advice; fintech pricing
moves faster than tax law, so re-check before acting on a number here.

## The short version

1. **Wise** is the best place to *receive* USD payouts. It is the only one of
   these that gives real local USD details (ACH routing + account number), so a
   US firm pays domestically instead of sending an international wire, and it
   converts near the mid-market rate for a stated fee from about 0.41%.
   Topstep pays Wise directly.
2. **Revolut** is the better card and day-to-day account, but its local details
   are mainly GBP and EUR, so USD payouts usually arrive as international
   transfers. Reasonable as the spending half of a pair.
3. **The Israeli bank** costs roughly 1.5–2.5% on conversion plus $10–25 per
   incoming wire. Keep it for shekel life and for the accountant; it is the
   most expensive way to convert a payout.
4. **Stablecoin (USDC/USDT)** is the fastest rail and the only reason
   "daily payouts" are actually daily. Off-ramping costs an exchange spread,
   and Israeli banks ask for a paper trail on crypto-sourced deposits.

On $60,000 of payouts a year, the gap between a 2% bank conversion and a 0.5%
specialist is about **$900 a year**, every year. That is the saving that is
actually available, and it is real.

## How each firm pays

| Firm | Processor | Methods | Speed |
|---|---|---|---|
| Apex Trader Funding | Deel | Bank transfer, crypto in some regions | 5–10 business days, bi-weekly windows |
| Topstep | Direct | ACH, Wise, wire | 1–3 business days |
| Lucid Trading | Rise | USDC/USDT, bank | Minutes on crypto, 2–5 days on bank |
| MyFundedFutures | Rise + direct crypto | USDC/USDT, bank | Minutes to 3 days |
| Take Profit Trader | Rise | USDC/USDT, bank | Same day to 3 days |
| FundedNext | Rise | Crypto, bank | 1–3 business days |
| Alpha Futures | Rise | Crypto, bank | 1–5 business days |

## What a foreign account does not do

It does not change what you owe, and it is not invisible. Both points matter
before building a payout routine around one.

**Residence, not the bank, decides the tax.** Israel taxes residents on
worldwide income. Residence is the centre-of-life test — family, home, economic
and social ties — with a statutory presumption of Israeli residence at 30 days
in a tax year and 425 days across that year and the two before it. A second
passport does not change residence while you live in Israel. Only actually
moving does, which is what [TAX-RELOCATION.md](TAX-RELOCATION.md) is for.

**Fintech balances are reported.** CRS is the OECD's automatic exchange of
account information, and Israel both sends and receives under it. From
1 January 2026, CRS 2.0 widened the definition of a reportable "depository
account" to cover **e-money and digital wallets** — which is to say Wise and
Revolut balances are exchanged with your country of tax residence exactly like
a bank account. Both providers ask you to self-certify that residence; certifying
a country you do not live in is a false declaration, not a loophole.

So the plan of routing payouts to an EU account in order to keep them out of
sight does not work on its own terms: the account reports to wherever you
certify, an Israeli resident owes Israeli tax on the income either way, and the
gap between the two is the part that carries penalties.

**What is genuinely worth optimising**, in rough order of size:

1. Where you live, if the numbers justify moving — see the relocation table.
2. Deductions you are entitled to and do not claim — see the Tax page checklist.
3. The FX spread on every payout — the ~$900/yr above.
4. The rail each firm pays on, for speed rather than cost.
5. The timing of a payout across a tax year boundary.

## Sources

- CRS 2.0 scope, in force 1 January 2026, covering e-money and digital wallets —
  [Azola Legal](https://azolalegal.com/en/blog/poshyreni-mify-shhodo-crs-ta-shho-ochikuvaty-u-2026-rotsi/),
  [tax-wizard.eu on Revolut and CRS](https://tax-wizard.eu/en/p/does-revolut-report-to-tax-authorities)
- Revolut's own CRS/tax-residency identification —
  [Revolut Help](https://help.revolut.com/help/wealth/investor-related-tax-information/)
- Israel's AEOI/CRS reporting portal and guidance —
  [KPMG note](https://assets.kpmg.com/content/dam/kpmg/us/pdf/2023/06/tnf-israel-june28-2023.pdf),
  [HSBC Israel CRS](https://www.crs.hsbc.com/en/cmb/israel)
- Israeli residence (centre of life, 30/425-day presumption) and worldwide
  taxation — [PwC Worldwide Tax Summaries](https://taxsummaries.pwc.com/israel/individual/residence)
- 2026 removal of the reporting exemption for new immigrants and returning
  residents — [AACI](https://aaci.org.il/new-disclosure-rules-for-olim-and-returning-israelis-effective-1-1-2026/)
- Wise vs Revolut: local account details, currencies and fee shape —
  [Wise comparison](https://wise.com/us/blog/revolut-vs-wise),
  [Digital.Finance](https://digital.finance/guides/wise-vs-revolut)
- Prop-firm payout processors and speeds —
  [PropScope payout methods](https://propscope.net/en/payout-methods/),
  [track360 on prop payment processing](https://track360.io/blog/prop-firm-payment-processing-and-trader-payouts-2026)
