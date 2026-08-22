'use client'

import { useState } from 'react'
import { Field } from './form'
import {
  CRYPTO_ASSETS,
  NETWORKS,
  addressLooksValid,
  isCryptoCurrency,
  isStablecoin,
  networkFor,
} from '@/lib/crypto-assets'

export type WalletOption = { id: number; label: string; network: string; address: string }

const FIAT = ['USD', 'ILS', 'EUR']

/**
 * The currency picker, plus the three fields that only mean anything when the
 * money moved on a chain.
 *
 * These live together because they are one decision. The currency select is
 * what reveals them — a payout in USDC needs a network and a hash to be
 * checkable later, a payout in USD does not — and a component that owns both
 * can reveal them without the page wiring up its own state.
 *
 * A volatile asset also asks for the unit price that settled. Without it the
 * server has no honest way to value 0.4 ETH, and guessing 1:1 would book it as
 * $0.40 — the kind of silently wrong number that only surfaces at tax time.
 */
export function CryptoFields({
  defaultCurrency,
  defaultNetwork,
  defaultTxHash,
  defaultAddress,
  defaultRate,
  wallets = [],
  baseCurrency = 'USD',
}: {
  defaultCurrency: string
  defaultNetwork?: string | null
  defaultTxHash?: string | null
  defaultAddress?: string | null
  defaultRate?: number | null
  wallets?: WalletOption[]
  baseCurrency?: string
}) {
  const [currency, setCurrency] = useState(defaultCurrency)
  const [network, setNetwork] = useState(defaultNetwork ?? '')
  const [address, setAddress] = useState(defaultAddress ?? '')

  const crypto = isCryptoCurrency(currency)
  const volatile = crypto && !isStablecoin(currency)
  const matching = wallets.filter((wallet) => !network || wallet.network === network)
  // Only complain about an address once there is a chain to judge it against,
  // and never block the save: a chain this app has not heard of is the app's
  // gap, not the trader's typo.
  const suspect = crypto && network && address.trim() !== '' && !addressLooksValid(network, address.trim())

  return (
    <>
      <Field label="Currency">
        <select
          name="currency"
          className="select"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          <optgroup label="Fiat">
            {FIAT.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </optgroup>
          <optgroup label="Crypto">
            {CRYPTO_ASSETS.map((asset) => (
              <option key={asset.code} value={asset.code}>
                {asset.code} — {asset.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      {crypto && (
        <>
          <Field label="Network" hint="Which chain it moved on">
            <select
              name="cryptoNetwork"
              className="select"
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
            >
              <option value="">Choose a chain…</option>
              {NETWORKS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Transaction hash" hint="Proves it, and links straight to the explorer">
            <input
              name="cryptoTxHash"
              className="input font-mono text-xs"
              placeholder="0x…"
              defaultValue={defaultTxHash ?? ''}
            />
          </Field>

          <Field
            label="Address"
            hint={suspect ? `Does not look like a ${networkFor(network)?.label} address` : 'Where it landed, or was sent from'}
          >
            <input
              name="cryptoAddress"
              className={`input font-mono text-xs${suspect ? ' border-[var(--critical)]' : ''}`}
              list="wallet-addresses"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <datalist id="wallet-addresses">
              {matching.map((wallet) => (
                <option key={wallet.id} value={wallet.address}>
                  {wallet.label}
                </option>
              ))}
            </datalist>
          </Field>

          {volatile && (
            <Field
              label={`Unit price in ${baseCurrency}`}
              hint={`What one ${currency} was worth when it settled — required, so the ${baseCurrency} figure stays checkable`}
            >
              <input
                name="settlementRate"
                type="number"
                step="any"
                min="0"
                className="input"
                defaultValue={defaultRate ?? ''}
                required
              />
            </Field>
          )}
        </>
      )}
    </>
  )
}
