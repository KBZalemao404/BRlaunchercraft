import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { UserProfile, SkinInfo } from '../../shared/types'
import { randomUUID } from 'crypto'

export class ProfileManager extends EventEmitter {
  private basePath: string
  private profilesPath: string
  private skinsPath: string
  private profiles: Map<string, UserProfile> = new Map()
  private skins: SkinInfo[] = []
  private activeProfileId: string | null = null

  constructor(appDataPath: string) {
    super()
    this.basePath = path.join(appDataPath, 'profiles')
    this.profilesPath = path.join(this.basePath, 'profiles.json')
    this.skinsPath = path.join(this.basePath, 'skins')
    this.ensureDirs()
    this.load()
  }

  private ensureDirs() {
    if (!fs.existsSync(this.basePath)) fs.mkdirSync(this.basePath, { recursive: true })
    if (!fs.existsSync(this.skinsPath)) fs.mkdirSync(this.skinsPath, { recursive: true })
  }

  private load() {
    try {
      if (fs.existsSync(this.profilesPath)) {
        const data = JSON.parse(fs.readFileSync(this.profilesPath, 'utf8'))
        if (data.profiles) {
          for (const p of data.profiles) this.profiles.set(p.id, p)
        }
        this.activeProfileId = data.activeProfileId || null
        this.skins = data.skins || []
      }
    } catch {}
  }

  private save() {
    const data = {
      profiles: Array.from(this.profiles.values()),
      activeProfileId: this.activeProfileId,
      skins: this.skins
    }
    fs.writeFileSync(this.profilesPath, JSON.stringify(data, null, 2), 'utf8')
  }

  // ── Profile CRUD ──

  list(): UserProfile[] {
    return Array.from(this.profiles.values())
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
  }

  get(id: string): UserProfile | null {
    return this.profiles.get(id) || null
  }

  getActive(): UserProfile | null {
    if (!this.activeProfileId) return null
    return this.profiles.get(this.activeProfileId) || null
  }

  create(data: { username: string; type: 'microsoft' | 'offline'; uuid?: string; accessToken?: string; refreshToken?: string; expiresAt?: number; skinUrl?: string; skinModel?: 'classic' | 'slim' }): UserProfile {
    // Check if username already exists
    for (const p of this.profiles.values()) {
      if (p.username === data.username && p.type === data.type) {
        throw new Error(`Perfil "${data.username}" já existe.`)
      }
    }

    const profile: UserProfile = {
      id: randomUUID(),
      username: data.username,
      uuid: data.uuid || this.generateOfflineUUID(data.username),
      type: data.type,
      skinUrl: data.skinUrl,
      skinModel: data.skinModel || 'classic',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      playTime: 0,
      gamesPlayed: 0,
      isFavorite: false,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt
    }

    this.profiles.set(profile.id, profile)
    this.save()
    this.emit('profile-created', profile)
    return profile
  }

  update(id: string, updates: Partial<UserProfile>): UserProfile | null {
    const profile = this.profiles.get(id)
    if (!profile) return null

    Object.assign(profile, updates)
    this.save()
    this.emit('profile-updated', profile)
    return profile
  }

  delete(id: string): boolean {
    const profile = this.profiles.get(id)
    if (!profile) return false

    this.profiles.delete(id)
    if (this.activeProfileId === id) this.activeProfileId = null

    // Delete skin files
    const skinDir = path.join(this.skinsPath, id)
    if (fs.existsSync(skinDir)) fs.rmSync(skinDir, { recursive: true, force: true })

    this.save()
    this.emit('profile-deleted', id)
    return true
  }

  setActive(id: string): UserProfile | null {
    const profile = this.profiles.get(id)
    if (!profile) return null

    this.activeProfileId = id
    profile.lastUsedAt = new Date().toISOString()
    this.save()
    this.emit('profile-switched', profile)
    return profile
  }

  // ── Skin Management ──

  getSkins(): SkinInfo[] {
    return [...this.skins]
  }

  async addSkinFromUrl(name: string, url: string, model: 'classic' | 'slim' = 'classic'): Promise<SkinInfo> {
    // Download skin
    const skinData = await this.downloadSkin(url)
    const id = randomUUID()
    const fileName = `${id}.png`
    const filePath = path.join(this.skinsPath, fileName)

    fs.writeFileSync(filePath, skinData)

    const skin: SkinInfo = {
      id,
      name,
      url,
      model,
      source: 'url',
      addedAt: new Date().toISOString(),
      preview: `data:image/png;base64,${skinData.toString('base64')}`
    }

    this.skins.push(skin)
    this.save()
    this.emit('skin-added', skin)
    return skin
  }

  addSkinFromFile(name: string, filePath: string, model: 'classic' | 'slim' = 'classic'): SkinInfo {
    if (!fs.existsSync(filePath)) throw new Error('Arquivo de skin não encontrado.')

    const skinData = fs.readFileSync(filePath)
    const id = randomUUID()
    const destPath = path.join(this.skinsPath, `${id}.png`)

    fs.copyFileSync(filePath, destPath)

    const skin: SkinInfo = {
      id,
      name,
      url: `local://${id}.png`,
      model,
      source: 'file',
      addedAt: new Date().toISOString(),
      preview: `data:image/png;base64,${skinData.toString('base64')}`
    }

    this.skins.push(skin)
    this.save()
    this.emit('skin-added', skin)
    return skin
  }

  deleteSkin(id: string): boolean {
    const idx = this.skins.findIndex(s => s.id === id)
    if (idx === -1) return false

    const skin = this.skins[idx]
    const filePath = path.join(this.skinsPath, `${id}.png`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    this.skins.splice(idx, 1)
    this.save()
    this.emit('skin-deleted', id)
    return true
  }

  applySkinToProfile(profileId: string, skinId: string): UserProfile | null {
    const profile = this.profiles.get(profileId)
    if (!profile) return null

    const skin = this.skins.find(s => s.id === skinId)
    if (!skin) return null

    profile.skinUrl = skin.url
    profile.skinModel = skin.model
    this.save()
    this.emit('skin-applied', { profileId, skinId })
    return profile
  }

  // ── Stats ──

  addPlayTime(profileId: string, minutes: number) {
    const profile = this.profiles.get(profileId)
    if (profile) {
      profile.playTime += minutes
      profile.gamesPlayed++
      this.save()
    }
  }

  // ── Helpers ──

  private generateOfflineUUID(name: string): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + name).digest()
    hash[6] = (hash[6] & 0x0f) | 0x30
    hash[8] = (hash[8] & 0x3f) | 0x80
    const hex = hash.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  private downloadSkin(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const https = require('https')
      const http = require('http')
      const client = url.startsWith('https') ? https : http

      client.get(url, { timeout: 15000, headers: { 'User-Agent': 'MinecraftLauncher/0.1.1' } }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          this.downloadSkin(res.headers.location).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      }).on('error', reject)
    })
  }

  // ── Skin URL helpers ──

  getSkinTextureUrl(uuid: string): string {
    // Mojang texture URL
    return `https://mc-heads.net/body/${uuid.replace(/-/g, '')}/128`
  }

  getHeadUrl(uuid: string): string {
    return `https://mc-heads.net/head/128/${uuid.replace(/-/g, '')}`
  }

  getAvatarUrl(uuid: string): string {
    return `https://mc-heads.net/avatar/128/${uuid.replace(/-/g, '')}`
  }
}

export default ProfileManager
