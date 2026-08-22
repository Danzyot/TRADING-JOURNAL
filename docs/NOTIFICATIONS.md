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
