import * as fs from 'fs'
import * as path from 'path'
import { Storage } from '../storage/database'
import { Instance } from '../../shared/types'

export class InstanceManager {
  private storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  create(params: { name: string; versionId: string; versionType?: string; javaPath?: string; minMemory?: number; maxMemory?: number; jvmArgs?: string[]; resolution?: { width: number; height: number }; fullscreen?: boolean }): Instance {
    const settings = this.storage.getAllSettings()
    const id = params.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() + '_' + Date.now().toString(36)
    const gameDir = path.join(settings.gameDir || '', id)

    const dirs = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'config', 'logs', 'crash-reports']
    for (const dir of dirs) {
      const p = path.join(gameDir, dir)
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    }

    const instance: Instance = {
      id, name: params.name, versionId: params.versionId,
      versionType: params.versionType || 'release',
      createdAt: new Date().toISOString(), lastPlayed: null, gameDir,
      minMemory: params.minMemory || parseInt(settings.minMemory as any) || 512,
      maxMemory: params.maxMemory || parseInt(settings.maxMemory as any) || 2048,
      javaPath: params.javaPath || settings.javaPath || '',
      jvmArgs: params.jvmArgs || [], gameArgs: [],
      closeOnLaunch: false, showConsole: true,
      resolution: params.resolution || { width: 854, height: 480 },
      fullscreen: params.fullscreen || false, modloader: null, playTime: 0
    }

    this.storage.saveInstance(instance)
    return instance
  }

  update(id: string, updates: Partial<Instance>): Instance {
    const instance = this.storage.getInstance(id)
    if (!instance) throw new Error(`Instance not found: ${id}`)
    const updated = { ...instance, ...updates }
    this.storage.saveInstance(updated)
    return updated
  }

  delete(id: string): void {
    const instance = this.storage.getInstance(id)
    if (instance && fs.existsSync(instance.gameDir)) {
      try { fs.rmSync(instance.gameDir, { recursive: true, force: true }) } catch {}
    }
    this.storage.deleteInstance(id)
  }

  list(): Instance[] { return this.storage.getInstances() }
  get(id: string): Instance | null { return this.storage.getInstance(id) }

  markPlayed(id: string): void {
    const inst = this.get(id)
    if (inst) this.update(id, { lastPlayed: new Date().toISOString() })
  }

  addPlayTime(id: string, minutes: number): void {
    const inst = this.get(id)
    if (inst) this.update(id, { playTime: (inst.playTime || 0) + minutes })
  }

  installModloader(id: string, type: string, version: string): Instance {
    return this.update(id, { modloader: { type, version } })
  }
}

export default InstanceManager
