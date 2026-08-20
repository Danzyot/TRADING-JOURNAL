# Connecting your platforms

Honest summary first, because this is where most journal tools oversell:

| Platform | Automatic sync? | How this app gets your data |
|---|---|---|
| **Tradovate** | ✅ Yes | REST API — fills, balances, accounts. Needs API credentials from Tradovate. |
| **TradingView** | ⚠️ Partial | Webhook for *intended* stops and targets. Fills come from the broker it routes to. |
| **Rithmic** | ❌ No | CSV export. See below for why. |
| **Tradecopia** | ❌ No | CSV from the broker it copies into. See below. |
| **Any other platform** | ❌ No | CSV import, with alias-based column matching. |

> **Automate the CSV step:** the local watcher (`tools/watcher.mjs`, see
> [WATCHER.md](./WATCHER.md)) runs on your trading computer, uploads any CSV
> you export into a folder, and triggers the Tradovate sync every few minutes
> so synced trades appear near-live instead of once a day.

---

## Tradovate — full automatic sync

The only broker in your stack with a retail-accessible API.

**Getting credentials.** Request API access from Tradovate directly; they issue
an `appId`, `cid` and `sec` alongside your normal username and password. Enter
all five in Settings → Broker connections.

**Before the first sync**, sign in through the Tradovate web platform at least
once. A fresh API login on an account that has never been used interactively
comes back asking for a captcha, which the app surfaces as an error rather than
failing silently.

**What gets pulled:** account list, fills, and cash-balance snapshots. Not
orders and not market data — this app records trading, it does not do any.

**Two things Tradovate does not give you, which the app handles:**

1. *Fills reference a numeric `contractId`, not a symbol.* Resolving those one
   at a time is the difference between a one-second sync and a one-minute one,
   so contract names are cached within a run and across runs.

2. *Fills carry no commission.* This matters more than it sounds. A journal that
   records zero commission will tell you a scalping strategy is profitable when
   it is losing money — at 3 round turns a day on 2 contracts, $1.24 round turn
   is roughly $900 a year. **Set the round-turn rate on each account**
   (Accounts → edit → *Round-turn commission per contract*). The app warns you
   on any account where it is still zero.

**Token handling.** Tradovate penalises repeated password logins, so the access
token is stored (encrypted) and renewed rather than re-authenticating each run.
Tokens last about 80 minutes; the sync renews a couple of minutes early so a
token never expires mid-run.

**Schedule.** `/api/cron/sync` runs every 30 minutes once deployed. It is
idempotent — fills carry Tradovate's own id and the executions table is uniquely
indexed on it, so overlapping windows import nothing twice.

---

## Rithmic — why there is no API here

Rithmic's R|API+ is genuinely powerful, and genuinely not available to you as a
retail trader directly. It is licensed to Rithmic's *professional customers* —
FCMs and platform vendors — under a commercial agreement, and distributed
through brokers like AMP, Optimus, EdgeClear and Ironbeam who charge a monthly
technology fee (typically $20–$125/month plus per-contract routing) on top of
requiring a live futures account with them.

There is also R|Protocol (WebSocket + protobuf, language-independent) and a FIX
4.2 interface, but both sit behind the same licensing.

**For a prop-firm trader this is the wrong shape entirely.** Your Rithmic
accounts belong to the prop firm, not to you — you cannot license an API against
someone else's account, and the firm will not do it for you.

**So: CSV.** In R|Trader Pro, open the Orders or Fills window, right-click the
grid, and export. Import it here against the matching account. The app matches
fills into round trips itself, so a raw fill export is all you need.

Rithmic exports timestamps in **Chicago time** with no offset. The importer
knows this and anchors them correctly — if you are importing a Rithmic-format
file that the detector did not recognise, set the source timezone manually on
the import form.

---

## Tradecopia — import from the broker, not the copier

Tradecopia is a copier: it connects *outward* to NinjaTrader, Tradovate,
Rithmic and TopstepX and places orders through their APIs. It does not expose an
inbound API for its own customers, and its Pro desktop plan runs on your own
machine rather than in the cloud.

