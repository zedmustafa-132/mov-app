#!/usr/bin/env node
// Generate MOV's primary app icons and native launch art without external dependencies.
// Alternate icons remain the user's separate choices and are owned by app-icons.mjs.
// Usage: node scripts/mov-brand.mjs [--check]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { ROOT, drawArt, png, pngInfo } from './app-icons.mjs'

const bg = [17, 16, 15]
const art = readFileSync(join(ROOT, 'resources/icons/mov.svg'), 'utf8')
const foreground = art.replace(/<rect\b[^>]*\/>/, '')
const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
const cache = new Map()
const icon = (size, mode = 'square') => {
  const key = `icon:${size}:${mode}`
  if (!cache.has(key)) cache.set(key, drawArt(mode === 'foreground' ? foreground : art, size, { round: mode === 'round', transparent: mode === 'foreground' }))
  return cache.get(key)
}

// This only decodes the RGB/filter-0 PNGs produced by our own renderer above.
function pixelsOf(buf) {
  const { width, height, alpha } = pngInfo(buf)
  if (alpha) throw new Error('Native splash compositor expects an opaque mark')
  const chunks = []
  for (let pos = 8; pos < buf.length;) {
    const length = buf.readUInt32BE(pos)
    if (buf.toString('ascii', pos + 4, pos + 8) === 'IDAT') chunks.push(buf.subarray(pos + 8, pos + 8 + length))
    pos += 12 + length
  }
  const rows = inflateSync(Buffer.concat(chunks))
  const pixels = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    if (rows[row] !== 0) throw new Error('Unsupported PNG filter in generated mark')
    rows.copy(pixels, y * width * 3, row + 1, row + 1 + width * 3)
  }
  return { width, height, pixels }
}

function solid(width, height) {
  const pixels = Buffer.alloc(width * height * 3)
  for (let p = 0; p < pixels.length; p += 3) { pixels[p] = bg[0]; pixels[p + 1] = bg[1]; pixels[p + 2] = bg[2] }
  return pixels
}

function splash(width, height) {
  const key = `splash:${width}:${height}`
  if (!cache.has(key)) {
    const pixels = solid(width, height)
    // Square iOS launch images fill a tall display; keep the mark compact after that crop.
    const fraction = width === height ? .18 : .36
    const mark = pixelsOf(icon(Math.max(32, Math.round(Math.min(width, height) * fraction))))
    const x = Math.round((width - mark.width) / 2), y = Math.round((height - mark.height) / 2)
    for (let r = 0; r < mark.height; r++) mark.pixels.copy(pixels, ((y + r) * width + x) * 3, r * mark.width * 3, (r + 1) * mark.width * 3)
    cache.set(key, png(width, height, pixels, 3))
  }
  return cache.get(key)
}

export function primaryFiles() {
  const files = [
    ['public/icon-180.png', () => icon(180)],
    ['public/icon-512.png', () => icon(512)],
    ['public/app-icons/default.png', () => icon(112)],
    ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', () => icon(1024)],
    ['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', () => Buffer.from(adaptiveIcon)],
    ['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', () => Buffer.from(adaptiveIcon)],
    ['android/app/src/main/res/values/ic_launcher_background.xml', () => Buffer.from('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#11100f</color>\n</resources>\n')]
  ]
  const res = join(ROOT, 'android/app/src/main/res')
  for (const dir of readdirSync(res, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    if (dir.name.startsWith('mipmap-')) {
      for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'ic_launcher_background.png']) {
        const path = join(res, dir.name, name)
        if (!existsSync(path)) continue
        const { width, height } = pngInfo(readFileSync(path))
        const mode = name.includes('foreground') ? 'foreground' : name.includes('round') ? 'round' : 'square'
        files.push([`android/app/src/main/res/${dir.name}/${name}`, () => name.includes('background') ? png(width, height, solid(width, height), 3) : icon(width, mode)])
      }
    }
    const launch = join(res, dir.name, 'splash.png')
    if (dir.name.startsWith('drawable') && existsSync(launch)) {
      const { width, height } = pngInfo(readFileSync(launch))
      files.push([`android/app/src/main/res/${dir.name}/splash.png`, () => splash(width, height)])
    }
  }
  const iosLaunch = 'ios/App/App/Assets.xcassets/Splash.imageset'
  for (const name of readdirSync(join(ROOT, iosLaunch)).filter(name => name.endsWith('.png'))) {
    const { width, height } = pngInfo(readFileSync(join(ROOT, iosLaunch, name)))
    files.push([`${iosLaunch}/${name}`, () => splash(width, height)])
  }
  return files
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check'), bad = []
  for (const [rel, make] of primaryFiles()) {
    const path = join(ROOT, rel), body = make()
    if (check) { if (!existsSync(path) || !readFileSync(path).equals(body)) bad.push(rel) }
    else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body) }
  }
  if (bad.length) { console.error('MOV primary assets need regeneration:\n' + bad.join('\n')); process.exit(1) }
  console.log(check ? 'MOV primary assets up to date' : 'MOV primary assets written')
}
