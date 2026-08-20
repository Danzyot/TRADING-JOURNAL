/**
 * Tradovate REST client.
 *
 * Covers what a journal needs: authenticate, list accounts, pull fills, and read
 * cash balances. Order placement is deliberately absent — this app records
 * trading, it does not do any.
 *
 * Two things about this API that are easy to get wrong:
 *
 *  1. Fills reference a numeric `contractId`, not a symbol. Resolving those one
 *     at a time is the difference between a sync that takes a second and one
 *     that takes a minute, so contracts are cached per run and across runs.
 *  2. Fills carry no commission. Prop accounts pay a real round-turn rate, so
 *     cost is applied from the per-account rate in Settings. A journal that
 *     ignores commission will tell you a scalping strategy is profitable when
 *     it is not.
 *
 * Access tokens last ~80 minutes; `renewAccessToken` extends without a fresh
 * password round trip, and Tradovate penalises repeated password logins.
 */
import { z } from 'zod'

export const TRADOVATE_HOSTS = {
  live: 'https://live.tradovateapi.com/v1',
  demo: 'https://demo.tradovateapi.com/v1',
} as const

export type TradovateEnvironment = keyof typeof TRADOVATE_HOSTS

export const tradovateCredentialsSchema = z.object({
  name: z.string().min(1, 'Tradovate username is required'),
  password: z.string().min(1, 'Tradovate password is required'),
  /** From the Tradovate API access request. */
  appId: z.string().min(1),
  appVersion: z.string().default('1.0'),
  cid: z.union([z.string(), z.number()]),
  sec: z.string().min(1),
  deviceId: z.string().optional(),
})

export type TradovateCredentials = z.infer<typeof tradovateCredentialsSchema>

export type TradovateSession = {
  accessToken: string
  expiresAt: Date
  userId: number
}

const accessTokenResponse = z.object({
  accessToken: z.string().optional(),
  expirationTime: z.string().optional(),
  userId: z.number().optional(),
  errorText: z.string().optional(),
  // Returned when the account has more than one entitlement and needs a captcha
  // or 2FA step; surfaced as an actionable error rather than a silent failure.
  'p-ticket': z.string().optional(),
  'p-time': z.number().optional(),
  'p-captcha': z.boolean().optional(),
})

export const tradovateAccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  accountType: z.string().optional(),
  active: z.boolean().optional(),
  clearingHouseId: z.number().optional(),
  legalStatus: z.string().optional(),
})

export type TradovateAccount = z.infer<typeof tradovateAccountSchema>

export const tradovateFillSchema = z.object({
  id: z.number(),
  orderId: z.number(),
  contractId: z.number(),
  timestamp: z.string(),
  tradeDate: z.object({ year: z.number(), month: z.number(), day: z.number() }).optional(),
  action: z.enum(['Buy', 'Sell']),
  qty: z.number(),
  price: z.number(),
  active: z.boolean().optional(),
})

export type TradovateFill = z.infer<typeof tradovateFillSchema>

export class TradovateError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'TradovateError'
  }
}

export class TradovateClient {
  private readonly base: string
  private session: TradovateSession | null = null
  private readonly contractCache = new Map<number, string>()

  constructor(
    environment: TradovateEnvironment = 'live',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.base = TRADOVATE_HOSTS[environment]
  }

  /** Reuses a stored token so a sync does not re-authenticate every run. */
  restoreSession(session: TradovateSession | null): void {
    this.session = session
  }

  getSession(): TradovateSession | null {
    return this.session
  }

  private valid(): boolean {
    // Renew a couple of minutes early; a token that expires mid-sync costs a
    // whole run.
    return this.session !== null && this.session.expiresAt.getTime() - Date.now() > 120_000
  }

