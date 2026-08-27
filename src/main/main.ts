import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import Logger from './logger/logger'
import { Storage } from './storage/database'
import { DownloadManager } from './downloader/manager'
import { JavaManager } from './java/manager'
import { VersionManager } from './minecraft/versions'
import { InstanceManager } from './instances/manager'
import { AuthManager } from './auth/manager'
import { ProcessManager } from './process/manager'
import { ModManager } from './mods/manager'
import { LauncherUpdater } from './updater'
import { AppSettings, SystemInfo } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const appDataPath = app.getPath('userData')

// Initialize services
const logger = new Logger(path.join(appDataPath, 'logs'))
const storage = new Storage(appDataPath)
const downloadManager = new DownloadManager({ maxConcurrent: 4 })
const javaManager = new JavaManager()
const versionManager = new VersionManager(downloadManager, storage)
const instanceManager = new InstanceManager(storage)
const authManager = new AuthManager(path.join(appDataPath, 'auth', 'tokens.dat'))
const processManager = new ProcessManager(storage, javaManager, instanceManager)
const modManager = new ModManager(storage, downloadManager, instanceManager)
const updater = new LauncherUpdater(logger)

// Default settings
function getSettings(): AppSettings {
  const saved = storage.getAllSettings()
  return {
    javaPath: saved.javaPath || '', autoDetectJava: saved.autoDetectJava !== 'false',
    minMemory: parseInt(saved.minMemory) || 512, maxMemory: parseInt(saved.maxMemory) || 2048,
    jvmArgs: saved.jvmArgs || '', resolution: { width: parseInt(saved.resWidth) || 854, height: parseInt(saved.resHeight) || 480 },
    fullscreen: saved.fullscreen === 'true', closeOnGameStart: saved.closeOnGameStart === 'true',
    keepLauncherOpen: saved.keepLauncherOpen !== 'false', showConsole: saved.showConsole !== 'false',
    verifyFiles: saved.verifyFiles !== 'false', downloadDir: saved.downloadDir || path.join(appDataPath, 'downloads'),
    maxConcurrentDownloads: parseInt(saved.maxConcurrentDownloads) || 4, theme: 'dark',
    language: saved.language || 'pt-BR', gameDir: saved.gameDir || path.join(appDataPath, 'instances'),
    launcherVersion: '0.1.0'
  }
}

function saveSettings(s: AppSettings): void {
  const entries: [string, string][] = [
    ['javaPath', s.javaPath], ['autoDetectJava', String(s.autoDetectJava)],
    ['minMemory', String(s.minMemory)], ['maxMemory', String(s.maxMemory)],
    ['jvmArgs', s.jvmArgs], ['resWidth', String(s.resolution.width)], ['resHeight', String(s.resolution.height)],
    ['fullscreen', String(s.fullscreen)], ['closeOnGameStart', String(s.closeOnGameStart)],
    ['keepLauncherOpen', String(s.keepLauncherOpen)], ['showConsole', String(s.showConsole)],
    ['verifyFiles', String(s.verifyFiles)], ['downloadDir', s.downloadDir],
    ['maxConcurrentDownloads', String(s.maxConcurrentDownloads)], ['language', s.language],
    ['gameDir', s.gameDir]
  ]
  for (const [k, v] of entries) storage.setSetting(k, v)
}

function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data ?? null)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 960, minHeight: 640,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#050508',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
    icon: path.join(__dirname, '../../assets/icon.png'), show: false
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  updater.setMainWindow(mainWindow)
  mainWindow.on('closed', () => { mainWindow = null })
}

// ═══════ IPC HANDLERS ═══════

// Window
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize() })
ipcMain.on('window-close', () => mainWindow?.close())

