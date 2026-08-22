# Artwork

The source sheets the app icons are cut from. Each is a 3×2 grid of tiles, one
per colour, in the order purple, gold, red / teal, blue, magenta.

| File | Set | Notes |
|---|---|---|
| `logo-sheet-ember.png` | `ember` | Softer glow, deeper stone |
| `logo-sheet-neon.png` | `neon` | Brighter, sharper, the TJ clearly legible |

`scripts/generate-logos.mjs` cuts both into `public/logos/<set>-<colour>/` at
the four sizes the app and iOS need. Run it after replacing a sheet:

```bash
node scripts/generate-logos.mjs
```

The crop boxes in that script are measured from each sheet, not shared — tile
positions differ between them — so a replacement sheet needs its box checked
rather than assumed. Compositing the twelve crops over a bright background is
the quickest way to see a mis-crop: any edge that bleeds through is wrong.
