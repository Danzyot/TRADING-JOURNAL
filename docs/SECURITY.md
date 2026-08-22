# Security

One person's private journal holding payout records, account credentials and
passport scans. The threat model is not a targeted attacker with resources —
it is opportunistic scanning, a leaked database dump, and the ordinary web
failure modes.

## What protects what

| Risk | What stops it |
| --- | --- |
| Anyone reaching a page | Middleware gates everything except the login page, the machine routes and the installable-app files. Private by default: a new route is covered without being added anywhere. |
| Guessing the password | Five attempts per client address, then a lockout that doubles to a thirty-minute cap. Counted in the database, because a serverless process has no memory between requests. |
| A leaked database dump | Broker credentials and every stored document are AES-256-GCM ciphertext. The key is `ENCRYPTION_KEY`, which lives in the environment and never in a row. |
| Script injection | A nonce-based content policy with `strict-dynamic`. No external script origin is trusted, and `object-src`, `frame-src` and `base-uri` are closed. |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY`. |
| A document leaking through a cache | Every file route re-checks the session and sends `private, no-store` plus `nosniff`. Nothing is served from a CDN. |
| A stolen session cookie | `httpOnly`, `secure` in production, `sameSite=lax`, thirty-day expiry, signed with `SESSION_SECRET`. |
| Cross-site request forgery | Every mutation is a Server Action; Next verifies the Origin against the Host. `form-action 'self'` closes the other direction. |
| An open redirect on the login form | `safeRedirectPath` accepts a single leading slash and no backslash, so `//evil.com` cannot pass as a path. |
| Timing out the password | Both sides are hashed before comparison, so the comparison is always the same length and only equality is observable. |

## The content policy

Set in `src/middleware.ts`, on every response including redirects — a login
redirect is still a page a browser renders.

Next stamps its own inline scripts with a nonce, but only when it can find one:
it parses the policy off the **request** headers, so the same policy is set on
both the request and the response. An inline script the app adds itself needs
the nonce passed explicitly — `src/app/layout.tsx` reads `x-nonce` for the
theme script, which runs before paint to stop a dark-mode user seeing a white
flash. Blocked, that script would not error; it would silently stop working.

`style-src` keeps `'unsafe-inline'`: Next inlines critical CSS and the
components set colours through style attributes. Scripts are where injection
actually matters, and those are locked down.

## Login throttling

`src/lib/auth-throttle.ts` is pure and tested; `src/server/auth-guard.ts`
persists the counter.

Deliberately per address rather than global. One shared counter would let
anybody on the internet lock the owner out of his own accounts page by failing
to sign in a few times — a small risk traded for a larger one.

Every function in the persistence layer fails open. A database blip must not
lock the owner out: the throttle is a brake on guessing, and a brake that jams
shut is worse than one that occasionally slips.

## What this is not

- **Not multi-user.** There is one password and no roles. Anyone who has it has
  everything.
- **Not protection from your own devices.** A phone with the app installed and
  no passcode is the whole vault.
- **Not a reason to keep ID scans forever.** Store them while a bank actually
  needs them, then delete them. The safest copy of a passport scan is the one
  that is not there.
- **Not audited.** These are the standard defences applied carefully, not a
  penetration test.

## Checking it yourself

Unauthenticated requests to every page and file route should redirect; the
machine routes should return 401 without their bearer token:

```bash
for u in / /accounts /money /documents /api/documents/1 /api/setups/1/chart; do
  curl -s -o /dev/null -w "$u %{http_code}\n" https://your-app/$u
done
```

Headers on any response:

```bash
curl -sD- -o /dev/null https://your-app/login | grep -iE '^content-security|^strict|^x-|^referrer|^permissions'
```
