# What to do with payout money

The app implements this as an allocation waterfall (Money → *Payout allocation
plan*). This document is the reasoning behind the defaults, so you can change
them deliberately rather than by feel.

---

## The core problem

A payout does not behave like a salary, and treating it like one is how
profitable traders end up broke.

**Part of it was never yours.** No tax is withheld. The tax authority is
letting you hold their share for a while, and the bill arrives months later as
one number.

**Part of it is inventory.** Evaluation fees, resets, data and platform costs
are the cost of goods sold in this business. Spend them and you stop being able
to hold funded accounts.

**And it does not compound.** A payout produces nothing while you sleep. It
stops entirely the day you stop trading well, or the day the firm changes its
rules, or the day you get ill. Trading income is a high-yield, high-variance,
zero-duration asset — the opposite of what it feels like.

What is left after the first two claims is the only part that is genuinely a
reward, and it is much smaller than the number on the wire.

---

## The default waterfall

Buckets fill **in order**. Each stops at its cap, and the overflow cascades to
the next one down — so a full emergency fund quietly becomes more investing
rather than sitting idle, and the tax reserve at the top never absorbs spare
cash it was not sized for.

### 1 — Tax reserve · 30%, no cap

Not savings. Money that already belongs to the tax authority.

Move it to a **separate account** on the day the payout lands. A reserve that
lives in your current account is not a reserve; it is a number you will
rationalise spending.

The app computes the right rate from your actual marginal position rather than
using a flat 30% — see the Tax page. Under-reserving is far more painful than
over-reserving, because the shortfall surfaces long after the money is gone.

### 2 — Operating float · 20%, capped around six months of running costs

Evaluations, resets, data feeds, platforms, the copier.

**Why it is second, above your own emergency fund:** running out of evaluation
capital is the most common way a working trader stops working. A run of three
failed evaluations is statistically ordinary and costs several hundred dollars;
if that money is not there, you are out of the game at exactly the moment your
statistics say to keep going.

Cap it, though. Beyond about six months of burn this is idle cash.

### 3 — Emergency fund · 15%, capped at six months of personal living costs

Cash or a money-market fund. Never touched for trading. Ever.

**This is a risk-management tool, not a savings goal.** A trader who needs the
next payout makes bad decisions — sizes up to make it back, holds a loser
because closing it makes the month real, trades a setup that is not there
because flat feels like failure. Six months of runway is what lets you take a
bad quarter calmly, and calm is worth more in this job than any edge you can
find.

At 21 with low fixed costs, this is cheaper to build now than it will ever be
again.

### 4 — Long-term investing · 20%, no cap

A broad, low-cost index fund. Bought on a fixed schedule. Not sold.

This is the bucket that converts a good few years into lasting capital. Keep it
**completely separate from trading capital** — a separate broker, ideally — so
it is never available to top up a drawdown, and so a bad trading month cannot
touch it.

Do not time it. The discipline of the schedule is doing more work here than the
choice of fund.

### 5 — Personal · 15%, no cap

Living costs and the part you actually enjoy.

Deliberately budgeted rather than "whatever is left". A payout structure that
funds no life at all is not sustainable either, and the version of this plan
people abandon in month three is the one with nothing in this bucket.

---

## When to add more accounts

The app computes this on the Accounts page as **cost per funded account** and
**return on spend**, per firm.

The arithmetic:

```
cost per funded account = evaluation cost ÷ pass rate
```

At a 35% pass rate and a $150 evaluation, each funded account costs about $430
in fees to obtain. If a funded account has produced $2,000 in payouts over a
year, that is a ~4.6x return — better than anything you could buy in a market.

**Scale while that ratio holds and your reserves are full.** Add accounts one at
a time and re-check, because the ratio falls as soon as managing more accounts
starts degrading your execution. More accounts is only leverage on an edge that
already exists.

**Stop when the ratio drops below about 1.5x.** That is not a scaling problem,
it is a consistency problem, and buying more evaluations at that ratio just
loses money faster.

**Never scale before the reserves are full.** Securing the downside outranks
scaling the upside, because a trader who runs out of runway stops being a
trader, and no amount of expected value fixes that.

---

## Priority order when something has to give

The app's advice engine walks this list and tells you where you actually are:

1. **Tax reserve short** → fix immediately. Nothing else matters.
2. **Emergency fund under six months** → fill it before anything discretionary.
3. **Operating float under four months of burn** → top it up.
4. **Evaluation return below 1.5x** → stop adding accounts, fix consistency.
5. **All reserves full, return above 3x** → scale accounts.
6. **All reserves full, scaling saturated** → invest the surplus.

---

## Things worth doing at 21 specifically

**Your time horizon is the asset.** Money invested now has forty years to
compound; money invested at 40 has twenty. The investing bucket matters more for
you than it will for anyone older reading the same advice.

**Keep prop trading and personal investing legally separate.** Separate
accounts, separate records. This matters for the Israeli classification question
(see `TAX-ISRAEL.md` §1) — you do not want an argument about your trading
frequency contaminating the treatment of your long-term portfolio.

**Build the paper trail now.** Registering properly, keeping receipts and
reserving tax from the first payout costs almost nothing while the numbers are
small. Reconstructing three years of it later, under audit, is expensive and
unpleasant.

**Do not confuse income with wealth.** A good month is a good month. It is not
a new baseline, and it is not permission to raise your fixed costs — fixed costs
are the thing that turns a variable-income drawdown into a crisis.
