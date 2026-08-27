import { BrowserWindow, shell } from 'electron'
import Logger from '../logger/logger'
import { app } from 'electron'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://minecraft-launcher-updates.vercel.app'
const HEARTBEAT_INTERVAL = 1_000

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateState {
  status: UpdateStatus
  info?: { version: string; releaseDate: string; releaseNotes?: string; fileUrl?: string; fileName?: string }
  progress?: UpdateProgress
  error?: string
  currentVersion: string
}

export class LauncherUpdater {
  private logger: Logger
  private mainWindow: BrowserWindow | null = null
  private state: UpdateState
  private updateCheckInterval: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private abortController: AbortController | null = null

  constructor(logger: Logger) {
    this.logger = logger
    this.state = { status: 'idle', currentVersion: app.getVersion() }
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  private updateState(partial: Partial<UpdateState>) {
    this.state = { ...this.state, ...partial }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:state', this.state)
    }
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  // ── Update Check (Vercel Server) ──

  async checkForUpdatesViaServer(): Promise<UpdateState> {
    try {
      this.updateState({ status: 'checking' })
      const url = `${UPDATE_SERVER_URL}/api/update?current=${app.getVersion()}&channel=latest`
      const data = await this.httpGet(url)
      const result = JSON.parse(data)

      if (result.updateAvailable) {
        this.logger.info('updater', `Update v${result.version} available!`)
        this.updateState({
          status: 'available',
          info: {
            version: result.version,
            releaseDate: result.releaseDate,
            releaseNotes: result.releaseNotes,
            fileUrl: result.fileUrl,
            fileName: result.fileName
          }
        })
      } else {
        this.logger.info('updater', 'No update available')
        this.updateState({ status: 'not-available' })
      }
      return this.state
    } catch (err: any) {
      this.logger.error('updater', `Server check failed: ${err.message}`)
      this.updateState({ status: 'error', error: `Servidor indisponível: ${err.message}` })
      return this.state
    }
  }

  // ── Download (In-App) ──

  async downloadUpdate(): Promise<void> {
    if (!this.state.info?.version) {
      throw new Error('Nenhuma atualização disponível')
    }

    const version = this.state.info.version
    const fileName = this.state.info.fileName || `MinecraftLauncherSetup-${version}.exe`
    
    // Create temp directory for updates
    const updatesDir = path.join(app.getPath('temp'), 'minecraft-launcher-updates')
    if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true })

    const destPath = path.join(updatesDir, fileName)

    // If already downloaded, skip
    if (fs.existsSync(destPath)) {
      this.logger.info('updater', `Update already downloaded: ${destPath}`)
      this.updateState({ status: 'downloaded' })
      return
    }

