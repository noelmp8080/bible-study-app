import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../bible_icon.png')
const out = (name) => resolve(__dirname, '../public', name)

await sharp(src).resize(512, 512).png().toFile(out('pwa-512.png'))
await sharp(src).resize(192, 192).png().toFile(out('pwa-192.png'))
await sharp(src).resize(180, 180).png().toFile(out('apple-touch-icon.png'))
await sharp(src).resize(32, 32).png().toFile(out('favicon-32.png'))
console.log('Icons generated.')
