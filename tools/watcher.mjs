#!/usr/bin/env node
/**
 * Local trade watcher.
 *
 * Runs all day on the trading machine and keeps the journal current two ways:
 *
 * 1. **Folder watch** — any .csv that lands in the watched folder is uploaded
 *    to the journal's import endpoint. Files inside a subfolder go to the
 *    account named like that subfolder (label or broker id); files in the
 *    root go to --account. Uploads are idempotent server-side, so the same
 *    file arriving twice never double-imports.
 *
 * 2. **Sync pump** — every few minutes it triggers the journal's broker sync
 *    (Tradovate), which the hosted cron can only run once a day on the free
 *    plan. With the pump running, synced trades appear minutes after you
 *    take them, not the next day.
 *
 * Zero dependencies — plain Node 18+. Usage:
 *
 *   node tools/watcher.mjs --url https://your-app.vercel.app \
 *     --token <CRON_SECRET> --dir "C:\trading\exports" --account "Apex 50k #1"
 *
 * Or via env: JOURNAL_URL, JOURNAL_TOKEN, WATCH_DIR, DEFAULT_ACCOUNT,
 * SYNC_MINUTES (0 disables the pump), SCAN_SECONDS.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ---------------------------------------------------------------------------
// Config

function arg(flag, envName, fallback = '') {
  const index = process.argv.indexOf(`--${flag}`)
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]
  return process.env[envName] ?? fallback
}

const URL_BASE = arg('url', 'JOURNAL_URL').replace(/\/+$/, '')
const TOKEN = arg('token', 'JOURNAL_TOKEN')
const WATCH_DIR = path.resolve(arg('dir', 'WATCH_DIR', './exports'))
const DEFAULT_ACCOUNT = arg('account', 'DEFAULT_ACCOUNT')
const SYNC_MINUTES = Number(arg('sync-minutes', 'SYNC_MINUTES', '5'))
const SCAN_SECONDS = Math.max(2, Number(arg('scan-seconds', 'SCAN_SECONDS', '5')))

if (!URL_BASE || !TOKEN) {
  console.error('Missing --url / JOURNAL_URL or --token / JOURNAL_TOKEN.')
  console.error('The token is the CRON_SECRET you set on Vercel.')
  process.exit(1)
}

const STATE_FILE = path.join(WATCH_DIR, '.journal-watcher.json')
const log = (...parts) => console.log(new Date().toLocaleTimeString(), '·', ...parts)

// ---------------------------------------------------------------------------
// State: what we have already uploaded, so restarts do not re-send everything.
// (Re-sending would be harmless — the server dedupes — just noisy and slow.)

let state = {}
try {
  if (existsSync(STATE_FILE)) state = JSON.parse(await readFile(STATE_FILE, 'utf8'))
} catch {
  state = {}
}
const saveState = () => writeFile(STATE_FILE, JSON.stringify(state, null, 2)).catch(() => {})

// Files seen on the previous scan: uploaded only once size+mtime hold still
// for a full scan interval, so a half-written export is never sent.
let previousScan = new Map()

// ---------------------------------------------------------------------------

async function listCsvFiles() {
  const out = []
  let entries
  try {
    entries = await readdir(WATCH_DIR, { withFileTypes: true })
  } catch (error) {
    log(`Cannot read ${WATCH_DIR}: ${error.message}`)
    return out
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = path.join(WATCH_DIR, entry.name)
      const subEntries = await readdir(sub, { withFileTypes: true }).catch(() => [])
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.toLowerCase().endsWith('.csv')) {
          out.push({ file: path.join(sub, subEntry.name), account: entry.name })
        }
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      out.push({ file: path.join(WATCH_DIR, entry.name), account: DEFAULT_ACCOUNT })
    }
  }
  return out
}

async function upload(filePath, account) {
  const content = await readFile(filePath)
  const form = new FormData()
  form.set('account', account)
  form.set('file', new Blob([content], { type: 'text/csv' }), path.basename(filePath))

  const response = await fetch(`${URL_BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  })
  const report = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }))
  return { status: response.status, report }
}

async function scan() {
  const found = await listCsvFiles()
  const currentScan = new Map()

  for (const { file, account } of found) {
    let info
    try {
      info = await stat(file)
    } catch {
      continue
    }
    const signature = `${info.size}:${Math.round(info.mtimeMs)}`
    currentScan.set(file, signature)

    const already = state[file]
    if (already?.signature === signature && already.ok) continue
    // Stability gate: only touch files that stopped changing since last scan.
    if (previousScan.get(file) !== signature) continue
    // Failed before and unchanged since: retry once a minute, not every scan.
    if (already?.signature === signature && !already.ok && Date.now() - (already.lastTry ?? 0) < 60_000) continue

    if (!account) {
      if (!already) {
        log(`SKIP ${path.basename(file)} — file is in the root and no --account is set.`)
        state[file] = { signature, ok: false, lastTry: Date.now(), reason: 'no account' }
        await saveState()
      }
      continue
    }

    try {
      log(`Uploading ${path.basename(file)} → ${account}…`)
      const { status, report } = await upload(file, account)
      state[file] = { signature, ok: report.ok === true, lastTry: Date.now() }
      await saveState()
      if (report.ok) log(`  ✓ ${report.message ?? 'imported'}`)
      else log(`  ✗ ${report.error ?? report.message ?? `HTTP ${status}`}`)
    } catch (error) {
      state[file] = { signature, ok: false, lastTry: Date.now() }
      await saveState()
      log(`  ✗ upload failed: ${error.message}`)
    }
  }

  previousScan = currentScan
}

async function pumpSync() {
  try {
    const response = await fetch(`${URL_BASE}/api/cron/sync`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const body = await response.json().catch(() => null)
    if (body?.ok && (body.fillsImported ?? 0) > 0) {
      log(`Sync: ${body.fillsImported} new fills, ${body.tradesRebuilt} trades rebuilt.`)
    } else if (!body?.ok) {
      log(`Sync failed: ${body?.error ?? `HTTP ${response.status}`}`)
    }
  } catch (error) {
    log(`Sync unreachable: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------

log(`Watching ${WATCH_DIR} (every ${SCAN_SECONDS}s) → ${URL_BASE}`)
if (DEFAULT_ACCOUNT) log(`Root files go to "${DEFAULT_ACCOUNT}"; subfolders map to accounts by name.`)
else log('Subfolders map to accounts by name; root files are skipped unless --account is set.')
if (SYNC_MINUTES > 0) log(`Broker sync pump: every ${SYNC_MINUTES} min.`)

await scan()
setInterval(scan, SCAN_SECONDS * 1000)
if (SYNC_MINUTES > 0) {
  await pumpSync()
  setInterval(pumpSync, SYNC_MINUTES * 60 * 1000)
}
