/**
 * Storage layer for the update server.
 * Uses Vercel KV in production, in-memory Map for local dev.
 */

export interface VersionEntry {
  version: string
  releaseDate: string
  releaseNotes: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileHash: string       // SHA-512 of the installer
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
  clientVersions: Record<string, number>  // version -> count
}

// ── In-memory store for local dev ──
const memoryStore: ServerState = {
  versions: {},
  lastHeartbeat: new Date().toISOString(),
  totalDownloads: 0,
  activeClients: 0,
  clientVersions: {}
}

function getMemoryStore(): ServerState {
  return memoryStore
}

// ── Vercel KV helpers ──
let kvClient: any = null

async function getKV() {
  if (kvClient) return kvClient
  try {
    const kv = require('@vercel/kv')
    kvClient = kv
    return kv
  } catch {
    return null
  }
}

async function loadState(): Promise<ServerState> {
  const kv = await getKV()
  if (kv) {
    try {
      const versions = await kv.get('versions') || {}
      const meta = await kv.get('meta') || {}
      return {
        versions,
        lastHeartbeat: meta.lastHeartbeat || new Date().toISOString(),
        totalDownloads: meta.totalDownloads || 0,
        activeClients: meta.activeClients || 0,
        clientVersions: meta.clientVersions || {}
      }
    } catch {
      return getMemoryStore()
    }
  }
  return getMemoryStore()
}

async function saveState(state: ServerState): Promise<void> {
  const kv = await getKV()
  if (kv) {
    try {
      await kv.set('versions', state.versions)
      await kv.set('meta', {
        lastHeartbeat: state.lastHeartbeat,
        totalDownloads: state.totalDownloads,
        activeClients: state.activeClients,
        clientVersions: state.clientVersions
      })
    } catch (e) {
      console.error('KV save error:', e)
    }
  } else {
    Object.assign(memoryStore, state)
  }
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
  if (state.versions[version]) {
    state.versions[version].downloads++
  }
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
