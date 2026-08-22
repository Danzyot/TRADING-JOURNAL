'use client'

import { useEffect, useState } from 'react'
import type { ActionResult } from '@/server/actions'

/**
 * Turning on notifications for this device.
 *
 * Three things have to happen in order and each can fail on its own: the
 * service worker registers, the browser grants permission, and the push
 * service issues a subscription which we store. The button reports which step
 * it reached, because "it didn't work" is useless on a phone with no console.
 *
 * iOS is the fussy platform and the one that matters here: Web Push only works
 * for a site added to the home screen, permission may only be requested from a
 * real tap, and none of it exists before iOS 16.4. Each of those is detected
 * and explained rather than failing silently.
 */
export function PushSetup({
  publicKey,
  save,
  test,
}: {
  publicKey: string | null
  save: (subscription: string, label: string) => Promise<ActionResult>
  test: () => Promise<ActionResult>
}) {
  const [state, setState] = useState<'checking' | 'unsupported' | 'needs-install' | 'ready' | 'on'>(
    'checking',
  )
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) {
      // On an iPhone this is what a Safari *tab* looks like: the APIs only
      // appear once the app has been added to the home screen and opened
      // from there.
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      setState(iOS ? 'needs-install' : 'unsupported')
      return
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (iOS && !standalone) {
      setState('needs-install')
      return
    }

    navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        const existing = await registration?.pushManager.getSubscription()
        setState(existing && Notification.permission === 'granted' ? 'on' : 'ready')
      })
      .catch(() => setState('ready'))
  }, [])

  async function enable() {
    if (!publicKey) {
      setMessage('The server has no VAPID keys set — see docs/NOTIFICATIONS.md.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage(
          permission === 'denied'
            ? 'Notifications are blocked for this app. Turn them back on in iPhone Settings → Notifications → Journal, then try again.'
            : 'Permission was dismissed — tap Enable again and choose Allow.',
        )
        return
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          // Required to be true: a push that shows nothing to the user is not
          // allowed, and every push this app sends shows a notification.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      const result = await save(JSON.stringify(subscription), deviceLabel())
      setMessage(result.message)
      if (result.ok) setState('on')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not turn on notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await test()
      setMessage(result.message)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checking') {
    return <p className="text-xs text-[var(--ink-muted)]">Checking this device…</p>
  }

  if (state === 'needs-install') {
    return (
      <div className="space-y-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
        <p className="font-medium text-[var(--ink)]">Open the installed app first</p>
        <p>
          iPhone only allows notifications from the home-screen app, not from a Safari tab. In Safari, tap
          Share → <strong>Add to Home Screen</strong>, then open the journal from that icon and come back
          here — this card will show an Enable button.
        </p>
      </div>
    )
  }

  if (state === 'unsupported') {
    return (
      <p className="text-xs leading-relaxed text-[var(--ink-secondary)]">
        This browser has no push support. On iPhone use Safari and add the app to your home screen; on
        desktop use Chrome, Edge or Firefox.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={enable} className="btn btn-primary" disabled={busy}>
          {busy ? 'Working…' : state === 'on' ? 'Re-enable on this device' : 'Enable notifications'}
        </button>
        {state === 'on' && (
          <button type="button" onClick={sendTest} className="btn" disabled={busy}>
            Send a test
          </button>
        )}
      </div>
      {message && <p className="text-xs text-[var(--ink-secondary)]">{message}</p>}
    </div>
  )
}

/** Something recognisable in the device list, without fingerprinting anything. */
function deviceLabel(): string {
  const agent = navigator.userAgent
  if (/iPhone/.test(agent)) return 'iPhone'
  if (/iPad/.test(agent)) return 'iPad'
  if (/Android/.test(agent)) return 'Android'
  if (/Mac/.test(agent)) return 'Mac'
  if (/Windows/.test(agent)) return 'Windows PC'
  return 'This device'
}

/**
 * The VAPID key travels as base64url text but `subscribe` wants raw bytes.
 * Padding and the two swapped characters have to be restored first.
 */
function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalised)
  // Backed by a plain ArrayBuffer: the DOM signature will not accept a view
  // that might sit on a SharedArrayBuffer.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}
