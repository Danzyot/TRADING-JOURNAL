# Changing what the journal says and shows

Two different things are editable, by two different mechanisms.

## Values — the numbers and records

Every row the app holds can be corrected in place:

| Where | How |
|---|---|
| Payouts, expenses, subscriptions | **Earnings** → the **Edit** button on any row |
| Accounts | **Accounts** → edit a card, or the bulk grid for many at once |
| Firms and their plan catalogues | **Accounts** → the firm's edit form |
| Manual trades | The trade's page → **Correct this trade** |
| Trading models | **Models** → edit the model |
| Journal entries, tax profile, risk rules, settings | Their own forms |

Rows the email automation created are badged **Email** so the ones worth
double-checking are obvious.

The one thing that is not directly editable is a **synced or imported trade**.
Those are rebuilt from the executions table, so an edit would be silently
discarded on the next rebuild; the app refuses and says so. Notes, tags, model
and screenshots on those trades *are* editable — they survive rebuilds by
design. To change the numbers, fix the source (the account's commission rate,
or re-import) and rebuild.

## Words — the interface's own wording

Every page title, standfirst, section heading and description can be rewritten.
Press **✎ Edit text** at the bottom of the sidebar (or in the top bar on a
phone). Editable text picks up a dashed underline; click any of it, type, and
press Save — or Enter. **Clearing the box restores the original wording**, so
there is no separate reset.

Edit mode is off by default and resets when the app is reloaded, so ordinary
use never risks nudging a heading.

### How it works, and one consequence worth knowing

Overrides live in the `site_text` table, keyed by a slug derived from the
default wording itself. That is what makes *every* heading editable without
tagging hundreds of call sites individually — but it has two consequences:

- **The same wording in two places is one entry.** If two cards are both called
  "Notes", renaming one renames both. In practice headings are distinctive
  enough that this rarely comes up, and when it does it is usually what you
  wanted.
- **If a default changes in code, its override is orphaned** and the new
  default shows. That is deliberate: a heading that quietly kept old wording
  after the underlying feature changed would be worse than a visible reset.

An empty `site_text` table is the normal state — absence means "use the
built-in wording", so the app works fine with none, and your rewrites survive
every deploy.
