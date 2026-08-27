import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { validateHash } from '../security/security'

export interface DownloadTask {
  id: string
  url: string
  destPath: string
  sha1?: string
  size: number
  downloaded: number
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'paused'
  progress: number
  speed: number
  retries: number
  groupId: string
  name: string
  error?: string
  createdAt: string
}

export class DownloadManager extends EventEmitter {
  private tasks: Map<string, DownloadTask> = new Map()
  private maxConcurrent: number
  private maxRetries: number
  private timeout: number
  private activeCount = 0
  private queue: string[] = []
  private cancelled = new Set<string>()

  constructor(options?: { maxConcurrent?: number; maxRetries?: number; timeout?: number }) {
    super()
    this.maxConcurrent = options?.maxConcurrent || 4
    this.maxRetries = options?.maxRetries || 3
    this.timeout = options?.timeout || 30000
  }

  setMaxConcurrent(n: number) { this.maxConcurrent = n }

  addTask(params: { url: string; destPath: string; sha1?: string; size?: number; groupId?: string; name?: string }): string {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const task: DownloadTask = {
      id, url: params.url, destPath: params.destPath, sha1: params.sha1,
      size: params.size || 0, downloaded: 0, status: 'pending', progress: 0,
      speed: 0, retries: 0, groupId: params.groupId || 'default',
      name: params.name || path.basename(params.destPath), createdAt: new Date().toISOString()
    }
    this.tasks.set(id, task)
    this.queue.push(id)
    this.processQueue()
    return id
  }

  cancelTask(taskId: string): void {
    this.cancelled.add(taskId)
    const task = this.tasks.get(taskId)
    if (task) { task.status = 'cancelled'; this.emit('task-cancelled', { taskId }) }
  }

  cancelGroup(groupId: string): void {
    for (const [id, task] of this.tasks) {
      if (task.groupId === groupId && (task.status === 'pending' || task.status === 'downloading')) {
        this.cancelTask(id)
      }
    }
  }

  pauseTask(taskId: string): void {
    this.cancelled.add(taskId)
    const task = this.tasks.get(taskId)
    if (task && task.status === 'downloading') { task.status = 'paused'; this.emit('task-paused', { taskId }) }
  }

  resumeTask(taskId: string): void {
    this.cancelled.delete(taskId)
    const task = this.tasks.get(taskId)
    if (task && task.status === 'paused') { task.status = 'pending'; this.queue.push(taskId); this.processQueue() }
  }

  clearCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') this.tasks.delete(id)
    }
  }

  getStatus(): DownloadGroup[] {
    const groups: Record<string, DownloadGroup> = {}
    for (const [, task] of this.tasks) {
      if (!groups[task.groupId]) {
        groups[task.groupId] = { groupId: task.groupId, tasks: [], totalSize: 0, downloadedSize: 0, status: 'pending', createdAt: task.createdAt }
      }
      const g = groups[task.groupId]
      g.tasks.push(task)
      g.totalSize += task.size || 0
      g.downloadedSize += task.downloaded || 0
    }
    return Object.values(groups).map(g => {
      const allDone = g.tasks.every((t: any) => t.status === 'completed')
      const anyFailed = g.tasks.some((t: any) => t.status === 'failed')
      const anyActive = g.tasks.some((t: any) => t.status === 'downloading')
      g.status = anyActive ? 'downloading' : allDone ? 'completed' : anyFailed ? 'failed' : 'pending'
      return g
    })
  }

  private processQueue(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const taskId = this.queue.shift()!
      const task = this.tasks.get(taskId)
      if (task && task.status === 'pending' && !this.cancelled.has(taskId)) {
        this.activeCount++
        this.downloadFile(task).finally(() => { this.activeCount--; this.processQueue() })
      }
    }
  }

  private async downloadFile(task: DownloadTask): Promise<void> {
    task.status = 'downloading'
    const dir = path.dirname(task.destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    try {
      await this.doDownload(task)
      if (task.sha1 && !this.cancelled.has(task.id)) {
        if (!validateHash(task.destPath, task.sha1)) throw new Error(`Hash validation failed for ${task.name}`)
      }
      task.status = 'completed'
      task.progress = 100
      this.emit('task-completed', { taskId: task.id, groupId: task.groupId })
    } catch (err: any) {
      if (this.cancelled.has(task.id)) { task.status = 'cancelled'; return }
      task.retries++
      if (task.retries < this.maxRetries) {
        task.status = 'pending'; task.speed = 0
        this.queue.push(task.id)
        this.emit('task-retry', { taskId: task.id, retry: task.retries, error: err.message })
      } else {
        task.status = 'failed'; task.error = err.message
        this.emit('task-failed', { taskId: task.id, error: err.message })
      }
    }
  }

  private doDownload(task: DownloadTask): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.cancelled.has(task.id)) return reject(new Error('Cancelled'))
      const protocol = task.url.startsWith('https') ? https : http
      let lastBytes = 0, lastTime = Date.now()
      const req = protocol.get(task.url, { timeout: this.timeout, headers: { 'User-Agent': 'MinecraftLauncher/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); task.url = res.headers.location; this.doDownload(task).then(resolve).catch(reject); return
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${task.name}`)) }
        const totalSize = parseInt(res.headers['content-length'] || '0', 10) || task.size || 0
        task.size = totalSize
        const file = fs.createWriteStream(task.destPath)
        let downloaded = 0
        res.on('data', (chunk) => {
          downloaded += chunk.length; task.downloaded = downloaded
          task.progress = totalSize > 0 ? Math.min(99, Math.round((downloaded / totalSize) * 100)) : 0
          const now = Date.now()
          const elapsed = (now - lastTime) / 1000
          if (elapsed >= 0.5) {
            task.speed = Math.round((downloaded - lastBytes) / elapsed)
            lastBytes = downloaded; lastTime = now
            this.emit('task-progress', { taskId: task.id, groupId: task.groupId, total: totalSize, downloaded, percent: task.progress, speed: task.speed, name: task.name })
          }
        })
        res.pipe(file)
        file.on('finish', () => { file.close(); task.progress = 100; task.downloaded = downloaded; resolve() })
        file.on('error', (err) => { file.close(); try { fs.unlinkSync(task.destPath) } catch {}; reject(err) })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')) })
    })
  }
}

interface DownloadGroup {
  groupId: string
  tasks: any[]
  totalSize: number
  downloadedSize: number
  status: string
  createdAt: string
}

export default DownloadManager
