// Desktop shell for The Bible Study App.
//
// The built web app in dist/ is served over a private "app://" scheme rather
// than file://, so that it behaves like the website: fetch() works (the app
// downloads its Bible text that way), IndexedDB has a stable origin, and page
// URLs such as /read/john/3 resolve.
//
// There is no AI code and no secret here. The desktop app signs in and calls
// the same "scholar" Supabase Edge Function as the web app; the Anthropic key
// lives only in that function's secrets. The .env file is not packaged.
const { app, BrowserWindow, net, protocol, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const DIST = path.join(__dirname, '../dist')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'Bible Study App',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  })
  // Links to other sites open in the user's browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL('app://bundle/')
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    // Anything that is not a real file inside dist/ is an app route: serve the shell.
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html')
    }
    return net.fetch(pathToFileURL(file).toString())
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
