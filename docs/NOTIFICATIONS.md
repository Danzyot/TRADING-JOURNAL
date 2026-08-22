# The phone app and notifications

The journal installs to an iPhone home screen and sends push notifications.
It is a PWA, not a native app: same codebase, no App Store, no developer
account, and it updates whenever the site deploys.

## Installing

Open the journal in **Safari** (not Chrome — on iOS only Safari can install a
web app), tap **Share → Add to Home Screen**, then open it from the new icon.
It runs full screen with its own icon and remembers your session.

## Choosing the icon

Six colourways of the same mark ship with the app: blue, teal, purple, magenta,
gold and red. Pick one in **Settings → App icon**. The sidebar and browser tab
change immediately; the manifest and the `apple-touch-icon` link both name the
chosen file, so a *new* install picks it up too.

An icon already on a home screen keeps the old art — iOS copies the image at
install time and never re-reads it. Delete the icon and add it again to change
it.

`scripts/generate-logos.mjs` cuts the six from the artwork sheet if it is ever
replaced.

## Turning on notifications

Notifications need a VAPID key pair. It is one command, once, and free forever:

```bash
npm run push:keys
```

Add the two lines it prints to Vercel → Settings → Environment Variables, plus
your address as the contact the push services can reach:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Redeploy, then **open the app from the home-screen icon** (not a Safari tab),
go to Settings → *Notifications on your phone* → **Enable notifications**, and
allow the prompt. *Send a test* confirms the whole chain.

Two iOS rules that cause most of the confusion:

- Push only works from the **installed** app. In a Safari tab the browser does
  not even expose the API, and the Settings card says so rather than offering a
  button that cannot work.
- Permission can only be requested from a real tap, which is why it is a button
  rather than something that happens on page load.

If you tapped *Don't Allow*, iOS will not ask again: turn it back on in
**iPhone Settings → Notifications → Journal**, then press Enable again.

## What gets sent

Only things worth interrupting you for:

| Event | Notification |
|---|---|
| Payout requested, approved, paid or denied | "Payout approved — $1,500" |
| Account passed | "Account passed" |
| Account failed, breached or liquidated | "Account failed" |
| Several at once | One notification summarising them |

Balance snapshots and subscription notices are logged but never pushed — a
daily wire from every account would train you to ignore the alerts.

Notifications sharing a subject replace each other rather than stacking, so
three updates in a row leave one notification showing the latest state.

## How it works

`public/sw.js` is the service worker: it caches the static shell so the app
opens instantly while the database wakes, and it receives pushes. Subscriptions
live in `push_subscriptions`, keyed on the endpoint the push service issues —
that string is the device's address. `src/server/push.ts` sends, and prunes any
subscription the push service reports as gone (404/410), which is what happens
when an app is deleted or reinstalled.

Sending never throws into the caller. A payout still has to be recorded when
the phone is unreachable, so a failed notification is swallowed after pruning.

The manifest, service worker and icons are exempt from the auth middleware —
iOS fetches them before anyone signs in, and a service worker that redirects to
a login page cannot register at all. They expose nothing: the worker caches
only static assets, and every page it fetches still goes through the session
check.

## Staying on the current version

A home-screen app on iOS is suspended, not closed. It can keep running the
code it launched with for weeks, so a deploy lands under it: the copy on the
phone asks for a script file from the build it started with, that build gets
pruned, and the request 404s. The app breaks, and from the phone the only
obvious fix is to delete the icon and add it again.

Four things prevent that, earliest first:

1. **`deploymentId`** (`next.config.ts`, from `VERCEL_DEPLOYMENT_ID`). Every
   asset URL carries the build that produced it, so Next recognises a mismatch
   and does a full navigation instead of failing on a missing chunk.
2. **`updateViaCache: 'none'`** on the service-worker registration, so `sw.js`
   itself is never answered from the HTTP cache and a new version is always
   noticed.
3. **A check on resume.** Coming back to the foreground is when a suspended app
   rejoins the world, so that is when it looks for a newer worker. If the app
   has been in the background more than five seconds it counts as a fresh
   visit and reloads silently; if the user is mid-sentence they get a "new
   version is ready" button instead of losing the sentence.
4. **Recovery.** If a script does fail to load anyway, the page reloads once —
   guarded in `sessionStorage` so a genuinely broken deploy cannot put it in a
   reload loop.

The worker also drops cached `/_next/static/` entries when it activates. A new
worker activates because a new build shipped, so everything in there belongs to
a build that is no longer running; without pruning the cache grows by one full
set of chunks per deploy.

### What re-adding is still needed for

**The home-screen icon.** iOS copies the icon into the home screen at the
moment the app is added and never looks at it again. Changing the mark in
Settings changes it everywhere in the app, in the browser tab and for anyone
installing from then on — but an icon already on a home screen only changes by
removing it and adding it back. That is an iOS limitation, not something the
app can work around.

**Notification permission** survives updates and does not need re-granting.
The push subscription is stored server-side against the device and is
unaffected by a deploy.
