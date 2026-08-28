import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { JavaInstall } from '../../shared/types'

const JAVA_MIN = 8
const JAVA_MAX = 99 // No upper limit — let the game decide compatibility

export class JavaManager {
  private detected: JavaInstall[] = []

  detectAll(): JavaInstall[] {
    const installs: JavaInstall[] = []
    const platform = process.platform
    const searchPaths = this.getSearchPaths(platform)

    for (const loc of searchPaths) {
      try {
        if (!fs.existsSync(loc)) continue
        const stat = fs.statSync(loc)
        if (stat.isFile()) {
          const info = this.probeJava(loc)
          if (info) installs.push(info)
        } else if (stat.isDirectory()) {
          this.scanDirectory(loc, installs)
        }
      } catch {}
    }

    // Try PATH
    try {
      const cmd = platform === 'win32' ? 'where java' : 'which java'
      const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0].trim()
      if (result && !installs.some(i => i.path === result)) {
        const info = this.probeJava(result)
        if (info) installs.push(info)
      }
    } catch {}

    const seen = new Set<string>()
    this.detected = installs.filter(i => {
      const key = `${i.version}_${i.architecture}_${i.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return this.detected
  }

  private getSearchPaths(platform: string): string[] {
    const paths: string[] = []
    if (platform === 'win32') {
      const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files'
      const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
      const local = process.env['LOCALAPPDATA'] || ''
      paths.push(
        path.join(pf, 'Java'), path.join(pf86, 'Java'),
        path.join(local, 'Programs', 'Java'),
        path.join(pf, 'Eclipse Adoptium'), path.join(pf, 'Eclipse Foundation'),
        path.join(pf, 'Microsoft'), path.join(pf, 'BellSoft'), path.join(pf, 'Zulu'),
        path.join(os.homedir(), 'scoop', 'apps', 'openjdk'),
        path.join(pf, 'Amazon'), path.join(pf, 'GraalVM'),
        path.join(pf, 'SAP'), path.join(pf, 'Semeru'),
        path.join(local, 'Java'), path.join(local, 'Eclipse Adoptium')
      )
    } else if (platform === 'darwin') {
      paths.push(
        '/Library/Java/JavaVirtualMachines',
        path.join(os.homedir(), '.sdkman', 'candidates', 'java')
      )
    } else {
      paths.push('/usr/bin/java', '/usr/local/bin/java', '/usr/lib/jvm',
        path.join(os.homedir(), '.sdkman', 'candidates', 'java'))
    }
    return paths
  }

  private scanDirectory(dir: string, installs: JavaInstall[]): void {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        try {
          if (!fs.statSync(full).isDirectory()) continue
          const javaBin = process.platform === 'win32' ? path.join(full, 'bin', 'java.exe') : path.join(full, 'bin', 'java')
          if (fs.existsSync(javaBin)) {
            const info = this.probeJava(javaBin)
            if (info) installs.push(info)
          }
        } catch {}
      }
    } catch {}
  }

  private probeJava(javaPath: string): JavaInstall | null {
    try {
      const output = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', timeout: 10000 })
      return this.parseVersion(javaPath, output)
    } catch { return null }
  }

  private parseVersion(javaPath: string, output: string): JavaInstall | null {
    const match = output.match(/version "(\d+(?:\.\d+)*(?:_\d+)?)/)
    if (!match) return null
    const versionStr = match[1]
    let majorVersion: number
    if (versionStr.startsWith('1.')) majorVersion = parseInt(versionStr.split('.')[1], 10)
    else majorVersion = parseInt(versionStr.split('.')[0], 10)

    let architecture = process.arch === 'arm64' ? 'aarch64' : 'x64'
    if (output.includes('64-Bit')) architecture = 'x64'
    else if (output.includes('32-Bit') || output.includes('i386')) architecture = 'x32'

    let vendor = 'Unknown'
    const lower = output.toLowerCase()
    if (lower.includes('temurin') || lower.includes('adoptium')) vendor = 'Eclipse Adoptium'
    else if (lower.includes('oracle')) vendor = 'Oracle'
    else if (lower.includes('graalvm')) vendor = 'GraalVM'
    else if (lower.includes('amazon') || lower.includes('corretto')) vendor = 'Amazon Corretto'
    else if (lower.includes('zulu')) vendor = 'Azul Zulu'
    else if (lower.includes('microsoft')) vendor = 'Microsoft'
    else if (lower.includes('bellsoft') || lower.includes('liberica')) vendor = 'BellSoft'
    else if (lower.includes('sapmachine')) vendor = 'SAP Machine'

    return {
      path: javaPath, version: versionStr, majorVersion, architecture, vendor,
      compatible: majorVersion >= JAVA_MIN, verified: true
    }
  }

  findBest(versionJson?: any, versionId?: string): JavaInstall | null {
    // Determine required Java version from Minecraft version
    let required = versionJson?.javaVersion?.majorVersion || 17
    if (versionId) {
      const match = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
      if (match) {
        const minor = parseInt(match[2])
        const patch = parseInt(match[3] || '0')
        if (minor >= 20 && patch >= 5) required = 21
        else if (minor >= 18) required = 17
        else if (minor >= 17) required = 16
      }
    }
    // Filter to Java installs that meet the minimum requirement
    const compatible = this.detected.filter(i => i.majorVersion >= required)
    if (compatible.length === 0) {
      // Fallback: any compatible Java
      const anyCompatible = this.detected.filter(i => i.compatible)
      return anyCompatible[0] || null
    }
    // Prefer exact version match, then closest
    const exact = compatible.find(i => i.majorVersion === required)
    if (exact) return exact
    return compatible.sort((a, b) => Math.abs(a.majorVersion - required) - Math.abs(b.majorVersion - required))[0]
  }

  async verify(javaPath: string): Promise<{ valid: boolean; info?: JavaInstall; error?: string }> {
    try {
      const output = execSync(`"${javaPath}" -version 2>&1`, { encoding: 'utf8', timeout: 10000 })
      const info = this.parseVersion(javaPath, output)
      return info ? { valid: true, info } : { valid: false, error: 'Could not parse version' }
    } catch (e: any) { return { valid: false, error: e.message } }
  }
}

export default JavaManager
