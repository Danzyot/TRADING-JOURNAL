import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

/**
 * Cuts the six app marks out of the reference sheet.
 *
 * Kept as a script rather than done once by hand so the icons can be
 * regenerated if the artwork is ever replaced:
 *
 *   node scripts/generate-logos.mjs <reference.png>
 *
 * The reference is a clean 3x2 grid. Tile edges are vignetted into the black
 * background, so thresholding them is unreliable — the crop is derived from
 * the glow centres, which are unambiguous.
 */

const src = process.argv[2] ?? '96748366-cba3-48d2-8b71-b5f0233d9b80.png'
const SIZE = 400
const centres = { x: [300, 773, 1249], y: [281, 735] }
const names = ['purple', 'gold', 'red', 'teal', 'blue', 'magenta']

let index = 0
for (const cy of centres.y) {
  for (const cx of centres.x) {
    const name = names[index++]
    const dir = `public/logos/${name}`
    mkdirSync(dir, { recursive: true })

    const tile = sharp(src).extract({
      left: cx - SIZE / 2,
      top: cy - SIZE / 2,
      width: SIZE,
      height: SIZE,
    })

    // Sizes: 512 and 192 for the manifest, 180 for iOS (which applies its own
    // corner mask), and a 64 for the sidebar.
    for (const size of [512, 192, 64]) {
      await tile.clone().resize(size, size).png({ compressionLevel: 9 }).toFile(`${dir}/icon-${size}.png`)
    }
    await tile.clone().resize(180, 180).png({ compressionLevel: 9 }).toFile(`${dir}/apple-touch-icon.png`)
    console.log('wrote', name)
  }
}
