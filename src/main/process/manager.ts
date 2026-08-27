import { launch, Version, MinecraftFolder, createMinecraftProcessWatcher } from '@xmcl/core'
import * as fs from 'fs'
import * as path from 'path'
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

    // Try @xmcl/core launch first
    try {
      const proc = await launch({
        gamePath: instance.gameDir, resourcePath: gamePath, javaPath, version: instance.versionId,
        accessToken: authAccount?.accessToken || '0',
        gameProfile: { id: authAccount?.uuid?.replace(/-/g, '') || '00000000000000000000000000000000', name: authAccount?.username || 'Player' },
        userType: 'mojang' as any,
        launcherName: 'MinecraftLauncher', versionType: 'Release',
        extraJVMArgs: this.filterJvmArgs([
          `-Xms${instance.minMemory}M`, `-Xmx${instance.maxMemory}M`,
          ...(instance.jvmArgs || [])
        ], javaMajor),
        extraMCArgs: this.buildExtraArgs(instance),
        resolution: instance.resolution ? { width: instance.resolution.width, height: instance.resolution.height } : undefined,
        extraExecOption: { detached: true, stdio: 'pipe' },
        prechecks: []
      })
      this.setupProcess(proc, instanceId, instance.gameDir, logDir, crashDir, Date.now())
      return { pid: proc.pid!, instanceId }
    } catch (e: any) {
      this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `@xmcl/core launch failed: ${e.message}. Using fallback.` })
      return this.fallbackLaunch(instanceId, instance, installed, javaPath, authAccount, logDir, crashDir)
    }
  }

  private fallbackLaunch(instanceId: string, instance: any, installed: any, javaPath: string, authAccount: AuthAccount | null, logDir: string, crashDir: string): { pid: number; instanceId: string } {
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
    const args = [
      `-Xms${instance.minMemory}M`, `-Xmx${instance.maxMemory}M`, ...(instance.jvmArgs || []),
      `-Djava.library.path=${path.join(installed.gameDir, 'natives')}`,
      `-Dminecraft.launcher.brand=minecraftlauncher`, `-Dminecraft.launcher.version=0.1.5`,
      '-cp', classpath, versionJson.mainClass || 'net.minecraft.client.main.Main',
      '--username', authAccount?.username || 'Player', '--version', instance.versionId,
      '--gameDir', instance.gameDir, '--assetsDir', rootGamePath + '/assets',
      '--assetIndex', versionJson.assetIndex?.id || instance.versionId,
      '--uuid', authAccount?.uuid || '00000000-0000-0000-0000-000000000000',
      '--accessToken', authAccount?.accessToken || '0',
      '--userType', authAccount?.type === 'microsoft' ? 'msa' : 'legacy',
      '--versionType', 'MinecraftLauncher'
    ]
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

  private filterJvmArgs(args: string[], javaMajor: number): string[] {
    // Flags incompatible with Java < 22
    const java22PlusFlags = ['--sun-misc-unsafe-memory-access']
    return args.filter(arg => {
      for (const flag of java22PlusFlags) {
        if (arg.startsWith(flag)) {
          if (javaMajor < 22) {
            this.emit('log', { timestamp: new Date().toISOString(), level: 'WARN', source: 'launcher', message: `Filtered JVM arg (Java ${javaMajor}): ${arg}` })
            return false
          }
        }
      }
      return true
    })
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
