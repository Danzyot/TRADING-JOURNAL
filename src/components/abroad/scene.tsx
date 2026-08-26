import type { Scenery } from '@/lib/abroad/scenery'

/**
 * The picture of a place, drawn from its own data.
 *
 * Every layer means something: the skyline is the terrain, the foreground strip
 * is what you would stand on at the water, the palette is the climate. Two
 * towns that look alike here are alike. The wobble between them — how many
 * buildings, how tall, where the sun sits — comes from a hash of the town's id,
 * so a place's picture is the same on every load and different from its
 * neighbour's.
 */

/** Deterministic 0–1 from the seed and a channel number. */
function rand(seed: number, channel: number): number {
  const value = Math.sin(seed * 12.9898 + channel * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function PlaceScene({
  scenery,
  alt,
  className,
}: {
  scenery: Scenery
  alt: string
  className?: string
}) {
  if (scenery.photo) {
    // eslint-disable-next-line @next/next/no-img-element -- a committed still, not a remote asset
    return <img src={scenery.photo} alt={alt} className={className} loading="lazy" />
  }

  const { palette: p, terrain, seed } = scenery
  const gradient = `sky-${seed % 100000}`
  const hasSea = terrain !== 'inland'
  const sunX = 40 + rand(seed, 1) * 220
  const horizon = 62

  return (
    <svg
      viewBox="0 0 320 120"
      role="img"
      aria-label={alt}
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="100%" stopColor={p.sky[1]} />
        </linearGradient>
      </defs>

      <rect width="320" height="120" fill={`url(#${gradient})`} />
      <circle cx={sunX} cy={22 + rand(seed, 2) * 10} r="9" fill={p.sun} opacity="0.9" />

      <Backdrop terrain={terrain} palette={p} seed={seed} horizon={horizon} />

      {hasSea ? (
        <>
          <rect x="0" y={horizon} width="320" height={120 - horizon} fill={p.sea} />
          <rect x="0" y={horizon} width="320" height="6" fill={p.seaDeep} opacity="0.35" />
          {[0, 1, 2].map((line) => (
            <path
              key={line}
              d={waves(seed + line * 17, horizon + 14 + line * 12)}
              stroke="#ffffff"
              strokeOpacity={0.28 - line * 0.06}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </>
      ) : (
        <rect x="0" y={horizon} width="320" height={120 - horizon} fill={p.land} />
      )}

      <Foreground scenery={scenery} horizon={horizon} />
    </svg>
  )
}

function waves(seed: number, y: number): string {
  const offset = rand(seed, 3) * 40
  let path = `M ${-offset} ${y}`
  for (let x = 0; x <= 360; x += 40) {
    path += ` q 10 -3 20 0 q 10 3 20 0`
  }
  return path
}

/** The skyline: what is behind the water. */
function Backdrop({
  terrain,
  palette: p,
  seed,
  horizon,
}: {
  terrain: Scenery['terrain']
  palette: Scenery['palette']
  seed: number
  horizon: number
}) {
  if (terrain === 'mountain') {
    return (
      <>
        <path d={`M0 ${horizon} L60 26 L100 44 L150 18 L210 46 L260 30 L320 ${horizon} Z`} fill={p.rock} />
        <path d={`M110 30 L150 18 L188 34 L150 40 Z`} fill="#ffffff" opacity="0.5" />
        <path d={`M0 ${horizon} L70 40 L130 52 L200 38 L270 50 L320 ${horizon} Z`} fill={p.veg} opacity="0.75" />
      </>
    )
  }
  if (terrain === 'city' || terrain === 'desert') {
    const towers = 9 + Math.floor(rand(seed, 4) * 5)
    return (
      <>
        {terrain === 'desert' ? (
          <path d={`M0 ${horizon} q 80 -14 160 0 q 80 14 160 0 L320 ${horizon} Z`} fill={p.land} />
        ) : null}
        {Array.from({ length: towers }, (_, index) => {
          const width = 14 + rand(seed, 10 + index) * 12
          const height = 16 + rand(seed, 30 + index) * 34
          const x = (index * 320) / towers + rand(seed, 50 + index) * 6
          return (
            <rect
              key={index}
              x={x}
              y={horizon - height}
              width={width}
              height={height}
              fill={index % 3 === 0 ? p.wall : p.rock}
              opacity={0.9}
            />
          )
        })}
      </>
    )
  }
  if (terrain === 'cliff') {
    return (
      <>
        <path d={`M0 ${horizon} L0 34 L46 30 L74 ${horizon} Z`} fill={p.rock} />
        <path d={`M246 ${horizon} L272 26 L320 32 L320 ${horizon} Z`} fill={p.rock} />
        <path d={`M110 ${horizon} L128 44 L150 46 L162 ${horizon} Z`} fill={p.rock} opacity="0.8" />
      </>
    )
  }
  if (terrain === 'island') {
    return (
      <>
        <path d={`M30 ${horizon} q 40 -30 84 0 Z`} fill={p.rock} opacity="0.75" />
        <path d={`M196 ${horizon} q 52 -38 110 0 Z`} fill={p.rock} />
        <path d={`M214 ${horizon} q 38 -24 74 0 Z`} fill={p.veg} opacity="0.7" />
      </>
    )
  }
  if (terrain === 'tropical') {
    return (
      <>
        <path d={`M0 ${horizon} q 60 -22 120 -4 q 70 -26 130 4 L320 ${horizon} Z`} fill={p.rock} opacity="0.55" />
        <path d={`M232 ${horizon} q 20 -34 44 -14 q 16 12 8 14 Z`} fill={p.rock} opacity="0.85" />
      </>
    )
  }
  if (terrain === 'baltic') {
    return (
      <>
        <path d={`M0 ${horizon} L320 ${horizon} L320 ${horizon - 12} q -40 -8 -80 0 q -40 8 -80 0 q -40 -8 -80 0 q -40 8 -80 0 Z`} fill={p.veg} opacity="0.7" />
        {Array.from({ length: 12 }, (_, index) => (
          <path
            key={index}
            d={`M${12 + index * 26} ${horizon} l0 -${12 + rand(seed, index) * 10}`}
            stroke={p.veg}
            strokeWidth="3"
          />
        ))}
      </>
    )
  }
  if (terrain === 'inland') {
    return (
      <>
        <path d={`M0 ${horizon} q 70 -22 150 -6 q 90 -20 170 6 Z`} fill={p.veg} opacity="0.55" />
        <path d={`M0 ${horizon} q 90 -12 180 0 q 80 10 140 -4 L320 ${horizon} Z`} fill={p.land} />
      </>
    )
  }
  // harbour and sand: a low headland with a town on it
  const houses = 7 + Math.floor(rand(seed, 5) * 5)
  return (
    <>
      <path d={`M0 ${horizon} q 60 -18 130 -8 q 80 -12 190 8 Z`} fill={p.rock} opacity="0.6" />
      {Array.from({ length: houses }, (_, index) => {
        const width = 16 + rand(seed, 60 + index) * 10
        const height = 10 + rand(seed, 80 + index) * 14
        const x = 10 + (index * 300) / houses
        return (
          <g key={index}>
            <rect x={x} y={horizon - height} width={width} height={height} fill={p.wall} />
            <path
              d={`M${x - 2} ${horizon - height} L${x + width / 2} ${horizon - height - 5} L${x + width + 2} ${horizon - height} Z`}
              fill={p.roof}
            />
          </g>
        )
      })}
    </>
  )
}

/** The strip you would actually be standing on. */
function Foreground({ scenery, horizon }: { scenery: Scenery; horizon: number }) {
  const { palette: p, shore, terrain, seed } = scenery
  if (terrain === 'inland') {
    return (
      <>
        <path d={`M0 104 q 80 -10 160 0 q 80 10 160 0 L320 120 L0 120 Z`} fill={p.veg} opacity="0.5" />
      </>
    )
  }
  if (shore === 'rock') {
    return (
      <path
        d={`M0 120 L0 100 q 24 -8 40 2 q 20 -14 44 -2 q 26 -10 44 4 L320 108 L320 120 Z`}
        fill={p.rock}
      />
    )
  }
  if (shore === 'pebble') {
    return (
      <>
        <path d={`M0 120 L0 104 q 160 -12 320 0 L320 120 Z`} fill={p.land} />
        {Array.from({ length: 22 }, (_, index) => (
          <circle
            key={index}
            cx={rand(seed, 100 + index) * 320}
            cy={108 + rand(seed, 130 + index) * 10}
            r={1.4 + rand(seed, 160 + index) * 1.6}
            fill={p.rock}
            opacity="0.7"
          />
        ))}
      </>
    )
  }
  if (shore === 'none') {
    return <path d={`M0 120 L0 108 q 160 -8 320 0 L320 120 Z`} fill={p.land} />
  }
  // sand, with a palm or a pine depending on the climate
  const tree = terrain === 'tropical' || terrain === 'desert' || terrain === 'island'
  return (
    <>
      <path d={`M0 120 L0 102 q 160 -10 320 0 L320 120 Z`} fill={p.land} />
      {tree ? (
        <g transform={`translate(${28 + rand(seed, 7) * 20} 104)`}>
          <path d="M0 0 q -3 -14 2 -24" stroke={p.rock} strokeWidth="2.5" fill="none" />
          <path d="M2 -24 q -14 -6 -18 2 M2 -24 q 14 -6 18 2 M2 -24 q -6 -14 -14 -12 M2 -24 q 8 -14 16 -10"
            stroke={p.veg} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </>
  )
}

/**
 * The house, the room and the water, as three small tiles.
 *
 * They sit next to the words that describe them because a sentence about a
 * "detached 3-bed" and a picture of a detached house do different jobs — the
 * picture is scanned, the sentence is read.
 */
export function HouseTile({ scenery }: { scenery: Scenery }) {
  const p = scenery.palette
  return (
    <Tile label="house">
      {scenery.house === 'tower' ? (
        <>
          <rect x="14" y="10" width="20" height="34" fill={p.wall} />
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1].map((col) => (
              <rect key={`${row}-${col}`} x={18 + col * 8} y={14 + row * 6} width="5" height="4" fill={p.sea} opacity="0.6" />
            )),
          )}
        </>
      ) : scenery.house === 'wooden' ? (
        <>
          <path d="M8 22 L24 10 L40 22 Z" fill={p.roof} />
          <rect x="13" y="22" width="22" height="16" fill={p.wall} />
          <path d="M13 38 l0 6 M35 38 l0 6" stroke={p.rock} strokeWidth="2" />
          <rect x="20" y="27" width="8" height="11" fill={p.veg} opacity="0.7" />
        </>
      ) : scenery.house === 'stone' ? (
        <>
          <path d="M9 20 L24 9 L39 20 Z" fill={p.roof} />
          <rect x="12" y="20" width="24" height="20" fill={p.rock} opacity="0.4" />
          <rect x="12" y="20" width="24" height="20" fill="none" stroke={p.rock} strokeWidth="1.5" />
          <rect x="20" y="29" width="8" height="11" fill={p.roof} opacity="0.8" />
          <rect x="15" y="24" width="5" height="4" fill={p.sea} opacity="0.55" />
          <rect x="28" y="24" width="5" height="4" fill={p.sea} opacity="0.55" />
        </>
      ) : scenery.house === 'villa' ? (
        <>
          <rect x="9" y="18" width="30" height="18" fill={p.wall} />
          <rect x="9" y="15" width="30" height="4" fill={p.roof} />
          <rect x="14" y="24" width="7" height="6" fill={p.sea} opacity="0.55" />
          <rect x="27" y="24" width="7" height="6" fill={p.sea} opacity="0.55" />
          <rect x="6" y="37" width="36" height="6" rx="3" fill={p.sea} opacity="0.75" />
        </>
      ) : (
        <>
          <rect x="8" y="16" width="14" height="24" fill={p.wall} />
          <rect x="22" y="20" width="13" height="20" fill={p.wall} opacity="0.85" />
          <path d="M6 16 L15 9 L24 16 Z" fill={p.roof} />
          <path d="M20 20 L28.5 14 L37 20 Z" fill={p.roof} opacity="0.9" />
          <rect x="12" y="30" width="6" height="10" fill={p.roof} opacity="0.8" />
        </>
      )}
    </Tile>
  )
}

export function GymTile({ hasMat, scenery }: { hasMat: boolean; scenery: Scenery }) {
  const p = scenery.palette
  if (!hasMat) {
    return (
      <Tile label="no mat">
        <rect x="8" y="16" width="32" height="22" rx="2" fill={p.rock} opacity="0.25" />
        <path d="M16 22 l16 12 M32 22 l-16 12" stroke={p.rock} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      </Tile>
    )
  }
  return (
    <Tile label="mats">
      <rect x="6" y="26" width="36" height="14" rx="2" fill={p.veg} opacity="0.55" />
      <path d="M6 33 h36 M18 26 v14 M30 26 v14" stroke={p.wall} strokeWidth="1" opacity="0.7" />
      <rect x="20" y="8" width="8" height="15" rx="4" fill={p.roof} />
      <path d="M24 8 v-3" stroke={p.rock} strokeWidth="1.5" />
      <circle cx="12" cy="20" r="4" fill={p.rock} opacity="0.7" />
      <circle cx="36" cy="20" r="4" fill={p.rock} opacity="0.7" />
    </Tile>
  )
}

export function ShoreTile({ scenery }: { scenery: Scenery }) {
  const p = scenery.palette
  const shore = scenery.shore
  return (
    <Tile label={shore === 'none' ? 'no sea' : shore}>
      {shore === 'none' ? (
        <>
          <path d="M6 34 q 12 -14 22 -2 q 8 -10 14 2 Z" fill={p.veg} opacity="0.6" />
          <rect x="6" y="34" width="36" height="7" fill={p.land} />
        </>
      ) : (
        <>
          <rect x="4" y="12" width="40" height="16" fill={p.sea} />
          <path d="M4 20 q 5 -2 10 0 q 5 2 10 0 q 5 -2 10 0 q 5 2 10 0" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.5" fill="none" />
          {shore === 'rock' ? (
            <path d="M4 41 L4 30 q 10 -6 18 2 q 10 -8 22 2 L44 41 Z" fill={p.rock} />
          ) : shore === 'pebble' ? (
            <>
              <rect x="4" y="28" width="40" height="13" fill={p.land} />
              {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                <circle key={index} cx={8 + index * 6} cy={32 + (index % 3) * 3} r="1.8" fill={p.rock} opacity="0.75" />
              ))}
            </>
          ) : (
            <rect x="4" y="28" width="40" height="13" fill={p.land} />
          )}
        </>
      )}
    </Tile>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={label} className="h-11 w-11 shrink-0 rounded-md">
      <rect width="48" height="48" rx="6" fill="currentColor" opacity="0.05" />
      {children}
    </svg>
  )
}
