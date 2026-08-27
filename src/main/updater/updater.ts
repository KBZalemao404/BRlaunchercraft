import { BrowserWindow, shell } from 'electron'
import Logger from '../logger/logger'
import { app } from 'electron'
import * as https from 'https'
import * as http from 'http'

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
  info?: { version: string; releaseDate: string; releaseNotes?: string; fileUrl?: string }
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
            fileUrl: result.fileUrl
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

  // ── Download & Install ──

  async downloadUpdate(): Promise<void> {
    if (!this.state.info?.fileUrl) {
      throw new Error('Nenhuma URL de download disponível')
    }
    this.updateState({ status: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 } })

    // Track download on server
    this.reportDownload(this.state.info.version)

    // Open download URL in default browser
    this.logger.info('updater', `Opening download: ${this.state.info.fileUrl}`)
    await shell.openExternal(this.state.info.fileUrl)

    // Mark as downloaded (user will install manually from browser download)
    this.updateState({ status: 'downloaded' })
  }

  async installUpdate(): Promise<void> {
    if (!this.state.info?.fileUrl) return
    // Re-open the download URL
    await shell.openExternal(this.state.info.fileUrl)
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
