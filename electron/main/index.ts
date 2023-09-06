import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import  createDebug from 'debug'
import { version, description } from '../../package.json'
import convert from 'bech32-converting'
import { getPublicKey, nip06 } from 'nostr-tools'

// See https://github.com/mikedilger/nips/blob/nip-nn-key-export/49.md#encrypting-a-private-key
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { StartLoggingOptions } from 'electron/common'

const PUBLIC_KEY_PREFIX = 'npub'
// const SECRET_KEY_PREFIX = 'nsec'
const ENCRYPTED_KEY_PREFIX = 'ncrypt'
const KEY_SECURITY_KEY = 0x02
const SALT_LENGTH = 16
const NONCE_LENGTH = 24

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

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST


debug('Application environment')
debug(`  DIST_ELECTRON            : ${process.env.DIST_ELECTRON}`)
debug(`  DIST                     : ${process.env.DIST}`)
debug(`  PUBLIC                   : ${process.env.PUBLIC}`)


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


// Encrypting a private key
// The private key encryption process is as follows:
//
// PRIVATE_KEY = User's private (secret) secpk256 key as 32 raw bytes (not hex or bech32 encoded!)
// KEY_SECURITY_BYTE = one of:
//   - 0x00 - if the key has been known to have been handled insecurely (stored unencrypted, cut and paste unencrypted, etc)
//   - 0x01 - if the key has NOT been known to have been handled insecurely (stored unencrypted, cut and paste unencrypted, etc)
//   - 0x02 - if the client does not track this datac
// ASSOCIATED_DATA = KEY_SECURITY_BYTE
// NONCE = 24 byte nonce generated with the help of XChaCha20-Poly1305 (use that algorithm's nonce generator)
// CIPHERTEXT = XChaCha20-Poly1305( plaintext=PRIVATE_KEY, associated_data=ASSOCIATED_DATA, nonce=NONCE, key=SYMMETRIC_KEY )
// VERSION_NUMBER = 0x02
// CIPHERTEXT_CONCATENATION = concat( VERSION_NUMBER, LOG_N, SALT, NONCE, ASSOCIATED_DATA, CIPHERTEXT )
// ENCRYPTED_PRIVATE_KEY = bech32_encode('ncryptsec', CIPHERTEXT_CONCATENATION)
//
// The output prior to bech32 encoding should be 91 bytes long.
// The decryption process operates in the reverse.

// ENCRIPTION
// openssl enc \
//    -chacha20
//    -base64 \
//    -salt ${salt} \
//    -iv ${initVector}
//    -e \ (ENCRYPT)
//    -md ${sha512 - default} \
//    -iter ${iterations} \
//    -in <(echo '${myStringToEncrypt}') \
//    -k='${password}'
async function encryptPrivateKey (
  prv: string,
  password: string,
  digest: 'sha256' | 'sha512' = 'sha512', 
  iterations: number = 10000
): Promise<string> {
  return new Promise(function (resolve, reject){
  
    let shell: string;
    let compileArg: string;
    let opensslBin: string;
  
    if (process.platform === 'linux') {
      shell = '/bin/bash'
      compileArg = '-c'
      opensslBin = 'openssl'
    } else if (process.platform === 'darwin') {
      shell = '/bin/zsh'
      SVGFECompositeElementArg = '-c'
      opensslBin = 'openssl'
    } else if (process.platform === 'win32') {
      shell = 'cmd'
      opensslBin = 'openssl.exe'
    }
  
    if (process.platform === 'linux' || process.platform === 'darwin') {
      const salt = randomBytes(SALT_LENGTH)
      const initVector = randomBytes(NONCE_LENGTH)
      const opensslCmd = [
        opensslBin,
        'enc',
        '-chacha20',
        '-base64',
        `-p`,
        `-e`,
        `-md=${digest}`,
        `-iter=${iterations}`,
        `-in <(echo '${prv}')`,
        `-k='${password}'`
      ].join(' ')

      debug(opensslCmd)
      let stdout = Buffer.alloc(0)
      let isErr = false
      const openssl = spawn(shell, [compileArg, opensslCmd])
      
      openssl.stdout.on('data', function (chunk) {
        debug(`stdout: ${chunk}`)
        stdout = Buffer.concat([stdout, chunk])
      })

      openssl.stderr.on('data', function (chunk) {
        debug(`stderr: ${chunk}`)
        stdout = Buffer.concat([stdout, chunk])
        isErr = true
      })

      openssl.on('error', function (error) {
        reject(error)
      })

      openssl.on('close', function (code) {
        if (code > 0 && !isErr) {
          reject(new Error('Unknow error'))
        } else if (code >0 && isErr) {
          reject(new Error(stdout.toString()))
        } else {
          const allOutput = stdout.toString()
          const salt = allOutput.exec(/salt=(.*)\n/g)[1].split('salt=')[1]
          const encrypted = Buffer.concat([
            Buffer.from(KEY_SECURITY_KEY.toString()),
            Buffer.from(SALT_LENGTH.toString()),
            salt,
            initVector,
            Buffer.from(KEY_SECURITY_KEY.toString()),
            stdout
          ]).toString('hex')
          resolve(encrypted)
        }
      })
    }
  })
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
     }
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
ipcMain.handle('nip06:get:version', function() { 
  try {
    logger('nip06:get:version', `version ${version}`)
    win.webContents.send('nip06:get:version:success', version)
  } catch (error) {
    logger('nip06:get:version', error)    
    win.webContents.send('nip06::get:version:error', error)
  }
})

debug('  nip06:generate:seed')
ipcMain.handle('nip06:generate:seed', () => {
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
ipcMain.handle('nip06:validate:seed', (_, words: string) => {
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

debug('  nip06:create:keys')
ipcMain.handle('nip06:create:keys', async (_, data) => { 
  try {
    logger('nip06:create:keys', 'Creating npub and encrypted nsec keys from seed words, passphrase and password')
    const prv = nip06.privateKeyFromSeedWords(data.mnemonic, data.passphrase)
    const pub = getPublicKey(prv)
    const encrypted = await encryptPrivateKey(prv, data.password)
    win.webContents.send('nip06:create:keys:success', {
      prv: convert(ENCRYPTED_KEY_PREFIX).toBech32(encrypted),
      pub: convert(PUBLIC_KEY_PREFIX).toBech32(pub)
    })
    logger('nip06:create:keys', 'Key pair created')
  } catch (error) {
    logger('nip06:create:keys', error)
    win.webContents.send('nip06:create:keys:error', error)
  }
})
