/**
 * Storage layer using Upstash Redis REST API.
 * Falls back to in-memory for local dev.
 * 
 * Set env vars:
 *   UPSTASH_REDIS_REST_URL  — from Upstash dashboard
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash dashboard
 */

export interface VersionEntry {
  version: string
  releaseDate: string
  releaseNotes: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileHash: string
  blockMapUrl: string
  channel: 'latest' | 'beta' | 'alpha'
  minClientVersion: string
  published: boolean
  downloads: number
}

export interface ServerState {
  versions: Record<string, VersionEntry>
  lastHeartbeat: string
  totalDownloads: number
  activeClients: number
  clientVersions: Record<string, number>
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ''

// ── In-memory fallback for local dev ──
const memoryState: ServerState = {
  versions: {},
  lastHeartbeat: new Date().toISOString(),
  totalDownloads: 0,
  activeClients: 0,
  clientVersions: {}
}

// ── Upstash REST helpers ──
async function redis(command: string, ...args: string[]): Promise<any> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const res = await fetch(UPSTASH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([command, ...args])
    })
    const data = await res.json()
    return data.result
  } catch {
    return null
  }
}

async function redisGet(key: string): Promise<string | null> {
  return redis('GET', key)
}

async function redisSet(key: string, value: string): Promise<boolean> {
  const result = await redis('SET', key, value)
  return result === 'OK'
}

// ── State persistence ──
async function loadState(): Promise<ServerState> {
  const raw = await redisGet('mc:state')
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  return memoryState
}

async function saveState(state: ServerState): Promise<void> {
  const json = JSON.stringify(state)
  const ok = await redisSet('mc:state', json)
  if (!ok) Object.assign(memoryState, state) // fallback to memory
}

// ── Public API ──

export async function getVersions(): Promise<Record<string, VersionEntry>> {
  const state = await loadState()
  return state.versions
}

export async function getLatestVersion(channel: 'latest' | 'beta' | 'alpha' = 'latest'): Promise<VersionEntry | null> {
  const state = await loadState()
  const published = Object.values(state.versions)
    .filter(v => v.published && v.channel === channel)
    .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
  return published[0] || null
}

export async function getVersion(version: string): Promise<VersionEntry | null> {
  const state = await loadState()
  return state.versions[version] || null
}

export async function addVersion(entry: VersionEntry): Promise<void> {
  const state = await loadState()
  state.versions[entry.version] = entry
  await saveState(state)
}

export async function updateVersion(version: string, updates: Partial<VersionEntry>): Promise<boolean> {
  const state = await loadState()
  if (!state.versions[version]) return false
  Object.assign(state.versions[version], updates)
  await saveState(state)
  return true
}

export async function deleteVersion(version: string): Promise<boolean> {
  const state = await loadState()
  if (!state.versions[version]) return false
  delete state.versions[version]
  await saveState(state)
  return true
}

export async function recordDownload(version: string): Promise<void> {
  const state = await loadState()
  state.totalDownloads++
  if (state.versions[version]) state.versions[version].downloads++
  await saveState(state)
}

export async function recordHeartbeat(clientVersion: string, clientPlatform: string): Promise<ServerState> {
  const state = await loadState()
  state.lastHeartbeat = new Date().toISOString()
  state.activeClients++
  if (!state.clientVersions[clientVersion]) state.clientVersions[clientVersion] = 0
  state.clientVersions[clientVersion]++
  await saveState(state)
  return state
}

export async function decrementActiveClients(): Promise<void> {
  const state = await loadState()
  if (state.activeClients > 0) state.activeClients--
  await saveState(state)
}

export async function getServerStats(): Promise<Omit<ServerState, 'versions'>> {
  const state = await loadState()
  const { versions, ...rest } = state
  return rest
}

export async function checkVersionExists(version: string): Promise<boolean> {
  const state = await loadState()
  return !!state.versions[version]
}
