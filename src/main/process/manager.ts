import { launch, Version, MinecraftFolder, createMinecraftProcessWatcher } from '@xmcl/core'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { Storage } from '../storage/database'
import { JavaManager } from '../java/manager'
import { InstanceManager } from '../instances/manager'
import { AuthAccount, LogEntry } from '../../shared/types'

interface ProcessInfo {
  process: ChildProcess; pid: number; instanceId: string; status: string
  startTime: string; logs: LogEntry[]; exitCode: number | null; endTime?: string
}

export class ProcessManager extends EventEmitter {
  private storage: Storage
  private javaManager: JavaManager
  private instanceManager: InstanceManager
  private processes: Map<string, ProcessInfo> = new Map()
  private playTimers: Map<string, number> = new Map()

  constructor(storage: Storage, javaManager: JavaManager, instanceManager: InstanceManager) {
    super()
    this.storage = storage
    this.javaManager = javaManager
    this.instanceManager = instanceManager
  }

  async launch(instanceId: string, authAccount: AuthAccount | null): Promise<{ pid: number; instanceId: string }> {
    const instance = this.instanceManager.get(instanceId)
    if (!instance) throw new Error(`Instância não encontrada: ${instanceId}`)

    const installed = this.storage.getInstalledVersions()[instance.versionId]
    if (!installed) throw new Error(`Versão não instalada: ${instance.versionId}. Baixe primeiro.`)

    const allSettings = this.storage.getAllSettings()
    const gamePath = allSettings.gameDir || path.join(this.storage.getBasePath(), 'instances')
    const minecraft = new MinecraftFolder(gamePath)

    // Read version JSON early (needed for Java check + launch)
    const versionJson = fs.existsSync(installed.jsonPath) ? JSON.parse(fs.readFileSync(installed.jsonPath, 'utf8')) : {}

    // Find Java
    let javaPath = instance.javaPath || allSettings.javaPath || ''
    if (!javaPath) {
      const best = this.javaManager.findBest(versionJson, instance.versionId)
      if (best) javaPath = best.path
    }
    if (!javaPath) throw new Error('Java não encontrado. Instale Java para jogar.')

    // Auto-repair: if gameDir is relative or missing, fix it
    if (!path.isAbsolute(instance.gameDir) || !fs.existsSync(instance.gameDir)) {
      const fixedDir = path.join(this.storage.getBasePath(), 'instances', instance.id)
      this.instanceManager.update(instance.id, { gameDir: fixedDir })
      instance.gameDir = fixedDir
      if (!fs.existsSync(fixedDir)) fs.mkdirSync(fixedDir, { recursive: true })
    }

    // Ensure directories
    const logDir = path.join(instance.gameDir, 'logs')
    const crashDir = path.join(instance.gameDir, 'crash-reports')
    for (const d of [logDir, crashDir]) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }

    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Iniciando Minecraft ${instance.versionId}` })

    // Detect Java major version to filter incompatible JVM args
    let javaMajor = this.getJavaMajor(javaPath)
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java major version: ${javaMajor}` })

    // Validate Java version against Minecraft version requirement
    const requiredJava = this.getRequiredJavaVersion(instance.versionId, versionJson)
    if (javaMajor < requiredJava) {
      this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Java ${javaMajor} found but ${instance.versionId} needs Java ${requiredJava}+. Auto-downloading...` })
      // Try auto-download
      try {
        const { JavaAutoDownloader } = require('./java/autodownloader')
        const downloader = new JavaAutoDownloader(require('electron').app.getPath('userData'))
        this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Auto-downloading Java ${requiredJava} from Adoptium...` })
        const downloaded = await downloader.downloadAndInstall(requiredJava, (msg: string, pct: number) => {
          this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java download: ${msg} (${pct}%)` })
        })
        if (downloaded) {
          javaPath = downloaded
          javaMajor = this.getJavaMajor(javaPath)
          this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java ${javaMajor} installed at ${javaPath}` })
        }
      } catch (dlErr: any) {
        this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Auto-download failed: ${dlErr.message}` })
      }
      // Re-check after download attempt
      if (javaMajor < requiredJava) {
        const errorMsg = `Java ${javaMajor} encontrado, mas ${instance.versionId} precisa de Java ${requiredJava}+!\n\n` +
          `Java atual: ${javaPath}\n` +
          `Versão necessária: Java ${requiredJava}\n\n` +
          `Baixe Java ${requiredJava} em:\n` +
          `https://adoptium.net/temurin/releases/?version=${requiredJava}`
        throw new Error(errorMsg)
      }
    }

    // Ensure natives are extracted (critical for pre-1.13 versions like 1.7.10)
    const nativesDir = path.join(installed.gameDir, 'natives')
    const hasNatives = fs.existsSync(nativesDir) && fs.readdirSync(nativesDir).some(f => f.endsWith('.dll') || f.endsWith('.so') || f.endsWith('.dylib'))
    if (!hasNatives) {
      this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: 'Natives not found, extracting...' })
      await this.extractNatives(installed)
    }

    // Use our controlled launch (not @xmcl/core which adds incompatible args from version JSON)
    return this.fallbackLaunch(instanceId, instance, installed, javaPath, authAccount, logDir, crashDir, javaMajor)
  }

  private fallbackLaunch(instanceId: string, instance: any, installed: any, javaPath: string, authAccount: AuthAccount | null, logDir: string, crashDir: string, javaMajor: number = 17): { pid: number; instanceId: string } {
    const allSettings = this.storage.getAllSettings()
    const rootGamePath = allSettings.gameDir || path.join(this.storage.getBasePath(), 'instances')
    const minecraft = new MinecraftFolder(rootGamePath)
    const versionJson = JSON.parse(fs.readFileSync(installed.jsonPath, 'utf8'))
    const sep = path.delimiter
    let classpath = installed.jarPath
    // Use the global libraries path from MinecraftFolder, NOT the per-version one
    const globalLibsPath = minecraft.getPath('libraries')
    for (const lib of versionJson.libraries || []) {
      if (lib.downloads?.artifact) {
        // Try global path first, then installed path as fallback
        const artifactPath = lib.downloads.artifact.path || lib.name.replace(/:/g, '/')
        const globalLibPath = path.join(globalLibsPath, artifactPath)
        const localLibPath = path.join(installed.librariesPath, artifactPath)
        const libPath = fs.existsSync(globalLibPath) ? globalLibPath : localLibPath
        if (fs.existsSync(libPath)) classpath += sep + libPath
      }
    }
    // Build JVM args from version JSON, filtering by platform rules
    const versionJvmArgs: string[] = []
    const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
    if (versionJson.arguments?.jvm) {
      for (const arg of versionJson.arguments.jvm) {
        if (typeof arg === 'string') {
          versionJvmArgs.push(arg)
        } else if (arg.rules && arg.value) {
          // Mojang rule format: rules are evaluated in order
          // 'allow' = include only if rule matches; 'disallow' = exclude if rule matches
          // If first rule is 'allow', default is exclude. If first is 'disallow', default is include.
          const include = this.evaluateJvmRules(arg.rules, osName)
          if (include) {
            const vals = Array.isArray(arg.value) ? arg.value : [arg.value]
            versionJvmArgs.push(...vals)
          }
        }
      }
    }
    // Filter incompatible args
    const { filtered, removed } = this.filterJvmArgs(versionJvmArgs, javaMajor)
    if (removed.length > 0) {
      this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Filtered JVM args: ${removed.join(', ')}` })
    }
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `JVM args: ${filtered.length} (filtered from ${versionJvmArgs.length})` })

    // Build game arguments from version JSON
    const gameArgs: string[] = []
    // Modern format: arguments.game (array of strings and rule objects)
    if (versionJson.arguments?.game) {
      for (const arg of versionJson.arguments.game) {
        if (typeof arg === 'string') {
          gameArgs.push(arg)
        } else if (arg.rules && arg.value) {
          const include = this.evaluateGameRules(arg.rules)
          if (include) {
            const vals = Array.isArray(arg.value) ? arg.value : [arg.value]
            gameArgs.push(...vals)
          }
        }
      }
    }
    // Legacy format: minecraftArguments (space-separated string)
    if (!gameArgs.length && versionJson.minecraftArguments) {
      const parts = versionJson.minecraftArguments.split(' ')
      for (let i = 0; i < parts.length; i++) {
        gameArgs.push(parts[i])
      }
    }

    // Resolve variable placeholders
    const uuid = authAccount?.uuid || '00000000-0000-0000-0000-000000000000'
    const uuidNoDashes = uuid.replace(/-/g, '')
    const username = authAccount?.username || 'Player'
    const accessToken = authAccount?.accessToken || '0'
    const userType = authAccount?.type === 'microsoft' ? 'msa' : 'legacy'
    const clientId = uuidNoDashes // clientId uses UUID without dashes
    const assetsDir = path.join(rootGamePath, 'assets')
    const gameDir = instance.gameDir

    // Variable resolver for legacy minecraftArguments format
    const resolveVar = (val: string): string => {
      return val
        .replace(/\$\{auth_player_name\}/g, username)
        .replace(/\$\{auth_session\}/g, accessToken)
        .replace(/\$\{auth_uuid\}/g, uuidNoDashes)
        .replace(/\$\{auth_access_token\}/g, accessToken)
        .replace(/\$\{auth_player_uuid\}/g, uuidNoDashes)
        .replace(/\$\{user_properties\}/g, '{}')
        .replace(/\$\{user_type\}/g, userType)
        .replace(/\$\{version_name\}/g, instance.versionId)
        .replace(/\$\{game_directory\}/g, gameDir)
        .replace(/\$\{assets_root\}/g, assetsDir)
        .replace(/\$\{assets_index_name\}/g, versionJson.assetIndex?.id || instance.versionId)
        .replace(/\$\{clientid\}/g, clientId)
        .replace(/\$\{auth_xuid\}/g, authAccount?.type === 'microsoft' ? 'xbox360' : '')
        .replace(/\$\{user_type\}/g, userType)
        .replace(/\$\{version_type\}/g, 'MinecraftLauncher')
        .replace(/\$\{resolution_width\}/g, String(instance.resolution?.width || 854))
        .replace(/\$\{resolution_height\}/g, String(instance.resolution?.height || 480))
    }

    const args = [
      `-Xms${instance.minMemory}M`, `-Xmx${instance.maxMemory}M`,
      ...filtered,
      ...(instance.jvmArgs || []),
      `-Djava.library.path=${path.join(installed.gameDir, 'natives')}`,
      `-Dminecraft.launcher.brand=minecraftlauncher`, `-Dminecraft.launcher.version=0.1.18`,
      '-cp', classpath, versionJson.mainClass || 'net.minecraft.client.main.Main',
      ...gameArgs.map(resolveVar)
    ]

    // Ensure required args are always present (override resolved values for consistency)
    const ensureArg = (flag: string, value: string) => {
      const idx = args.indexOf(flag)
      if (idx >= 0 && idx + 1 < args.length) { args[idx + 1] = value }
      else { args.push(flag, value) }
    }
    ensureArg('--username', username)
    ensureArg('--version', instance.versionId)
    ensureArg('--gameDir', gameDir)
    ensureArg('--assetsDir', assetsDir)
    ensureArg('--assetIndex', versionJson.assetIndex?.id || instance.versionId)
    ensureArg('--uuid', uuidNoDashes)
    ensureArg('--accessToken', accessToken)
    ensureArg('--userType', userType)
    ensureArg('--versionType', 'MinecraftLauncher')
    // Ensure --userProperties for legacy versions (pre-1.6)
    if (!gameArgs.includes('--userProperties') && !args.includes('--userProperties')) {
      args.push('--userProperties', '{}')
    }
    // Ensure --clientId and --xuid for modern versions
    if (versionJson.arguments?.game) {
      if (!args.includes('--clientId')) args.push('--clientId', clientId)
      if (!args.includes('--xuid')) args.push('--xuid', '')
    }
    // Diagnostic logging
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java: ${javaPath}` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `GameDir: ${instance.gameDir}` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `AssetsDir: ${rootGamePath}/assets` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Libs: ${globalLibsPath}` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Classpath entries: ${classpath.split(path.delimiter).length}` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `MainClass: ${versionJson.mainClass}` })
    this.emit('log', { timestamp: new Date().toISOString(), level: 'DEBUG', source: 'launcher', message: `Args: ${args.join(' ')}` })
    const proc = spawn(javaPath, args, { cwd: instance.gameDir, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] })
    const startTime = Date.now()
    this.setupProcess(proc, instanceId, instance.gameDir, logDir, crashDir, startTime)
    return { pid: proc.pid!, instanceId }
  }

  private setupProcess(proc: ChildProcess, instanceId: string, gameDir: string, logDir: string, crashDir: string, startTime: number) {
    const info: ProcessInfo = { process: proc, pid: proc.pid!, instanceId, status: 'running', startTime: new Date().toISOString(), logs: [], exitCode: null }
    this.processes.set(instanceId, info)
    this.playTimers.set(instanceId, startTime)

    proc.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n').filter((l: string) => l.trim())) {
        const entry = this.parseLog(line, 'minecraft')
        info.logs.push(entry)
        this.emit('game-log', { instanceId, ...entry })
      }
    })
    proc.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n').filter((l: string) => l.trim())) {
        const entry = this.parseLog(line, 'java')
        info.logs.push(entry)
        this.emit('game-log', { instanceId, ...entry })
      }
    })
    proc.on('exit', (code, signal) => {
      info.status = code === 0 ? 'exited' : 'crashed'
      info.exitCode = code ?? 1; info.endTime = new Date().toISOString()
      const elapsed = Math.round((Date.now() - startTime) / 60000)
      this.instanceManager.addPlayTime(instanceId, elapsed)
      this.playTimers.delete(instanceId)
      if (code !== 0) {
        const report = this.crashReport(instanceId, code, signal, info.logs)
        try { fs.writeFileSync(path.join(crashDir, `crash-${Date.now()}.txt`), report) } catch {}
      }
      try { fs.writeFileSync(path.join(logDir, 'latest.log'), info.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n')) } catch {}
      this.emit('game-exited', { instanceId, code, signal })
      this.processes.delete(instanceId)
    })
    proc.on('error', (err) => { info.status = 'crashed'; this.emit('game-error', { instanceId, error: err.message }); this.processes.delete(instanceId) })
    this.emit('game-launched', { instanceId, pid: proc.pid })
    this.instanceManager.markPlayed(instanceId)
  }

  stop(instanceId: string): boolean {
    const info = this.processes.get(instanceId)
    if (!info) return false
    info.process.kill('SIGTERM')
    setTimeout(() => { try { info.process.kill('SIGKILL') } catch {} }, 5000)
    return true
  }

  getStatus(instanceId: string) { const i = this.processes.get(instanceId); return i ? { instanceId, pid: i.pid, status: i.status, startTime: i.startTime, exitCode: i.exitCode } : null }
  isRunning(instanceId: string) { return this.processes.has(instanceId) }

  private getJavaMajor(javaPath: string): number {
    try {
      const { execSync } = require('child_process')
      const output = execSync(`"${javaPath}" -version 2>&1`, { timeout: 10000, encoding: 'utf8' })
      // Match patterns like: java version "21.0.1" or openjdk version "17.0.2"
      const match = output.match(/version "([\d.]+)/)
      if (match) {
        const parts = match[1].split('.')
        const major = parseInt(parts[0]) || 0
        this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java detected: ${javaPath} → version ${match[1]} (major: ${major})` })
        return major
      }
    } catch (e: any) {
      this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Failed to detect Java version at ${javaPath}: ${e.message}` })
    }
    return 17 // default to 17
  }

  private getRequiredJavaVersion(versionId: string, versionJson?: any): number {
    // PRIORITY: Read from version JSON javaVersion.majorVersion (most accurate)
    if (versionJson?.javaVersion?.majorVersion) {
      return versionJson.javaVersion.majorVersion
    }
    // Fallback: guess from version ID
    const match = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
    if (!match) return 8
    const major = parseInt(match[1])
    const minor = parseInt(match[2])
    const patch = parseInt(match[3] || '0')
    // New versioning: 26.x, 25.x, etc. — read from JSON or default to 21+
    if (major >= 2) {
      // MC 26.x+ uses new versioning, check JSON or default to Java 25
      return 25
    }
    if (minor >= 21) return 21 // 1.21.x+ needs Java 21+
    if (minor === 20 && patch >= 5) return 21 // 1.20.5+ needs Java 21+
    if (minor >= 18) return 17 // 1.18-1.20.4 needs Java 17+
    if (minor >= 17) return 16 // 1.17.x needs Java 16+
    return 8 // 1.16 and below needs Java 8+
  }

  private evaluateJvmRules(rules: any[], currentOs: string): boolean {
    // Mojang rules format: evaluate in order, last matching rule wins
    // Default: if first action is 'allow' → false (exclude by default)
    //          if first action is 'disallow' → true (include by default)
    let result = rules[0]?.action === 'disallow'
    for (const rule of rules) {
      let matches = true
      if (rule.os) {
        if (rule.os.name && rule.os.name !== currentOs) matches = false
        // Note: rule.os.arch from Mojang is 'x86'|'x86_64'|'arm64'
        // process.arch from Node is 'ia32'|'x64'|'arm64'
        if (rule.os.arch) {
          const archMap: Record<string, string> = { 'x86': 'ia32', 'x86_64': 'x64', 'amd64': 'x64', 'arm64': 'arm64' }
          const expectedArch = archMap[rule.os.arch] || rule.os.arch
          if (expectedArch !== process.arch) matches = false
        }
        if (rule.os.version && !new RegExp(rule.os.version).test(os.release())) matches = false
      }
      if (rule.features) {
        // features like 'has_custom_resolution' — treat as not matching
        // (we don't set custom resolution features)
        matches = false
      }
      if (matches) {
        result = rule.action === 'allow'
      }
    }
    return result
  }

  private evaluateGameRules(rules: any[]): boolean {
    // Same logic as JVM rules but for game arguments
    // Default: if first action is 'allow' → false (exclude by default)
    //          if first action is 'disallow' → true (include by default)
    let result = rules[0]?.action === 'disallow'
    for (const rule of rules) {
      let matches = true
      if (rule.os) {
        const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
        if (rule.os.name && rule.os.name !== osName) matches = false
        if (rule.os.arch) {
          const archMap: Record<string, string> = { 'x86': 'ia32', 'x86_64': 'x64', 'amd64': 'x64', 'arm64': 'arm64' }
          const expectedArch = archMap[rule.os.arch] || rule.os.arch
          if (expectedArch !== process.arch) matches = false
        }
        if (rule.os.version && !new RegExp(rule.os.version).test(os.release())) matches = false
      }
      if (rule.features) {
        // Game features like 'is_demo_user', 'has_custom_resolution', etc.
        // We don't set these features, so they don't match
        matches = false
      }
      if (matches) {
        result = rule.action === 'allow'
      }
    }
    return result
  }

  private filterJvmArgs(args: string[], javaMajor: number): { filtered: string[]; removed: string[] } {
    // Known JVM flags that only work on specific Java versions
    const versionBlocklist: Array<{ pattern: string; minVersion: number }> = [
      { pattern: '--sun-misc-unsafe-memory-access', minVersion: 22 },
      { pattern: '--enable-preview', minVersion: 21 },
    ]
    // Known JVM flags that only work on specific platforms
    const platformOnly: Array<{ arg: string; platform: string }> = [
      { arg: '-XstartOnFirstThread', platform: 'darwin' },
    ]
    // Known JVM flags that need specific GC support
    const gcBlocklist: Array<{ pattern: string; minVersion: number }> = [
      { pattern: '-XX:+UseZGC', minVersion: 21 },
      { pattern: '-XX:+ZGenerational', minVersion: 21 },
    ]

    const filtered: string[] = []
    const removed: string[] = []
    for (const arg of args) {
      let keep = true

      // 1) Java version incompatibilities
      for (const { pattern, minVersion } of versionBlocklist) {
        if (arg.startsWith(pattern) && javaMajor < minVersion) {
          removed.push(`${arg} (Java ${javaMajor} < ${minVersion})`)
          keep = false
          break
        }
      }

      // 2) Platform-specific args
      if (keep) {
        for (const { arg: flag, platform } of platformOnly) {
          if (arg === flag && process.platform !== platform) {
            removed.push(`${arg} (${platform} only, running on ${process.platform})`)
            keep = false
            break
          }
        }
      }

      // 3) GC flags needing specific Java version
      if (keep) {
        for (const { pattern, minVersion } of gcBlocklist) {
          if (arg.startsWith(pattern) && javaMajor < minVersion) {
            removed.push(`${arg} (Java ${javaMajor} < ${minVersion})`)
            keep = false
            break
          }
        }
      }

      // 4) Aggressive safety: block any --XX flags that Java might not recognize
      //    for the detected version (prevents 'Unrecognized option' crashes)
      if (keep && javaMajor <= 17) {
        if (arg.startsWith('--')) {
          // Double-dash flags (--flag) are experimental/preview features
          // Only Java 22+ uses these; filter all for Java < 22
          removed.push(`${arg} (experimental flag, Java ${javaMajor})`)
          keep = false
        }
      }

      if (keep) filtered.push(arg)
    }
    return { filtered, removed }
  }

  private buildExtraArgs(instance: any): string[] {
    const args: string[] = []
    if (instance.resolution) { args.push('--width', String(instance.resolution.width), '--height', String(instance.resolution.height)) }
    if (instance.fullscreen) args.push('--fullscreen')
    return args
  }

  /**
   * Extract native JARs (.dll/.so/.dylib) for pre-1.13 Minecraft versions.
   * Uses yauzl to unzip native classifier JARs into the natives/ directory.
   */
  private async extractNatives(installed: any): Promise<void> {
    const yauzl = require('yauzl')
    const versionJsonPath = installed.jsonPath
    if (!fs.existsSync(versionJsonPath)) return
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
    const nativesDir = path.join(installed.gameDir, 'natives')
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true })
    const platformKey = process.platform === 'win32' ? 'natives-windows' : process.platform === 'darwin' ? 'natives-osx' : 'natives-linux'
    const archMap: Record<string, string> = { 'x64': 'x86_64', 'ia32': 'x86', 'arm64': 'arm64' }
    const arch = archMap[process.arch] || process.arch
    const rootGamePath = this.storage.getAllSettings().gameDir || path.join(this.storage.getBasePath(), 'instances')
    const libsBase = path.join(rootGamePath, 'libraries')
    const libraries = versionJson.libraries || []
    let extracted = 0
    for (const lib of libraries) {
      let classifierKey = lib.natives?.[process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux']
      if (classifierKey && typeof classifierKey === 'string') classifierKey = classifierKey.replace('${arch}', arch)
      const classifiers = lib.downloads?.classifiers
      let nativeJar: any = null
      if (classifierKey && classifiers?.[classifierKey]) nativeJar = classifiers[classifierKey]
      else if (classifiers?.[platformKey]) nativeJar = classifiers[platformKey]
      if (nativeJar?.path) {
        const jarPath = path.join(libsBase, nativeJar.path)
        if (fs.existsSync(jarPath)) {
          try {
            await this.extractJarToDir(yauzl, jarPath, nativesDir)
            extracted++
          } catch (e: any) {
            this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Failed to extract native JAR ${nativeJar.path}: ${e.message}` })
          }
        }
      }
    }
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Extracted ${extracted} native JARs to ${nativesDir}` })
  }

  private extractJarToDir(yauzl: any, jarPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      yauzl.open(jarPath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) return reject(err)
        zipfile.readEntry()
        zipfile.on('entry', (entry: any) => {
          const fileName = path.basename(entry.fileName).toLowerCase()
          const isNative = fileName.endsWith('.dll') || fileName.endsWith('.so') ||
                          fileName.endsWith('.dylib') || fileName.endsWith('.jnilib') || fileName.endsWith('.exe')
          if (!isNative || entry.fileName.includes('META-INF')) { zipfile.readEntry(); return }
          const outPath = path.join(destDir, path.basename(entry.fileName))
          zipfile.openReadStream(entry, (err2: any, readStream: any) => {
            if (err2) { zipfile.readEntry(); return }
            const writeStream = fs.createWriteStream(outPath)
            readStream.pipe(writeStream)
            writeStream.on('close', () => zipfile.readEntry())
            writeStream.on('error', () => zipfile.readEntry())
          })
        })
        zipfile.on('end', () => resolve())
        zipfile.on('error', (e: any) => reject(e))
      })
    })
  }

  private parseLog(line: string, source: string): LogEntry {
    const mc = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\/(\w+)\]?\s*(.*)/)
    if (mc) return { timestamp: mc[1], source, level: mc[3]?.toUpperCase() || 'INFO', message: mc[4] }
    const java = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+)\s+(\w+)\s*\[.*\]\s*(.*)/)
    if (java) return { timestamp: java[1], source, level: java[2]?.toUpperCase() || 'INFO', message: java[3] }
    return { timestamp: new Date().toISOString(), source, level: 'INFO', message: line }
  }

  private crashReport(instanceId: string, code: number | null, signal: NodeJS.Signals | null, logs: LogEntry[]): string {
    return [`=== Minecraft Launcher Crash Report ===`, `Instance: ${instanceId}`, `Exit Code: ${code}`, `Signal: ${signal || 'none'}`, `Time: ${new Date().toISOString()}`, `Platform: ${process.platform} ${process.arch}`, '', `=== Last Log Lines ===`, ...logs.slice(-100).map(l => `[${l.level}] ${l.message}`), '', `=== Possible Causes ===`, code === 1 ? '- Out of memory' : '', '- Check crash-reports in game directory'].filter(Boolean).join('\n')
  }
}

export default ProcessManager