// System
ipcMain.handle('system:info', (): SystemInfo => ({
  platform: process.platform, arch: process.arch, cpus: os.cpus().length,
  totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
  freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)), hostname: os.hostname()
}))
ipcMain.handle('system:select-directory', async () => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('system:select-file', async (_, filters) => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: filters || [{ name: 'All', extensions: ['*'] }] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('system:select-files', async (_, filters) => {
  const r = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile', 'multiSelections'], filters: filters || [{ name: 'Java Archive', extensions: ['jar'] }] })
  return r.canceled ? null : r.filePaths
})
ipcMain.handle('system:open-url', (_, url) => { if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url) })
ipcMain.handle('system:open-folder', (_, p) => { if (fs.existsSync(p)) shell.openPath(p) })

// Settings
ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:save', (_, s: AppSettings) => { saveSettings(s); downloadManager.setMaxConcurrent(s.maxConcurrentDownloads); return s })

// Java
ipcMain.handle('java:detect', () => javaManager.detectAll())
ipcMain.handle('java:verify', (_, p) => javaManager.verify(p))

// Auth
ipcMain.handle('auth:get-account', () => authManager.getAccount())
ipcMain.handle('auth:start-device-code', async () => await authManager.startDeviceCodeFlow())
ipcMain.handle('auth:logout', () => { authManager.logout(); return true })
ipcMain.handle('auth:login-offline', (_, username: string) => authManager.loginOffline(username))
authManager.on('auth-progress', (m) => sendToRenderer('auth-progress', m))
authManager.on('auth-success', (a) => sendToRenderer('auth-success', a))
authManager.on('auth-error', (m) => sendToRenderer('auth-error', m))
authManager.on('auth-expired', () => sendToRenderer('auth-expired'))

// Versions
ipcMain.handle('versions:manifest', async (_, force) => await versionManager.fetchManifest(force))
ipcMain.handle('versions:installed', () => storage.getInstalledVersions())
ipcMain.handle('versions:install', async (_, { versionId, versionUrl, versionType }) => {
  return await versionManager.installVersion(versionId, versionUrl, versionType)
})
ipcMain.handle('versions:uninstall', async (_, id) => { await versionManager.uninstallVersion(id); return true })
ipcMain.handle('versions:verify', async (_, id) => await versionManager.verifyVersion(id))
versionManager.setProgressCallback((versionId, progress) => sendToRenderer('version-progress', { versionId, ...progress }))

// Instances
ipcMain.handle('instances:list', () => instanceManager.list())
ipcMain.handle('instances:get', (_, id) => instanceManager.get(id))
ipcMain.handle('instances:create', (_, d) => instanceManager.create(d))
ipcMain.handle('instances:update', (_, id, u) => instanceManager.update(id, u))
ipcMain.handle('instances:delete', (_, id) => { if (processManager.isRunning(id)) processManager.stop(id); instanceManager.delete(id); return true })
ipcMain.handle('instances:open-folder', (_, id) => { const i = instanceManager.get(id); if (i) shell.openPath(i.gameDir) })

// Downloads
ipcMain.handle('downloads:status', () => downloadManager.getStatus())
ipcMain.handle('downloads:cancel', (_, id) => { downloadManager.cancelTask(id); return true })
ipcMain.handle('downloads:cancel-group', (_, id) => { downloadManager.cancelGroup(id); return true })
ipcMain.handle('downloads:clear', () => { downloadManager.clearCompleted(); return true })
downloadManager.on('task-progress', (d) => sendToRenderer('download-progress', d))
downloadManager.on('task-completed', (d) => sendToRenderer('download-completed', d))
downloadManager.on('task-failed', (d) => sendToRenderer('download-failed', d))

// Mods
ipcMain.handle('mods:list', (_, id) => modManager.listMods(id))
ipcMain.handle('mods:install', async (_, { instanceId, filePaths }) => await modManager.installMod(instanceId, filePaths))
ipcMain.handle('mods:uninstall', (_, { instanceId, modFilename }) => { modManager.uninstallMod(instanceId, modFilename); return true })
ipcMain.handle('mods:toggle', (_, { instanceId, modFilename }) => modManager.toggleMod(instanceId, modFilename))
ipcMain.handle('mods:open-folder', (_, id) => modManager.openModsFolder(id))
ipcMain.handle('mods:install-fabric', async (_, { instanceId, fabricVersion, minecraftVersion }) => await modManager.installFabric(instanceId, fabricVersion, minecraftVersion))
ipcMain.handle('mods:install-forge', async (_, { instanceId, forgeVersion, minecraftVersion }) => await modManager.installForge(instanceId, forgeVersion, minecraftVersion))

// Game
ipcMain.handle('game:launch', async (_, { instanceId }) => {
  const account = authManager.getAccount()
  if (!account) throw new Error('Faça login (Microsoft ou Offline) para jogar.')
  return await processManager.launch(instanceId, account)
})
ipcMain.handle('game:stop', (_, id) => processManager.stop(id))
ipcMain.handle('game:status', (_, id) => processManager.getStatus(id))
processManager.on('game-launched', (d) => sendToRenderer('game-launched', d))
processManager.on('game-exited', (d) => sendToRenderer('game-exited', d))
processManager.on('game-error', (d) => sendToRenderer('game-error', d))
processManager.on('game-log', (d) => sendToRenderer('game-log', d))
processManager.on('log', (d) => sendToRenderer('launcher-log', d))

// News
ipcMain.handle('news:fetch', async () => {
  try {
    const https = require('https')
    return await new Promise<any[]>((resolve) => {
      https.get('https://www.minecraft.net/api/news', { headers: { 'User-Agent': 'MinecraftLauncher/1.0' }, timeout: 10000 }, (res: any) => {
        if (res.statusCode !== 200) { res.resume(); return resolve([]) }
        let body = ''; res.on('data', (c: any) => body += c)
        res.on('end', () => {
          try { const a = JSON.parse(body); resolve((a.articles || a || []).slice(0, 20).map((x: any, i: number) => ({ id: x.id || String(i), title: x.title || '', date: x.publish_date || new Date().toISOString(), summary: x.description || '', imageUrl: x.image?.url || '', category: x.category || 'Minecraft', url: x.url || '' }))) } catch { resolve([]) }
        })
      }).on('error', () => resolve([]))
    })
  } catch { return [] }
})

// Diagnostics
ipcMain.handle('diagnostics:export', () => JSON.stringify({
  version: '0.1.0', timestamp: new Date().toISOString(), platform: process.platform,
  arch: process.arch, nodeVersion: process.version, electronVersion: process.versions.electron,
  javaInstalls: javaManager.detectAll().length,
  installedVersions: Object.keys(storage.getInstalledVersions()),
  instances: instanceManager.list().map(i => ({ id: i.id, name: i.name, version: i.versionId })),
  account: authManager.getAccount() ? { username: authManager.getAccount()!.username } : null
}, null, 2))

// ═══════ UPDATER ═══════
ipcMain.handle('update:check', async () => {
  const result = await updater.checkForUpdatesViaServer()
  return result
})
ipcMain.handle('update:download', async () => {
  await updater.downloadUpdate()
})
ipcMain.handle('update:install', () => {
  updater.installUpdate()
})
ipcMain.handle('update:state', () => updater.getState())
// Updater state is already forwarded via sendToRenderer inside the updater class

// ═══════ APP LIFECYCLE ═══════

app.whenReady().then(() => {
  javaManager.detectAll()
  logger.info('main', `Launcher started on ${process.platform} ${process.arch}`)
  createWindow()
  updater.startAutoCheck()
  updater.startHeartbeat()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('before-quit', () => {
  for (const [id] of processManager['processes']) processManager.stop(id)
  logger.info('main', 'Launcher shutting down')
  updater.stopHeartbeat()
  updater.destroy()
  storage.close()
})
