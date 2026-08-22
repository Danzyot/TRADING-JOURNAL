import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

/**
 * Cuts the app marks out of the reference sheets.
 *
 *   node scripts/generate-logos.mjs
 *
 * Kept in the repo so the icons can be rebuilt if the artwork is replaced.
 *
 * Two sets, six colours each, same mark:
 *   ember — the first sheet, a softer glow
 *   neon  — the second, brighter and sharper, with the TJ clearly legible
 *
 * Crop boxes are measured rather than guessed. Tile edges fade into the black
 * surround, so thresholding a whole row is unreliable; scanning single lines
 * through each tile's middle finds the true edges, and the tiles are square and
 * evenly pitched from there.
 */

const SHEETS = [
  {
    set: 'ember',
    src: '96748366-cba3-48d2-8b71-b5f0233d9b80.png',
    size: 400,
    // Centres of the glow, which are unambiguous on this softer sheet.
    lefts: [100, 573, 1049],
    tops: [81, 535],
  },
  {
    set: 'neon',
    src: '456b9324-caa0-49c7-83c8-880723772272 (1).png',
    size: 418,
    // Measured tile edges: left 74/558/1035, top 56/538.
    lefts: [74, 558, 1035],
    tops: [56, 538],
  },
]

const COLOURS = ['purple', 'gold', 'red', 'teal', 'blue', 'magenta']

for (const sheet of SHEETS) {
  let index = 0
  for (const top of sheet.tops) {
    for (const left of sheet.lefts) {
      const id = `${sheet.set}-${COLOURS[index++]}`
      const dir = `public/logos/${id}`
      mkdirSync(dir, { recursive: true })

      const tile = sharp(sheet.src).extract({
        left,
        top,
        width: sheet.size,
        height: sheet.size,
      })

      // 512 and 192 for the manifest, 180 for iOS (which masks its own
      // corners), 64 for the sidebar.
      for (const size of [512, 192, 64]) {
        await tile.clone().resize(size, size).png({ compressionLevel: 9 }).toFile(`${dir}/icon-${size}.png`)
      }
      await tile.clone().resize(180, 180).png({ compressionLevel: 9 }).toFile(`${dir}/apple-touch-icon.png`)
      console.log('wrote', id)
    }
  }
}
