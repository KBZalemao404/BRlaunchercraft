// ═══════════════════════════════════════════════
// SHARED TYPES - Used by both main and renderer
// ═══════════════════════════════════════════════

// ── Navigation ──
export type Page = 'home' | 'login' | 'versions' | 'instances' | 'mods' | 'downloads' | 'console' | 'settings' | 'news' | 'profile' | 'ai'

// ── Authentication ──
export interface AuthAccount {
  username: string
  uuid: string
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  type: 'microsoft' | 'offline'
  skins?: Array<{ id: string; state: string; url: string; variant: string }>
}

export interface DeviceCodeResponse {
  userCode: string
  verificationUri: string
  expiresInSeconds: number
  interval: number
  message: string
}

// ── Version Manifest ──
export interface VersionManifest {
  latest: { release: string; snapshot: string }
  versions: VersionEntry[]
}

export interface VersionEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

// ── Installed Version ──
export interface InstalledVersion {
  id: string
  type: string
  downloadedAt: string
  jarPath: string
  jsonPath: string
  gameDir: string
  librariesPath: string
  assetsPath: string
  totalSize: number
  javaVersion: number
}

// ── Instance ──
export interface Instance {
  id: string
  name: string
  versionId: string
  versionType: string
  createdAt: string
  lastPlayed?: string | null
  gameDir: string
  minMemory: number
  maxMemory: number
  javaPath: string
  jvmArgs: string[]
  gameArgs: string[]
  closeOnLaunch: boolean
  showConsole: boolean
  resolution?: { width: number; height: number }
  fullscreen: boolean
  modloader?: { type: string; version: string } | null
  playTime: number
  icon?: string
  favorite?: boolean
}

// ── Download ──
export interface DownloadProgress {
  taskId: string
  groupId: string
  total: number
  downloaded: number
  percent: number
  speed: number
  name: string
  status: string
}

export interface DownloadGroup {
  groupId: string
  tasks: any[]
  totalSize: number
  downloadedSize: number
  status: string
  createdAt: string
}

// ── Java ──
export interface JavaInstall {
  path: string
  version: string
  majorVersion: number
  architecture: string
  vendor: string
  compatible: boolean
  verified: boolean
}

// ── Mod ──
export interface ModInfo {
  id: string
  name: string
  version: string
  filename: string
  enabled: boolean
  path: string
  size: number
}

// ── Game Process ──
export interface GameProcess {
  instanceId: string
  pid: number
  status: string
  startTime: string
}

export interface LogEntry {
  timestamp: string
  level: string
  source: string
  message: string
}

// ── Settings ──
export interface AppSettings {
  javaPath: string
  autoDetectJava: boolean
  minMemory: number
  maxMemory: number
  jvmArgs: string
  resolution: { width: number; height: number }
  fullscreen: boolean
  closeOnGameStart: boolean
  keepLauncherOpen: boolean
  showConsole: boolean
  verifyFiles: boolean
  downloadDir: string
  maxConcurrentDownloads: number
  theme: 'dark' | 'light'
  language: string
  gameDir: string
  launcherVersion: string
  autoStart: boolean
  startMinimized: boolean
  minimizeToTray: boolean
}

// ── System ──
export interface SystemInfo {
  platform: string
  arch: string
  cpus: number
  totalMemory: number
  freeMemory: number
  hostname: string
}

// ── News ──
export interface NewsItem {
  id: string
  title: string
  date: string
  summary: string
  imageUrl?: string
  category: string
  url?: string
}

// ── Updater ──
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes?: string
}

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateState {
  status: UpdateStatus
  info?: UpdateInfo
  progress?: UpdateProgress
  error?: string
  currentVersion: string
}

// ── Profile ──
export interface UserProfile {
  id: string
  username: string
  uuid: string
  type: 'microsoft' | 'offline'
  skinUrl?: string
  skinModel?: 'classic' | 'slim'
  capeUrl?: string
  createdAt: string
  lastUsedAt: string
  playTime: number       // total minutes
  gamesPlayed: number
  isFavorite: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

export interface SkinInfo {
  id: string
  name: string
  url: string
  model: 'classic' | 'slim'
  source: 'url' | 'file' | 'library'
  addedAt: string
  preview?: string  // base64 data URL for preview
}

export interface ProfileStats {
  totalPlayTime: number
  gamesPlayed: number
  favoriteInstance?: string
  lastGame?: string
}

// ── World ──
export interface WorldInfo {
  name: string
  folder: string
  lastPlayed?: string
  size: number
  gameMode?: string
}
