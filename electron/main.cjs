const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const https = require('https')

// Load .env — works in dev and in packaged app (dotenv reads from asar via Electron's fs patch)
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') })
} catch {}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bible Study App',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.loadFile(path.join(__dirname, '../dist/index.html'))
}

// ── IPC: Anthropic API call (main process — bypasses renderer CSP/CORS) ──────
ipcMain.handle('ask-scholar', async (_event, messages, systemPrompt) => {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const body = JSON.stringify({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    system:     systemPrompt,
    messages,
  })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length':  Buffer.byteLength(body),
        },
      },
      res => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) reject(new Error(parsed.error.message))
            else resolve(parsed.content?.[0]?.text ?? 'No response received.')
          } catch {
            reject(new Error('Failed to parse API response'))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
