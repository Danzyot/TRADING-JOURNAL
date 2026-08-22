# Documents

Payout confirmations, account statements and ID scans, kept where you can find
them in a hurry. A bank asking for source of funds is a *when*, not an *if*,
and answering the same hour with the paperwork attached is the difference
between a two-day hold and a three-week one.

Add them on the **Documents** page. Tag each with what it is, which firm and
account it belongs to, and the date on the document itself (rarely the day you
uploaded it).

## How they are protected

- **Encrypted before they reach the database**, AES-256-GCM with a random IV
  per file, keyed by `ENCRYPTION_KEY` — which lives in the environment and
  never in the database. A leaked database dump is ciphertext.
- **GCM is authenticated**, so a tampered or truncated blob fails loudly rather
  than returning wrong bytes.
- **No public URLs.** Files are served only by `/api/documents/[id]`, which
  re-checks the session itself rather than trusting the middleware alone, and
  sets `private, no-store` so no CDN or browser disk cache keeps a copy.
- **Never written to disk.** The app runs on serverless functions with no
  persistent filesystem; the bytes exist in memory for one request.
- **Not cached by the service worker** — it caches only static assets.

## What this does not protect against

Worth being straight about, because "encrypted" gets used to mean more than it
does:

- **Anyone with your login has your documents.** The encryption defends against
  a database leak, not against a stolen session. Use a long `APP_PASSWORD`.
- **Your own devices.** A downloaded file is an ordinary file in your Downloads
  folder afterwards.
- **The environment key.** Anyone who can read `ENCRYPTION_KEY` in Vercel can
  decrypt everything. Rotating it makes existing documents unreadable — there
  is no re-encryption path, by design, because that would mean holding both
  keys at once.
- **Keep ID scans only while you need them.** The safest copy of a passport
  scan is the one that was deleted after the verification finished.

## Limits

4 MB per file — Vercel caps a request body at 4.5 MB. Phone photos of documents
land well under it; a long statement PDF occasionally does not, and the upload
says so rather than failing at the platform edge. Split it, or photograph the
pages you actually need.

Storage counts against your Postgres allowance (0.5 GB on Neon's free plan),
and encrypted blobs are the file plus 28 bytes. A few hundred documents is
nothing; a year of scanned statements is worth watching.