  async authenticate(credentials: TradovateCredentials): Promise<TradovateSession> {
    if (this.valid()) return this.session!

    if (this.session) {
      const renewed = await this.tryRenew()
      if (renewed) return renewed
    }

    const body = {
      name: credentials.name,
      password: credentials.password,
      appId: credentials.appId,
      appVersion: credentials.appVersion,
      cid: Number(credentials.cid),
      sec: credentials.sec,
      deviceId: credentials.deviceId ?? 'trading-journal',
    }

    const response = await this.fetchImpl(`${this.base}/auth/accessTokenRequest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = accessTokenResponse.parse(await response.json())

    if (json['p-captcha']) {
      throw new TradovateError(
        'Tradovate is asking for a captcha. Sign in through the Tradovate web platform once to clear it, then re-run the sync.',
      )
    }
    if (json['p-ticket']) {
      throw new TradovateError(
        `Tradovate returned a pending ticket (time penalty ${json['p-time'] ?? '?'}s). This usually means too many login attempts — wait it out before retrying.`,
        429,
        true,
      )
    }
    if (!json.accessToken) {
      throw new TradovateError(json.errorText ?? 'Tradovate rejected the credentials.', response.status)
    }

    this.session = {
      accessToken: json.accessToken,
      expiresAt: json.expirationTime ? new Date(json.expirationTime) : new Date(Date.now() + 60 * 60 * 1000),
      userId: json.userId ?? 0,
    }
    return this.session
  }

  private async tryRenew(): Promise<TradovateSession | null> {
    if (!this.session) return null
    try {
      const response = await this.fetchImpl(`${this.base}/auth/renewAccessToken`, {
        headers: { authorization: `Bearer ${this.session.accessToken}` },
      })
      if (!response.ok) return null
      const json = accessTokenResponse.parse(await response.json())
      if (!json.accessToken) return null
      this.session = {
        accessToken: json.accessToken,
        expiresAt: json.expirationTime
          ? new Date(json.expirationTime)
          : new Date(Date.now() + 60 * 60 * 1000),
        userId: json.userId ?? this.session.userId,
      }
      return this.session
    } catch {
      // A failed renewal is not fatal; the caller falls back to a full login.
      return null
    }
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    if (!this.session) throw new TradovateError('Not authenticated with Tradovate.')

    const response = await this.fetchImpl(`${this.base}${path}`, {
      headers: {
        authorization: `Bearer ${this.session.accessToken}`,
        accept: 'application/json',
      },
    })

    if (response.status === 401) {
      throw new TradovateError('Tradovate access token was rejected. Re-authenticating next run.', 401, true)
    }
    if (response.status === 429) {
      throw new TradovateError('Tradovate rate limit hit. Backing off.', 429, true)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new TradovateError(
        `Tradovate ${path} failed with ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        response.status,
        response.status >= 500,
      )
    }

    return schema.parse(await response.json())
  }

  async listAccounts(): Promise<TradovateAccount[]> {
    return this.get('/account/list', z.array(tradovateAccountSchema))
  }

  /**
   * All fills the API will return.
   *
   * Tradovate's `/fill/list` returns the fills visible to the token rather than
   * an arbitrary date range, so the caller filters by time and relies on the
   * unique index over (source, externalId) to make re-imports idempotent.
   */
  async listFills(): Promise<TradovateFill[]> {
    return this.get('/fill/list', z.array(tradovateFillSchema))
  }

  async cashBalanceSnapshot(accountId: number): Promise<number | null> {
    if (!this.session) throw new TradovateError('Not authenticated with Tradovate.')
    const response = await this.fetchImpl(`${this.base}/cashBalance/getCashBalanceSnapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    })
    if (!response.ok) return null
    const parsed = z
      .object({
        totalCashValue: z.number().optional(),
        realizedPnL: z.number().optional(),
        openPnL: z.number().optional(),
      })
      .safeParse(await response.json())
    if (!parsed.success) return null
    const { totalCashValue = 0, openPnL = 0 } = parsed.data
    // Equity, not balance — the drawdown line trails equity on most firms.
    return totalCashValue + openPnL
  }

  /** Resolves contract ids to names, memoised across the whole sync. */
  async contractName(contractId: number): Promise<string> {
    const cached = this.contractCache.get(contractId)
    if (cached) return cached

    try {
      const contract = await this.get(
        `/contract/item?id=${contractId}`,
        z.object({ id: z.number(), name: z.string() }),
      )
      this.contractCache.set(contractId, contract.name)
      return contract.name
    } catch {
      // An unresolvable contract should not abandon the whole sync; journal it
      // under its id so the fill is not silently dropped.
      const fallback = `UNKNOWN-${contractId}`
      this.contractCache.set(contractId, fallback)
      return fallback
    }
  }

  primeContractCache(entries: Record<number, string>): void {
    for (const [id, name] of Object.entries(entries)) this.contractCache.set(Number(id), name)
  }

  exportContractCache(): Record<number, string> {
    return Object.fromEntries(this.contractCache)
  }
}
