import * as fs from 'fs'
import * as path from 'path'
import { MinecraftFolder } from '@xmcl/core'
import { installFabric, installForge, getFabricLoaderArtifact } from '@xmcl/installer'
import { DownloadManager } from '../downloader/manager'
import { InstanceManager } from '../instances/manager'
import { Storage } from '../storage/database'
import { ModInfo } from '../../shared/types'

export class ModManager {
  private storage: Storage
  private dl: DownloadManager
  private instances: InstanceManager

  constructor(storage: Storage, dl: DownloadManager, instances: InstanceManager) {
    this.storage = storage
    this.dl = dl
    this.instances = instances
  }

  listMods(instanceId: string): ModInfo[] {
    const inst = this.instances.get(instanceId)
    if (!inst) return []
    const modsDir = path.join(inst.gameDir, 'mods')
    if (!fs.existsSync(modsDir)) return []
    const mods: ModInfo[] = []
    for (const file of fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') || f.endsWith('.disabled'))) {
      const filePath = path.join(modsDir, file)
      const enabled = !file.endsWith('.disabled')
      const stat = fs.statSync(filePath)
      const info = this.parseFilename(file)
      mods.push({ id: file, name: info.name || file.replace('.jar', '').replace('.disabled', ''), version: info.version || 'unknown', filename: file, enabled, path: filePath, size: stat.size })
    }
    return mods
  }

  async installMod(instanceId: string, filePaths: string[]): Promise<ModInfo[]> {
    const inst = this.instances.get(instanceId)
    if (!inst) throw new Error('Instance not found')
    const modsDir = path.join(inst.gameDir, 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
    const results: ModInfo[] = []
    for (const fp of filePaths) {
      const filename = path.basename(fp)
      const destPath = path.join(modsDir, filename)
      fs.copyFileSync(fp, destPath)
      const info = this.parseFilename(filename)
      results.push({ id: filename, name: info.name || filename.replace('.jar', ''), version: info.version || 'unknown', filename, enabled: true, path: destPath, size: fs.statSync(destPath).size })
    }
    return results
  }

  uninstallMod(instanceId: string, modFilename: string): void {
    const inst = this.instances.get(instanceId)
    if (!inst) throw new Error('Instance not found')
    const modsDir = path.join(inst.gameDir, 'mods')
    const enabled = path.join(modsDir, modFilename)
    const disabled = path.join(modsDir, modFilename + '.disabled')
    if (fs.existsSync(enabled)) fs.unlinkSync(enabled)
    else if (fs.existsSync(disabled)) fs.unlinkSync(disabled)
    else throw new Error(`Mod não encontrado: ${modFilename}`)
  }

  toggleMod(instanceId: string, modFilename: string): ModInfo {
    const inst = this.instances.get(instanceId)
    if (!inst) throw new Error('Instance not found')
    const modsDir = path.join(inst.gameDir, 'mods')
    const enabled = path.join(modsDir, modFilename)
    const disabled = path.join(modsDir, modFilename + '.disabled')
    if (fs.existsSync(enabled)) { fs.renameSync(enabled, disabled) }
    else if (fs.existsSync(disabled)) { fs.renameSync(disabled, enabled) }
    else throw new Error(`Mod não encontrado: ${modFilename}`)
    const finalPath = fs.existsSync(enabled) ? enabled : disabled
    const info = this.parseFilename(modFilename)
    return { id: modFilename, name: info.name || modFilename.replace('.jar', ''), version: info.version || 'unknown', filename: modFilename, enabled: fs.existsSync(enabled), path: finalPath, size: fs.existsSync(finalPath) ? fs.statSync(finalPath).size : 0 }
  }

  async installFabric(instanceId: string, fabricVersion: string, minecraftVersion: string): Promise<{ success: boolean }> {
    const inst = this.instances.get(instanceId)
    if (!inst) throw new Error('Instance not found')
    const allSettings = this.storage.getAllSettings()
    const gamePath = allSettings.gameDir || path.join(this.storage['basePath'] || '', 'instances')
    const minecraft = new MinecraftFolder(gamePath)
    try {
      // First get the loader artifact
      const loaderArtifact = await getFabricLoaderArtifact(minecraftVersion, fabricVersion)
      await installFabric(loaderArtifact, minecraft)
      this.instances.installModloader(instanceId, 'fabric', fabricVersion)
      return { success: true }
    } catch (e: any) {
      throw new Error(`Falha ao instalar Fabric: ${e.message}`)
    }
  }

  async installForge(instanceId: string, forgeVersion: string, minecraftVersion: string): Promise<{ success: boolean }> {
    const inst = this.instances.get(instanceId)
    if (!inst) throw new Error('Instance not found')
    const allSettings = this.storage.getAllSettings()
    const gamePath = allSettings.gameDir || path.join(this.storage['basePath'] || '', 'instances')
    const minecraft = new MinecraftFolder(gamePath)
    try {
      await installForge({ mcversion: minecraftVersion, version: forgeVersion } as any, minecraft)
      this.instances.installModloader(instanceId, 'forge', forgeVersion)
      return { success: true }
    } catch (e: any) {
      throw new Error(`Falha ao instalar Forge: ${e.message}`)
    }
  }

  openModsFolder(instanceId: string): void {
    const inst = this.instances.get(instanceId)
    if (!inst) return
    const modsDir = path.join(inst.gameDir, 'mods')
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
    const { shell } = require('electron')
    shell.openPath(modsDir)
  }

  private parseFilename(filename: string): { name: string; version: string } {
    const base = filename.replace('.jar', '').replace('.disabled', '')
    const parts = base.split('-')
    if (parts.length >= 2) { const v = parts[parts.length - 1]; if (/^\d/.test(v)) return { name: parts.slice(0, -1).join(' '), version: v } }
    return { name: base, version: 'unknown' }
  }
}

export default ModManager