    this.updateState({ status: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 } })

    // Track download on server
    this.reportDownload(version)

    // Download via Vercel proxy
    const downloadUrl = `${UPDATE_SERVER_URL}/api/fetch-update?version=${version}`
    this.logger.info('updater', `Downloading update v${version} from: ${downloadUrl}`)

    try {
      await this.downloadFile(downloadUrl, destPath)
      this.logger.info('updater', `Update downloaded to: ${destPath}`)
      this.updateState({ status: 'downloaded' })
    } catch (err: any) {
      this.logger.error('updater', `Download failed: ${err.message}`)
      // Clean up partial file
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath) } catch {}
      this.updateState({ status: 'error', error: `Falha no download: ${err.message}` })
      throw err
    }
  }

  // ── Install (Run Installer) ──

  async installUpdate(): Promise<void> {
    const version = this.state.info?.version
    if (!version) return

    const fileName = this.state.info?.fileName || `MinecraftLauncherSetup-${version}.exe`
    const updatesDir = path.join(app.getPath('temp'), 'minecraft-launcher-updates')
    const installerPath = path.join(updatesDir, fileName)

    if (!fs.existsSync(installerPath)) {
      throw new Error('Instalador não encontrado. Baixe novamente.')
    }

    this.logger.info('updater', `Running installer: ${installerPath}`)
    
    // Run the installer and close the launcher
    await shell.openPath(installerPath)
    
    // Give the installer a moment to start, then close the launcher
    setTimeout(() => {
      app.quit()
    }, 1000)
  }

  // ── Cancel Download ──

  cancelDownload(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.state.status === 'downloading') {
      this.updateState({ status: 'available' })
    }
  }

  // ── Auto Check ──

  startAutoCheck(intervalMs = 30 * 60 * 1000) {
    this.stopAutoCheck()
    setTimeout(() => { this.checkForUpdatesViaServer().catch(() => {}) }, 30_000)
    this.updateCheckInterval = setInterval(() => { this.checkForUpdatesViaServer().catch(() => {}) }, intervalMs)
  }

  stopAutoCheck() {
    if (this.updateCheckInterval) { clearInterval(this.updateCheckInterval); this.updateCheckInterval = null }
  }

  // ── Heartbeat (keep server alive) ──

  startHeartbeat(intervalMs = HEARTBEAT_INTERVAL) {
    this.stopHeartbeat()
    const send = async () => {
      try {
        const url = `${UPDATE_SERVER_URL}/api/heartbeat`
        const body = JSON.stringify({ version: app.getVersion(), platform: process.platform })
        const parsedUrl = new URL(url)
        const client = parsedUrl.protocol === 'https:' ? https : http
        const req = client.request(parsedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body).toString() }
        })
        req.on('error', () => {})
        req.write(body)
        req.end()
      } catch {}
    }
    setTimeout(send, 2_000)
    this.heartbeatInterval = setInterval(send, intervalMs)
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null }
  }

  destroy() {
    this.cancelDownload()
    this.stopAutoCheck()
    this.stopHeartbeat()
    this.mainWindow = null
  }

  // ── Server Reporting ──

  async reportDownload(version: string): Promise<void> {
    try {
      const url = `${UPDATE_SERVER_URL}/api/download`
      const body = JSON.stringify({ version })
      const parsedUrl = new URL(url)
      const client = parsedUrl.protocol === 'https:' ? https : http
      const req = client.request(parsedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body).toString() }
      })
      req.on('error', () => {})
      req.write(body)
      req.end()
    } catch {}
  }

  // ── Download Helper ──

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.abortController = new AbortController()
      const client = url.startsWith('https') ? https : http

      const req = client.get(url, {
        timeout: 120000, // 2 min timeout for large files
        headers: { 'User-Agent': 'MinecraftLauncher/' + app.getVersion() }
      }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          this.downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        let lastBytes = 0
        let lastTime = Date.now()

        const file = fs.createWriteStream(destPath)

        res.on('data', (chunk) => {
          downloaded += chunk.length

          const now = Date.now()
          const elapsed = (now - lastTime) / 1000
          const speed = elapsed >= 0.5 ? Math.round((downloaded - lastBytes) / elapsed) : 0

          if (elapsed >= 0.5 || downloaded === totalSize) {
            const percent = totalSize > 0 ? Math.min(99, Math.round((downloaded / totalSize) * 100)) : 0
            this.updateState({
              progress: {
                percent,
                transferred: downloaded,
                total: totalSize,
                bytesPerSecond: speed
              }
            })
            lastBytes = downloaded
            lastTime = now
          }
        })

        res.pipe(file)

        file.on('finish', () => {
          file.close()
          this.updateState({
            progress: { percent: 100, transferred: downloaded, total: totalSize, bytesPerSecond: 0 }
          })
          resolve()
        })

        file.on('error', (err) => {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          reject(err)
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Download timeout'))
      })

      // Store req for abort
      ;(this.abortController as any)._req = req
    })
  }

  // ── HTTP Helper ──

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http
      client.get(url, { timeout: 10000, headers: { 'User-Agent': 'MinecraftLauncher/' + app.getVersion() } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          this.httpGet(res.headers.location).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
        let data = ''
        res.on('data', (c) => data += c)
        res.on('end', () => resolve(data))
      }).on('error', reject)
    })
  }
}
