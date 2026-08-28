import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'
import { EventEmitter } from 'events'

interface JavaDownloadInfo {
  version: number
  platform: string
  arch: string
  url: string
  filename: string
}

/**
 * Auto-downloads and installs the correct Java version when Minecraft needs it.
 * Uses Adoptium (Eclipse Temurin) API to find and download the right JDK.
 */
export class JavaAutoDownloader extends EventEmitter {
  private downloadDir: string
  private installing = false

  constructor(downloadDir: string) {
    super()
    this.downloadDir = path.join(downloadDir, 'java')
    if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true })
  }

  isInstalling(): boolean {
    return this.installing
  }

  /**
   * Get the Adoptium download URL for a given Java version + platform
   */
  async getDownloadUrl(javaVersion: number): Promise<JavaDownloadInfo | null> {
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'

    // Adoptium API v3
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${javaVersion}/hotspot?architecture=${arch}&image_type=jdk&os=${platform}&vendor=eclipse`

    return new Promise((resolve) => {
      https.get(apiUrl, {
        headers: { 'User-Agent': 'MinecraftLauncher/1.0' },
        timeout: 15000
      }, (res) => {
        if (res.statusCode !== 200) { res.resume(); resolve(null); return }
        let data = ''
        res.on('data', (c: Buffer) => data += c)
        res.on('end', () => {
          try {
            const assets = JSON.parse(data)
            if (!Array.isArray(assets) || assets.length === 0) { resolve(null); return }
            const asset = assets[0]
            const binary = asset.binary
            if (!binary?.package?.link) { resolve(null); return }
            resolve({
              version: javaVersion,
              platform,
              arch,
              url: binary.package.link,
              filename: binary.package.name || `jdk-${javaVersion}-${platform}-${arch}.zip`
            })
          } catch { resolve(null) }
        })
      }).on('error', () => resolve(null))
    })
  }

  /**
   * Download and install a specific Java version.
   * Returns the path to the java executable.
   */
  async downloadAndInstall(javaVersion: number, onProgress?: (msg: string, percent: number) => void): Promise<string | null> {
    if (this.installing) return null
    this.installing = true

    const javaDir = path.join(this.downloadDir, `jdk-${javaVersion}`)
    const javaBin = process.platform === 'win32'
      ? path.join(javaDir, 'bin', 'java.exe')
      : path.join(javaDir, 'bin', 'java')

    // Already installed?
    if (fs.existsSync(javaBin)) {
      this.installing = false
      this.emit('log', `Java ${javaVersion} already installed at ${javaDir}`)
      return javaBin
    }

    onProgress?.(`Buscando Java ${javaVersion} no Adoptium...`, 5)
    this.emit('log', `Downloading Java ${javaVersion}...`)

    const info = await this.getDownloadUrl(javaVersion)
    if (!info) {
      this.installing = false
      this.emit('error', `Could not find Java ${javaVersion} download URL`)
      return null
    }

    onProgress?.(`Baixando JDK ${javaVersion} (${info.filename})...`, 10)
    this.emit('log', `Download URL: ${info.url}`)

    const isZip = info.filename.endsWith('.zip')
    const ext = isZip ? '.zip' : '.msi'
    const tempFile = path.join(this.downloadDir, `jdk-${javaVersion}${ext}`)

    try {
      // Download
      await this.downloadFile(info.url, tempFile, (percent) => {
        onProgress?.(`Baixando JDK ${javaVersion}... ${percent}%`, 10 + Math.round(percent * 0.6))
      })

      onProgress?.(`Instalando Java ${javaVersion}...`, 75)
      this.emit('log', `Extracting to ${javaDir}`)

      // Extract
      if (isZip) {
        // Use built-in extraction or adm-zip
        await this.extractZip(tempFile, javaDir)
      } else {
        // MSI installer — silent install
        try {
          execSync(`msiexec /i "${tempFile}" /qn INSTALLDIR="${javaDir}" ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome"`, {
            timeout: 120000,
            stdio: 'pipe'
          })
        } catch {
          // Fallback: try 7z extraction
          try {
            execSync(`7z x "${tempFile}" -o"${javaDir}" -y`, { timeout: 60000, stdio: 'pipe' })
          } catch {}
        }
      }

      // Find the actual java.exe after extraction
      const actualJava = this.findJavaExecutable(javaDir)
      if (actualJava) {
        onProgress?.(`Java ${javaVersion} instalado com sucesso!`, 100)
        this.emit('log', `Java ${javaVersion} installed: ${actualJava}`)

        // Clean up temp file
        try { fs.unlinkSync(tempFile) } catch {}

        // Also check for JDK subdirectory (Adoptium extracts to jdk-XX.x.x)
        this.installing = false
        return actualJava
      }

      this.installing = false
      this.emit('error', `Java ${javaVersion} installed but java executable not found in ${javaDir}`)
      return null
    } catch (err: any) {
      this.installing = false
      this.emit('error', `Failed to install Java ${javaVersion}: ${err.message}`)
      try { fs.unlinkSync(tempFile) } catch {}
      return null
    }
  }

  /**
   * Check if a specific Java version is available, and auto-install if not.
   */
  async ensureJava(requiredVersion: number, currentJavaPath?: string): Promise<string> {
    // Check if current Java is good enough
    if (currentJavaPath && fs.existsSync(currentJavaPath)) {
      const major = this.getJavaMajor(currentJavaPath)
      if (major >= requiredVersion) return currentJavaPath
    }

    // Check our managed installs
    const managed = this.findManagedJava(requiredVersion)
    if (managed) return managed

    // Auto-download!
    this.emit('log', `Java ${requiredVersion} not found. Auto-downloading...`)
    const installed = await this.downloadAndInstall(requiredVersion, (msg, pct) => {
      this.emit('progress', { message: msg, percent: pct })
    })

    return installed || ''
  }

  private findManagedJava(requiredVersion: number): string | null {
    const dirs = fs.readdirSync(this.downloadDir).filter(d => d.startsWith('jdk-'))
    for (const dir of dirs) {
      const javaBin = path.join(this.downloadDir, dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
      if (fs.existsSync(javaBin)) {
        const major = this.getJavaMajor(javaBin)
        if (major >= requiredVersion) return javaBin
      }
      // Check subdirectories (Adoptium format: jdk-25+9/etc)
      const subdirs = fs.readdirSync(path.join(this.downloadDir, dir)).filter(d => d.startsWith('jdk-'))
      for (const sub of subdirs) {
        const subBin = path.join(this.downloadDir, dir, sub, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
        if (fs.existsSync(subBin)) {
          const major = this.getJavaMajor(subBin)
          if (major >= requiredVersion) return subBin
        }
      }
    }
    return null
  }

  private getJavaMajor(javaPath: string): number {
    try {
      const output = execSync(`"${javaPath}" -version 2>&1`, { timeout: 10000, encoding: 'utf8' })
      const match = output.match(/version "([\d.]+)/)
      if (match) {
        const parts = match[1].split('.')
        return parseInt(parts[0]) || 0
      }
    } catch {}
    return 0
  }

  private findJavaExecutable(dir: string): string | null {
    // Search recursively for java.exe / java
    const javaName = process.platform === 'win32' ? 'java.exe' : 'java'
    const search = (d: string, depth = 0): string | null => {
      if (depth > 4) return null
      try {
        for (const entry of fs.readdirSync(d)) {
          const full = path.join(d, entry)
          try {
            const stat = fs.statSync(full)
            if (stat.isDirectory()) {
              if (entry === 'bin') {
                const javaPath = path.join(full, javaName)
                if (fs.existsSync(javaPath)) return javaPath
              }
              const found = search(full, depth + 1)
              if (found) return found
            }
          } catch {}
        }
      } catch {}
      return null
    }
    return search(dir)
  }

  private downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : require('http')
      client.get(url, {
        headers: { 'User-Agent': 'MinecraftLauncher/1.0' },
        timeout: 300000
      }, (res: any) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          this.downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const file = fs.createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          if (totalSize > 0 && onProgress) {
            onProgress(Math.round((downloaded / totalSize) * 100))
          }
        })

        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', (err) => { file.close(); try { fs.unlinkSync(destPath) } catch {}; reject(err) })
      }).on('error', reject)
    })
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    // Try adm-zip first
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(destDir, true)
      return
    } catch {}

    // Try 7z
    try {
      execSync(`7z x "${zipPath}" -o"${destDir}" -y`, { timeout: 120000, stdio: 'pipe' })
      return
    } catch {}

    // Try PowerShell
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
        timeout: 120000, stdio: 'pipe'
      })
      return
    } catch {}

    throw new Error('No extraction tool available (adm-zip, 7z, or PowerShell)')
  }

  /**
   * Get the Adoptium download page URL for manual download
   */
  static getAdoptiumUrl(javaVersion: number): string {
    return `https://adoptium.net/temurin/releases/?version=${javaVersion}`
  }

  /**
   * List all managed Java installations
   */
  listManaged(): Array<{ version: number; path: string }> {
    const results: Array<{ version: number; path: string }> = []
    try {
      for (const dir of fs.readdirSync(this.downloadDir)) {
        if (!dir.startsWith('jdk-')) continue
        const javaBin = path.join(this.downloadDir, dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
        if (fs.existsSync(javaBin)) {
          const major = this.getJavaMajor(javaBin)
          results.push({ version: major, path: javaBin })
        }
      }
    } catch {}
    return results
  }
}
