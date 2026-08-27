import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { MinecraftFolder } from '@xmcl/core'
import { install } from '@xmcl/installer'
import { DownloadManager } from '../downloader/manager'
import { Storage } from '../storage/database'
import { VersionManifest, InstalledVersion } from '../../shared/types'

const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'

export class VersionManager {
  private dl: DownloadManager
  private storage: Storage
  private manifestCache: VersionManifest | null = null
  private manifestTime = 0
  private onProgress?: (versionId: string, progress: { step: string; percent: number; message: string }) => void

  constructor(downloadManager: DownloadManager, storage: Storage) {
    this.dl = downloadManager
    this.storage = storage
  }

  setProgressCallback(cb: (versionId: string, progress: { step: string; percent: number; message: string }) => void) {
    this.onProgress = cb
  }

  async fetchManifest(forceRefresh = false): Promise<VersionManifest> {
    const now = Date.now()
    if (!forceRefresh && this.manifestCache && (now - this.manifestTime) < 3600000) return this.manifestCache
    const data = await this.httpGet(VERSION_MANIFEST_URL)
    this.manifestCache = JSON.parse(data)
    this.manifestTime = now
    return this.manifestCache!
  }

  async installVersion(versionId: string, versionUrl: string, versionType: string): Promise<InstalledVersion> {
    const settings = this.getSettings()
    const gamePath = settings.gameDir
    const minecraft = new MinecraftFolder(gamePath)
    const progress = (step: string, percent: number, message: string) => {
      this.onProgress?.(versionId, { step, percent, message })
    }

    progress('metadata', 0, 'Preparando instalacao...')

    // PRIMARY: Use @xmcl/installer (the core library)
    try {
      progress('metadata', 5, 'Baixando via @xmcl/installer...')
      
      await install(
        { id: versionId, url: versionUrl },
        minecraft,
        { side: 'client' } as any
      )

      progress('complete', 100, 'Instalacao concluida!')
    } catch (err: any) {
      console.warn(`[versions] @xmcl/installer failed for ${versionId}: ${err.message}. Falling back to manual install.`)
      // FALLBACK: Manual install
      try {
        await this.manualInstall(versionId, versionUrl, minecraft, progress)
      } catch (err2: any) {
        progress('error', 0, `Erro na instalacao: ${err2.message}`)
        throw err2
      }
    }

    // Save installed version info
    const versionDir = minecraft.getVersionRoot(versionId)
    const jarPath = minecraft.getVersionJar(versionId)
    const jsonPath = minecraft.getVersionJson(versionId)
    let javaVersion = 17
    if (fs.existsSync(jsonPath)) {
      try { javaVersion = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).javaVersion?.majorVersion || 17 } catch {}
    }
    const info: InstalledVersion = {
      id: versionId, type: versionType, downloadedAt: new Date().toISOString(),
      jarPath, jsonPath, gameDir: versionDir,
      librariesPath: path.join(versionDir, 'libraries'),
      assetsPath: minecraft.getPath('assets'), totalSize: 0, javaVersion
    }
    this.storage.saveInstalledVersion(versionId, info)
    return info
  }

  private async manualInstall(versionId: string, versionUrl: string, minecraft: MinecraftFolder, progress: Function): Promise<void> {
    const versionDir = minecraft.getVersionRoot(versionId)
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true })

    progress('metadata', 5, 'Baixando metadados...')
    const jsonPath = minecraft.getVersionJson(versionId)
    let versionJson: any
    // Try loading from cache first, with JSON validation
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8')
        versionJson = JSON.parse(raw)
        if (!versionJson.downloads?.client && !versionJson.libraries) {
          throw new Error('Invalid version JSON structure')
        }
      } catch (e) {
        console.warn(`[versions] Corrupt cached JSON for ${versionId}, re-downloading`)
        try { fs.unlinkSync(jsonPath) } catch {}
        versionJson = null
      }
    }
    // Download fresh JSON if needed
    if (!versionJson) {
      const raw = await this.httpGet(versionUrl)
      try {
        versionJson = JSON.parse(raw)
      } catch {
        throw new Error(`Version JSON from Mojang is invalid (received ${raw.length} bytes, first 200: ${raw.substring(0, 200)})`)
      }
      const dir = path.dirname(jsonPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(jsonPath, JSON.stringify(versionJson, null, 2), 'utf8')
    }

    // Download client JAR
    const client = versionJson.downloads?.client
    if (client) {
      const jarPath = minecraft.getVersionJar(versionId)
      const jarDir = path.dirname(jarPath)
      if (!fs.existsSync(jarDir)) fs.mkdirSync(jarDir, { recursive: true })
      if (!fs.existsSync(jarPath)) {
        progress('client', 10, 'Baixando cliente Minecraft...')
        await this.downloadWithProgress(client.url, jarPath, client.sha1, client.size, (p: number) => {
          progress('client', 10 + Math.round(p * 0.25), `Cliente... ${p}%`)
        })
      }
    }

    // Download libraries
    const librariesDir = path.join(versionDir, 'libraries')
    const libraries = versionJson.libraries || []
    let libCount = 0
    let libErrors = 0
    for (const lib of libraries) {
      if (lib.downloads?.classifiers) {
        const platformKey = process.platform === 'win32' ? 'natives-windows' : process.platform === 'darwin' ? 'natives-osx' : 'natives-linux'
        const classifier = lib.downloads.classifiers[platformKey] || lib.downloads.classifiers['natives-' + process.arch]
        if (classifier) {
          const libPath = path.join(librariesDir, classifier.path || classifier.url?.split('/').pop() || `native-${lib.name}`)
          if (!fs.existsSync(libPath)) {
            const dir = path.dirname(libPath)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            try {
              await this.downloadWithProgress(classifier.url, libPath, classifier.sha1, classifier.size)
            } catch (e) {
              libErrors++
              console.warn(`[versions] Failed to download native lib ${lib.name}: ${(e as Error).message}`)
            }
          }
        }
      }
      if (lib.downloads?.artifact) {
        const art = lib.downloads.artifact
        const libPath = path.join(librariesDir, art.path || lib.name.replace(/:/g, '/'))
        if (!fs.existsSync(libPath)) {
          const dir = path.dirname(libPath)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          try {
            await this.downloadWithProgress(art.url, libPath, art.sha1, art.size)
          } catch (e) {
            libErrors++
            console.warn(`[versions] Failed to download lib ${lib.name}: ${(e as Error).message}`)
          }
        }
      }
      libCount++
      if (libCount % 50 === 0 || libCount === libraries.length) {
        progress('libraries', 35 + Math.round((libCount / Math.max(libraries.length, 1)) * 25), `Libraries... ${libCount}/${libraries.length}${libErrors > 0 ? ` (${libErrors} erros)` : ''}`)
      }
    }

    // Download assets
    if (versionJson.assetIndex) {
      const assetsBase = minecraft.getPath('assets')
      const indexesDir = path.join(assetsBase, 'indexes')
      const objectsDir = path.join(assetsBase, 'objects')
      if (!fs.existsSync(indexesDir)) fs.mkdirSync(indexesDir, { recursive: true })
      if (!fs.existsSync(objectsDir)) fs.mkdirSync(objectsDir, { recursive: true })

      const indexFile = path.join(indexesDir, `${versionJson.assetIndex.id}.json`)
      if (!fs.existsSync(indexFile)) {
        await this.downloadWithProgress(versionJson.assetIndex.url, indexFile)
      }

      const assetIndex = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
      const entries: [string, any][] = Object.entries(assetIndex.objects || {})
      let assetCount = 0
      let assetErrors = 0
      for (const [name, info] of entries) {
        const prefix = info.hash.substring(0, 2)
        const objDir = path.join(objectsDir, prefix)
        const objPath = path.join(objDir, info.hash)
        if (!fs.existsSync(objDir)) fs.mkdirSync(objDir, { recursive: true })
        if (!fs.existsSync(objPath)) {
          const url = `https://resources.download.minecraft.net/${prefix}/${info.hash}`
          try { await this.downloadWithProgress(url, objPath) } catch { assetErrors++ }
        }
        assetCount++
        if (assetCount % 200 === 0 || assetCount === entries.length) {
          progress('assets', 60 + Math.round((assetCount / entries.length) * 30), `Assets... ${assetCount}/${entries.length}${assetErrors > 0 ? ` (${assetErrors} erros)` : ''}`)
        }
      }
    }

    progress('complete', 100, 'Instalacao concluida!')
  }

  async uninstallVersion(versionId: string): Promise<void> {
    const settings = this.getSettings()
    const minecraft = new MinecraftFolder(settings.gameDir)
    const versionDir = minecraft.getVersionRoot(versionId)
    if (fs.existsSync(versionDir)) fs.rmSync(versionDir, { recursive: true, force: true })
    this.storage.removeInstalledVersion(versionId)
  }

  async verifyVersion(versionId: string): Promise<{ valid: boolean; missing: string[]; corrupted: string[] }> {
    const installed = this.storage.getInstalledVersions()[versionId]
    if (!installed) return { valid: false, missing: ['version not installed'], corrupted: [] }
    const missing: string[] = []
    if (!fs.existsSync(installed.jarPath)) missing.push('client.jar')
    return { valid: missing.length === 0, missing, corrupted: [] }
  }

  private async downloadWithProgress(url: string, destPath: string, sha1?: string, size?: number, onProgress?: (p: number) => void): Promise<void> {
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return new Promise((resolve, reject) => {
      const taskId = this.dl.addTask({ url, destPath, sha1, size, name: path.basename(destPath) })
      const onProg = (data: any) => { if (data.taskId === taskId && onProgress) onProgress(data.percent) }
      const onDone = (data: any) => { if (data.taskId === taskId) { cleanup(); resolve() } }
      const onFail = (data: any) => { if (data.taskId === taskId) { cleanup(); reject(new Error(data.error)) } }
      const cleanup = () => { this.dl.removeListener('task-progress', onProg); this.dl.removeListener('task-completed', onDone); this.dl.removeListener('task-failed', onFail) }
      this.dl.on('task-progress', onProg)
      this.dl.on('task-completed', onDone)
      this.dl.on('task-failed', onFail)
    })
  }

  private httpGet(url: string, retries = 2): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'MinecraftLauncher/0.1.12',
          'Accept-Encoding': 'gzip, deflate'
        }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href
          this.httpGet(redirectUrl, retries).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
        // Handle gzip/deflate decompression
        let stream: NodeJS.ReadableStream = res
        const encoding = res.headers['content-encoding']
        if (encoding === 'gzip') {
          const zlib = require('zlib')
          stream = res.pipe(zlib.createGunzip())
        } else if (encoding === 'deflate') {
          const zlib = require('zlib')
          stream = res.pipe(zlib.createInflate())
        } else if (encoding === 'br') {
          const zlib = require('zlib')
          stream = res.pipe(zlib.createBrotliDecompress())
        }
        const chunks: Buffer[] = []
        stream.on('data', (c: Buffer) => chunks.push(c))
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        stream.on('error', (err) => reject(err))
      }).on('error', (err) => {
        if (retries > 0) {
          setTimeout(() => this.httpGet(url, retries - 1).then(resolve).catch(reject), 1000)
        } else {
          reject(err)
        }
      })
    })
  }

  private getSettings() {
    const s = this.storage.getAllSettings()
    return { gameDir: s.gameDir || path.join(this.storage.getBasePath(), 'instances'), javaPath: s.javaPath || '' }
  }
}

export default VersionManager
