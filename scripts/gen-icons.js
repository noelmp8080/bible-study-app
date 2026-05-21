import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0d1117"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="#7c9ef5">✝</text>
</svg>`

const buf = Buffer.from(svg)
await sharp(buf).resize(192).png().toFile('public/pwa-192.png')
await sharp(buf).resize(512).png().toFile('public/pwa-512.png')
await sharp(buf).resize(180).png().toFile('public/apple-touch-icon.png')
console.log('Icons generated.')
