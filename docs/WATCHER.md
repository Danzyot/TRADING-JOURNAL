# Local trade watcher

A small script that runs on your trading computer all day and keeps the
journal current without you touching the Import page.

It does two things:

1. **Watches a folder for CSV exports.** Any `.csv` that lands there is
   uploaded to the journal automatically. Put a file in a subfolder named
   like an account (its label or broker id) and it imports to that account;
   files in the root go to the `--account` you set. Uploads are idempotent —
   the server skips anything it already has, so re-exports never
   double-import.

2. **Pumps the Tradovate sync.** Vercel's free plan only runs the hosted
   sync once a day. The watcher triggers it every few minutes while your
   computer is on, so synced trades show up minutes after you take them.

What this means per platform:

| Platform | How trades get in |
| --- | --- |
| Tradovate (API connected in Settings) | Automatic — the sync pump pulls fills every few minutes. Nothing to export. |
| Rithmic / R\|Trader Pro | Export orders/fills to the watched folder; the upload happens by itself. |
| Tradecopia | Export its trade log CSV into the watched folder. |
| NinjaTrader | Same — export to the folder (NinjaTrader can be scripted to auto-export). |

Rithmic and Tradecopia have no retail APIs (see INTEGRATIONS.md), so the
export step itself can't be removed — but everything after the export is
automatic.

## Setup (once, ~2 minutes)

You need [Node.js](https://nodejs.org) 18 or newer installed.

1. Download `tools/watcher.mjs` from the repo (or copy it) to your computer,
   e.g. `C:\trading\watcher.mjs`.
2. Make the folder it will watch, e.g. `C:\trading\exports`, with a subfolder
   per account you export for (named exactly like the account's label or
   broker id in the journal).
3. Run it:

```
node C:\trading\watcher.mjs --url https://YOUR-APP.vercel.app --token YOUR_CRON_SECRET --dir C:\trading\exports
```

The token is the `CRON_SECRET` environment variable you set on Vercel
(Settings → Environment Variables). It is what authorizes the upload — do
not share it.

## Start it automatically at logon (Windows)

One line in an elevated Command Prompt:

```
schtasks /Create /TN "Trading journal watcher" /SC ONLOGON /TR "node C:\trading\watcher.mjs --url https://YOUR-APP.vercel.app --token YOUR_CRON_SECRET --dir C:\trading\exports"
```

(macOS/Linux: run it from a login item or a `@reboot` cron line.)

## Options

| Flag | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `--url` | `JOURNAL_URL` | — | Your deployed journal URL |
| `--token` | `JOURNAL_TOKEN` | — | The `CRON_SECRET` value |
| `--dir` | `WATCH_DIR` | `./exports` | Folder to watch |
| `--account` | `DEFAULT_ACCOUNT` | — | Account for files in the folder root |
| `--sync-minutes` | `SYNC_MINUTES` | `5` | Broker sync interval; `0` disables |
| `--scan-seconds` | `SCAN_SECONDS` | `5` | How often the folder is checked |

The watcher keeps a `.journal-watcher.json` state file inside the watched
folder so restarts don't re-upload everything, waits until a file stops
growing before sending it (half-written exports are never uploaded), and
retries failures once a minute.
