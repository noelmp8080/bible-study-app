import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="36" fill="#16213e"/>
  <g fill="#e8c96d">
    <!-- Body -->
    <ellipse cx="118" cy="150" rx="54" ry="27" transform="rotate(-8,118,150)"/>
    <!-- Head -->
    <circle cx="166" cy="116" r="25"/>
    <!-- Neck -->
    <ellipse cx="146" cy="134" rx="20" ry="18"/>
    <!-- Wing sweeping up-left -->
    <path d="M108,128 C95,100 70,78 44,74 C58,96 78,114 102,124 Z"/>
    <!-- Secondary wing -->
    <path d="M90,148 C70,140 46,146 36,162 C54,162 74,154 90,148 Z"/>
    <!-- Tail feather 1 -->
    <path d="M66,158 L36,143 L30,168 L62,168 Z"/>
    <!-- Tail feather 2 -->
    <path d="M64,168 L28,180 L34,206 L64,178 Z"/>
    <!-- Beak -->
    <polygon points="189,110 214,120 189,130"/>
    <!-- Eye -->
    <circle cx="171" cy="110" r="7" fill="#16213e"/>
  </g>
</svg>`

const pngPath = join(publicDir, 'icon.png')
const icoPath = join(publicDir, 'icon.ico')

console.log('Generating icon.png from SVG...')
await sharp(Buffer.from(svg))
  .png()
  .toFile(pngPath)

console.log('icon.png written to', pngPath)

console.log('Converting icon.png → icon.ico...')
const icoBuffer = await pngToIco(pngPath)
writeFileSync(icoPath, icoBuffer)

console.log('icon.ico written to', icoPath, '—', icoBuffer.length, 'bytes')