So there is nothing to connect to. Import from whichever broker it copied into.

**One thing to get right.** Copied accounts produce near-identical fills across
several accounts. Import each account's fills **against its own account record**
here. If you dump all of them into one account, the matcher sees one account
holding five times the position and the P&L, drawdown and risk figures all
become fiction.

The upside of doing it properly: the per-account view shows you which copies are
actually converting the same signals into money and which are being eaten by a
tighter drawdown rule or a worse commission tier.

---

## TradingView — the webhook, and what it is for

You trade through TradingView with Tradovate connected. Those fills reach this
app through the **Tradovate** sync — do not also import a TradingView export for
the same account, or every trade will be counted twice.

What TradingView knows that the fill feed does not is what you *intended*: the
stop you placed the order with. Without the intended stop there is no
R-multiple, and R is the only way to compare a 1-lot MNQ scalp against a 5-lot
ES swing on equal terms.

**Set it up:**

1. Create an alert on your entry condition.
2. Set the webhook URL to
   `https://your-app.vercel.app/api/webhook/tradingview?token=YOUR_CRON_SECRET`
3. Put JSON in the alert message:

```json
{
  "symbol": "{{ticker}}",
  "action": "entry",
  "side": "long",
  "stop": 21000.25,
  "target": 21080,
  "setup": "ORB retest",
  "account": "Apex 50k #3"
}
```

The webhook **annotates an existing trade rather than creating one** — the
broker fill feed stays the source of truth for what actually happened. It looks
for the most recent trade on that symbol within the last 15 minutes (configurable
via a `window` field). An alert that finds no trade yet is not an error; the
fill often lands seconds afterwards.

Test it from a browser: a `GET` to the same URL with the token returns a
confirmation.

---

## CSV import — how the parser works

The importer resolves columns **by alias**, not by exact header match. `Fill
Time`, `fillTime`, `Timestamp` and `Exec Time` all mean the same thing, so an
export whose headers have drifted still imports. A genuinely unrecognised file
reports which columns it could not place rather than failing opaquely.

Two export shapes are both handled:

- **Fill exports** (one row per execution) go through the FIFO matcher, which
  builds round trips, splits position-flipping fills across two trades and
  apportions commission by quantity.
- **Round-trip exports** (NinjaTrader Trade Performance, Tradovate's paired
  Performance report) already contain entry and exit and are taken as complete
  trades.

**Formats recognised by name:** Tradovate (orders and performance), Rithmic,
NinjaTrader, TradingView. Everything else falls back to generic parsing, which
usually just works.

**Price notation:** decimal prices, plus bond and grain tick notation —
`110'16` reads as 110 + 16/32, `432'2` as 432 + 2/8 cents.

**Money columns:** currency symbols, thousands separators and accounting
parentheses are all handled, so `($1,234.56)` reads as −1234.56.

**Re-importing is safe.** Rows carrying a broker id are deduplicated by the
database; rows without one are matched on their natural key (account, contract,
side, quantity, price, instant). Import the same file twice and the second one
imports nothing.

---

## Where to find each export

| Platform | Path |
|---|---|
| Tradovate | Web platform → Reports → Performance (paired) or Orders (raw fills) → CSV |
| Rithmic R\|Trader Pro | Orders or Fills window → right-click grid → Export |
| NinjaTrader | Control Center → Trade Performance → right-click grid → Export |
| TradingView | Paper Trading or Strategy Tester → List of Trades → Export |

---

## Adding a platform later

`src/lib/integrations/importers/index.ts` holds the alias table. Adding support
for a new export is usually a matter of adding its header spellings to
`ALIASES` — the parsing, matching and costing all work unchanged from there.

For a new broker with a real API, `src/lib/integrations/tradovate.ts` is the
shape to copy: a client that authenticates, lists accounts and returns fills,
plus a sync function that maps them onto `NewExecution` rows and calls
`insertExecutions` and `rebuildTradesForAccount`.
