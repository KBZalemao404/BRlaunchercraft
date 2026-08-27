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
    const gamePath = allSettings.gameDir || path.join(this.storage['basePath'] || '', 'instances')
    const minecraft = new MinecraftFolder(gamePath)

    // Find Java
    let javaPath = instance.javaPath || allSettings.javaPath || ''
    if (!javaPath) {
      const best = this.javaManager.findBest(
        fs.existsSync(installed.jsonPath) ? JSON.parse(fs.readFileSync(installed.jsonPath, 'utf8')) : {}
      )
      if (best) javaPath = best.path
    }
    if (!javaPath) throw new Error('Java não encontrado. Instale Java para jogar.')

    // Ensure directories
    const logDir = path.join(instance.gameDir, 'logs')
    const crashDir = path.join(instance.gameDir, 'crash-reports')
    for (const d of [logDir, crashDir]) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }

    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Iniciando Minecraft ${instance.versionId}` })

    // Detect Java major version to filter incompatible JVM args
    const javaMajor = this.getJavaMajor(javaPath)
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java major version: ${javaMajor}` })

    // Use our controlled launch (not @xmcl/core which adds incompatible args from version JSON)
    return this.fallbackLaunch(instanceId, instance, installed, javaPath, authAccount, logDir, crashDir, javaMajor)
  }

  private fallbackLaunch(instanceId: string, instance: any, installed: any, javaPath: string, authAccount: AuthAccount | null, logDir: string, crashDir: string, javaMajor: number = 17): { pid: number; instanceId: string } {
    const allSettings = this.storage.getAllSettings()
    const rootGamePath = allSettings.gameDir || path.join(this.storage['basePath'] || '', 'instances')
    const versionJson = JSON.parse(fs.readFileSync(installed.jsonPath, 'utf8'))
    const sep = path.delimiter
    let classpath = installed.jarPath
    for (const lib of versionJson.libraries || []) {
      if (lib.downloads?.artifact) {
        const libPath = path.join(installed.librariesPath, lib.downloads.artifact.path || lib.name.replace(/:/g, '/'))
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

    const args = [
      `-Xms${instance.minMemory}M`, `-Xmx${instance.maxMemory}M`,
      ...filtered,
      ...(instance.jvmArgs || []),
      `-Djava.library.path=${path.join(installed.gameDir, 'natives')}`,
      `-Dminecraft.launcher.brand=minecraftlauncher`, `-Dminecraft.launcher.version=0.1.8`,
      '-cp', classpath, versionJson.mainClass || 'net.minecraft.client.main.Main',
      '--username', authAccount?.username || 'Player', '--version', instance.versionId,
      '--gameDir', instance.gameDir, '--assetsDir', rootGamePath + '/assets',
      '--assetIndex', versionJson.assetIndex?.id || instance.versionId,
      '--uuid', authAccount?.uuid || '00000000-0000-0000-0000-000000000000',
      '--accessToken', authAccount?.accessToken || '0',
      '--userType', authAccount?.type === 'microsoft' ? 'msa' : 'legacy',
      '--versionType', 'MinecraftLauncher'
    ]
    this.emit('log', { timestamp: new Date().toISOString(), level: 'INFO', source: 'launcher', message: `Java: ${javaPath}` })
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
      const output = execSync(`"${javaPath}" -version 2>&1`, { timeout: 5000, encoding: 'utf8' })
      const match = output.match(/version "([\d.]+)/)
      if (match) {
        const parts = match[1].split('.')
        return parseInt(parts[0]) || 17
      }
    } catch {}
    return 17 // default to 17
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
