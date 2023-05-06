import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import  createDebug from 'debug'
import { version, description } from '../../package.json'
import convert from 'bech32-converting'
import { getPublicKey, nip06 } from 'nostr-tools'

const PUBLIC_KEY_PREFIX = 'npub'
const SECRET_KEY_PREFIX = 'nsec'
const debug = createDebug('nip06:main')

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//

process.env.ELECTRON_NODE_INTEGRATION = process.env.ELECTRON
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST


debug('Application environment')
debug(`  DIST_ELECTRON            : ${process.env.DIST_ELECTRON}`)
debug(`  DIST                     : ${process.env.DIST}`)
debug(`  PUBLIC                   : ${process.env.PUBLIC}`)
debug(`  ELECTRON_NODE_INTEGRATION: ${process.env.ELECTRON_NODE_INTEGRATION || false}`)


// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) {
  debug('Disabling GPU Acceleration')
  app.disableHardwareAcceleration()
}

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') {
  debug('Setting application name for Windows notifications')
  app.setAppUserModelId(app.getName())
}

if (!app.requestSingleInstanceLock()) {
  debug('Requesting single instance lock')
  app.quit()
  process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
function logger (channel: string, msg: any): void {
  const __msg__ = `[${channel}] ${msg}`
  debug(__msg__)
  win.webContents.send('window:log:success', __msg__)
}

// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')
const title = `${description} | v${version}`
const icon = join(process.env.PUBLIC, 'favicon.ico')

debug('Application variables')
debug(`  preload   : ${preload}`)
debug(`  url       : ${url}`)
debug(`  index.html: ${indexHtml}`)
debug(`  title     : ${title}`)
debug(`  icon      : ${icon}`)

async function createWindow() {
  win = new BrowserWindow({
    title: title,
    icon: icon,
    show: false,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: false,
      contextIsolation: true,
      //enableRemoteModule: process.env.ELECTRON_NODE_INTEGRATION || false
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    debug(`loading ${url}`)
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    debug(`loading ${indexHtml}`)
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    debug('Testing actively push message to Electron-Renderer')
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      debug(`Opening external ${url} on browser`)
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  win.maximize()
  win.show()
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  debug('All windows closed: quiting')
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  debug('Trying to opening a second instance')
  if (win) {
    debug('Focusing on the main window')
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  logger('nip06:main', 'NIP06 | Electron running')
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

debug('Configuring ipcMain nip06 handlers')

debug('  nip06:get:version')
ipcMain.handle('nip06:get:version', function(_, arg) { 
  try {
    logger('nip06:get:version', `version ${version}`)
    win.webContents.send('nip06:get:version:success', version)
  } catch (error) {
    logger('nip06:get:version', error)    
    win.webContents.send('nip06::get:version:error', error)
  }
})

debug('  nip06:generate:seed')
ipcMain.handle('nip06:generate:seed', (_, arg) => {
  try {
    logger('nip06:generate:seed', 'Generating new mnemonic')
    const mnemonic = nip06.generateSeedWords()
    win.webContents.send('nip06:generate:seed:success', mnemonic)
    logger('nip06:generate:seed', 'New mnemonic generated')
  } catch (error) {
    logger('nip06:generate:seed', error)
    win.webContents.send('nip06:generate:seed:error', error)
  }
})

debug('  nip06:validate:seed')
ipcMain.handle('nip06:validate:seed', (_, words) => {
  try {
    logger('nip06:validate:seed', 'Validating words')
    const isMnemonicValid = nip06.validateWords(words)
    logger('nip06:validate:seed', `Mnemonic is valid: ${isMnemonicValid}`)
    win.webContents.send('nip06:validate:seed:success', isMnemonicValid)
  } catch (error) { 
    logger('nip06:validate:seed', error)
    win.webContents.send('nip06:validate:seed:error', error)
  }
})

debug('  nip06:create:keys:hex')
ipcMain.handle('nip06:create:keys:hex', (_, data) => { 
  try {
    logger('nip06:create:keys:hex', 'Creating hex keys from seed words')
    const prv = nip06.privateKeyFromSeedWords(data.mnemonic, data.passphrase)
    const pub = getPublicKey(prv)
    win.webContents.send('nip06:create:keys:hex:success', {
      prv: prv,
      pub: pub
    })
    logger('nip06:create:keys:hex', 'Hex key pair created')
  } catch (error) {
    logger('nip06:create:keys:hex', error)
    win.webContents.send('nip06:create:keys:hex:error', error)
  }
})

debug('  nip06:create:keys:bech32')
ipcMain.handle('nip06:create:keys:bech32', (_, data) => { 
  try {
    logger('nip06:create:keys:bech32', 'Creating bech32 keys from seed words') 
    const prv = nip06.privateKeyFromSeedWords(data.mnemonic, data.passphrase)
    const pub = getPublicKey(prv)
    const bech32prv = convert(SECRET_KEY_PREFIX).toBech32(prv)
    const bech32pub = convert(PUBLIC_KEY_PREFIX).toBech32(pub)
    win.webContents.send('nip06:create:keys:bech32:success', {
      prv: bech32prv,
      pub: bech32pub
    })
    logger('nip06:create:keys:bech32', 'Bech32 key pair created')
  } catch (error) { 
    logger('nip06:create:keys:bech32', error)
    win.webContents.send('nip06:create:keys:bech32:error', error)
  }
})

// New window example arg: new windows url
/*
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
*/
