import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'
import Logger from '../logger/logger'
import { app } from 'electron'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

// ── Vercel Update Server Integration ──
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://minecraft-launcher-updates.vercel.app'
const HEARTBEAT_INTERVAL = 1_000 // 1 second

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateState {
  status: UpdateStatus
  info?: { version: string; releaseDate: string; releaseNotes?: string }
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
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion()
    }

    // Configure auto-updater
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    this.setupListeners()
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  private setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('updater', 'Verificando atualizações...')
      this.updateState({ status: 'checking' })
    })

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      this.logger.info('updater', `Atualização disponível: v${info.version}`)
      this.updateState({
        status: 'available',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes as string || undefined
        }
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.logger.info('updater', 'Nenhuma atualização disponível')
      this.updateState({ status: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.updateState({
        status: 'downloading',
        progress: {
          percent: Math.round(progress.percent),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond
        }
      })
    })

    autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      this.logger.info('updater', `Atualização baixada: v${info.version}`)
      this.updateState({
        status: 'downloaded',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes as string || undefined
        }
      })
    })

    autoUpdater.on('error', (err) => {
      this.logger.error('updater', `Erro no updater: ${err.message}`)
      this.updateState({ status: 'error', error: err.message })
    })
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

  async checkForUpdates(): Promise<UpdateState> {
    try {
      this.updateState({ status: 'checking' })
      const result = await autoUpdater.checkForUpdates()
      if (!result) {
        this.updateState({ status: 'not-available' })
      }
      return this.state
    } catch (err: any) {
      this.logger.error('updater', `Falha ao verificar: ${err.message}`)
      this.updateState({ status: 'error', error: err.message })
      return this.state
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.state.status !== 'available') {
      throw new Error('Nenhuma atualização disponível para baixar')
    }
    try {
      await autoUpdater.downloadUpdate()
    } catch (err: any) {
      this.logger.error('updater', `Falha ao baixar: ${err.message}`)
      this.updateState({ status: 'error', error: err.message })
      throw err
    }
  }

  async installUpdate(): Promise<void> {
    if (this.state.status !== 'downloaded') {
      throw new Error('Nenhuma atualização baixada para instalar')
    }
    this.logger.info('updater', 'Instalando atualização e reiniciando...')
    autoUpdater.quitAndInstall(false, true)
  }

  startAutoCheck(intervalMs = 30 * 60 * 1000) {
    this.stopAutoCheck()
    // Check 30 seconds after app starts
    setTimeout(() => {
      this.checkForUpdates().catch(() => {})
    }, 30_000)
    // Then check every intervalMs
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates().catch(() => {})
    }, intervalMs)
  }

  stopAutoCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }

  destroy() {
    this.stopAutoCheck()
    this.stopHeartbeat()
    this.mainWindow = null
  }

  // ── Vercel Server Integration ──

  /**
   * Send heartbeat to the update server every 1 second.
   * This keeps the Vercel server warm and reports client status.
   */
  startHeartbeat(intervalMs = HEARTBEAT_INTERVAL) {
    this.stopHeartbeat()

    const sendHeartbeat = async () => {
      try {
        const url = `${UPDATE_SERVER_URL}/api/heartbeat`
        const body = JSON.stringify({
          version: app.getVersion(),
          platform: process.platform
        })

        const parsedUrl = new URL(url)
        const client = parsedUrl.protocol === 'https:' ? https : http

        const req = client.request(parsedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        })

        req.on('response', (res) => {
          let data = ''
          res.on('data', (chunk) => data += chunk)
          res.on('end', () => {
            try {
              const response = JSON.parse(data)
              this.logger.debug('heartbeat', `Server: ${response.activeClients} clients, latest: v${response.latestVersion || '?'}`)
            } catch {}
          })
        })

        req.on('error', () => {}) // silently ignore heartbeat errors
        req.write(body)
        req.end()
      } catch {}
    }

    // Send first heartbeat after 2 seconds
    setTimeout(sendHeartbeat, 2_000)
    this.heartbeatInterval = setInterval(sendHeartbeat, intervalMs)
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Check for updates via the Vercel server (faster than GitHub releases).
   */
  async checkForUpdatesViaServer(): Promise<UpdateState> {
    try {
      this.updateState({ status: 'checking' })

      const url = `${UPDATE_SERVER_URL}/api/update?current=${app.getVersion()}&channel=latest`
      const data = await this.httpGet(url)
      const result = JSON.parse(data)

      if (result.updateAvailable) {
        this.logger.info('updater', `Vercel server: update v${result.version} available!`)
        this.updateState({
          status: 'available',
          info: {
            version: result.version,
            releaseDate: result.releaseDate,
            releaseNotes: result.releaseNotes
          }
        })

        // Store the download URL for later
        this._pendingDownloadUrl = result.fileUrl
        this._pendingBlockMapUrl = result.blockMapUrl
      } else {
        this.logger.info('updater', 'Vercel server: no update available')
        this.updateState({ status: 'not-available' })
      }

      return this.state
    } catch (err: any) {
      this.logger.error('updater', `Vercel server check failed: ${err.message}`)
      this.updateState({ status: 'error', error: `Servidor indisponível: ${err.message}` })
      return this.state
    }
  }

  private _pendingDownloadUrl: string | null = null
  private _pendingBlockMapUrl: string | null = null

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

  /**
   * Report download to the Vercel server for tracking.
   */
  async reportDownload(version: string): Promise<void> {
    try {
      const url = `${UPDATE_SERVER_URL}/api/download`
      const body = JSON.stringify({ version })
      const parsedUrl = new URL(url)
      const client = parsedUrl.protocol === 'https:' ? https : http

      const req = client.request(parsedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      })
      req.on('error', () => {})
      req.write(body)
      req.end()
    } catch {}
  }
}
