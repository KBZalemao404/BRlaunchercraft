import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// Browser mock for Electron API (preview/development)
if (!(window as any).electronAPI) {
  const mockVersions: Record<string, any> = {
    '1.21.4': { id: '1.21.4', type: 'release', downloadedAt: '2025-06-15T10:30:00Z', jarPath: '/v/1.21.4.jar', jsonPath: '/v/1.21.4.json', gameDir: '/v/1.21.4', librariesPath: '/v/1.21.4/lib', assetsPath: '/v/assets', totalSize: 524288000, javaVersion: 17 },
    '1.20.6': { id: '1.20.6', type: 'release', downloadedAt: '2025-05-20T14:00:00Z', jarPath: '/v/1.20.6.jar', jsonPath: '/v/1.20.6.json', gameDir: '/v/1.20.6', librariesPath: '/v/1.20.6/lib', assetsPath: '/v/assets', totalSize: 483283200, javaVersion: 17 }
  }
  const mockInstances: any[] = [
    { id: 'survival', name: 'Survival World', versionId: '1.21.4', versionType: 'release', createdAt: '2025-06-16T10:00:00Z', lastPlayed: '2025-08-20T15:30:00Z', gameDir: '/i/survival', minMemory: 512, maxMemory: 4096, javaPath: '', jvmArgs: ['-XX:+UseG1GC'], gameArgs: [], closeOnLaunch: false, showConsole: true, resolution: { width: 1920, height: 1080 }, fullscreen: false, modloader: { type: 'fabric', version: '0.15.11' }, playTime: 1247 },
    { id: 'creative', name: 'Creative Test', versionId: '1.20.6', versionType: 'release', createdAt: '2025-05-21T14:00:00Z', lastPlayed: '2025-07-10T09:00:00Z', gameDir: '/i/creative', minMemory: 2048, maxMemory: 4096, javaPath: '', jvmArgs: [], gameArgs: [], closeOnLaunch: false, showConsole: true, resolution: { width: 1280, height: 720 }, fullscreen: false, modloader: null, playTime: 342 },
    { id: 'modded', name: 'Modded Survival', versionId: '1.21.4', versionType: 'release', createdAt: '2025-07-01T16:00:00Z', lastPlayed: null, gameDir: '/i/modded', minMemory: 2048, maxMemory: 8192, javaPath: '', jvmArgs: ['-XX:+UseG1GC', '-XX:MaxGCPauseMillis=50'], gameArgs: [], closeOnLaunch: false, showConsole: true, resolution: { width: 1920, height: 1080 }, fullscreen: false, modloader: { type: 'forge', version: '47.3.0' }, playTime: 0 }
  ]
  const mockAccount = { username: 'CraftMaster_BR', uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', accessToken: 'mock-token', type: 'microsoft' }
  ;(window as any).electronAPI = {
    minimize: () => {}, maximize: () => {}, close: () => {},
    getSystemInfo: () => Promise.resolve({ platform: 'linux', arch: 'x64', cpus: 8, totalMemory: 16, freeMemory: 9, hostname: 'dev-pc' }),
    selectDirectory: () => Promise.resolve(null), selectFile: () => Promise.resolve(null), selectFiles: () => Promise.resolve(null),
    openUrl: () => {}, openFolder: () => {},
    getSettings: () => Promise.resolve({ javaPath: '/usr/lib/jvm/java-17', autoDetectJava: true, minMemory: 512, maxMemory: 4096, jvmArgs: '-XX:+UseG1GC', resolution: { width: 1920, height: 1080 }, fullscreen: false, closeOnGameStart: false, keepLauncherOpen: true, showConsole: true, verifyFiles: true, downloadDir: '/downloads', maxConcurrentDownloads: 4, theme: 'dark', language: 'pt-BR', gameDir: '/instances', launcherVersion: '0.1.19', autoStart: false, startMinimized: false, minimizeToTray: false }),
    saveSettings: (s: any) => Promise.resolve(s),
    detectJava: () => Promise.resolve([
      { path: '/usr/lib/jvm/java-17/bin/java', version: '17.0.2', majorVersion: 17, architecture: 'x64', vendor: 'Eclipse Adoptium', compatible: true, verified: true },
      { path: '/usr/lib/jvm/java-21/bin/java', version: '21.0.1', majorVersion: 21, architecture: 'x64', vendor: 'Eclipse Temurin', compatible: true, verified: true }
    ]),
    verifyJava: (p: string) => Promise.resolve({ valid: true, info: { version: '17.0.2', vendor: 'Eclipse Adoptium', architecture: 'x64' } }),
    getAccount: () => Promise.resolve(mockAccount),
    startDeviceCode: () => Promise.resolve({ userCode: 'ABC-DEF-GHI', verificationUri: 'https://microsoft.com/link', expiresInSeconds: 900, interval: 5, message: 'Go to the link' }),
    logout: () => Promise.resolve(true),
    loginOffline: (username: string) => Promise.resolve({ username, uuid: '00000000-0000-3000-8000-000000000000', accessToken: '0', type: 'offline' }),
    onAuthProgress: () => {}, onAuthSuccess: () => {}, onAuthError: () => {}, onAuthExpired: () => {},
    fetchManifest: () => Promise.resolve({ latest: { release: '1.21.4', snapshot: '25w14craftmine' }, versions: [
      { id: '1.21.4', type: 'release', url: '#', time: '2025-06-10T12:00:00Z', releaseTime: '2025-06-10T12:00:00Z' },
      { id: '25w14craftmine', type: 'snapshot', url: '#', time: '2025-08-15T12:00:00Z', releaseTime: '2025-08-15T12:00:00Z' },
      { id: '1.21.3', type: 'release', url: '#', time: '2025-05-15T12:00:00Z', releaseTime: '2025-05-15T12:00:00Z' },
      { id: '1.21.2', type: 'release', url: '#', time: '2025-04-10T12:00:00Z', releaseTime: '2025-04-10T12:00:00Z' },
      { id: '1.21.1', type: 'release', url: '#', time: '2025-03-08T12:00:00Z', releaseTime: '2025-03-08T12:00:00Z' },
      { id: '1.21', type: 'release', url: '#', time: '2025-02-12T12:00:00Z', releaseTime: '2025-02-12T12:00:00Z' },
      { id: '1.20.6', type: 'release', url: '#', time: '2024-12-01T12:00:00Z', releaseTime: '2024-12-01T12:00:00Z' },
      { id: '1.20.4', type: 'release', url: '#', time: '2024-08-15T12:00:00Z', releaseTime: '2024-08-15T12:00:00Z' },
      { id: '24w33a', type: 'snapshot', url: '#', time: '2024-08-14T12:00:00Z', releaseTime: '2024-08-14T12:00:00Z' },
      { id: '1.8.9', type: 'old_beta', url: '#', time: '2014-11-15T12:00:00Z', releaseTime: '2014-11-15T12:00:00Z' },
      { id: 'b1.7.3', type: 'old_beta', url: '#', time: '2011-07-01T12:00:00Z', releaseTime: '2011-07-01T12:00:00Z' },
    ] }),
    getInstalledVersions: () => Promise.resolve(mockVersions),
    installVersion: (d: any) => { mockVersions[d.versionId] = { id: d.versionId, type: d.versionType, downloadedAt: new Date().toISOString(), jarPath: `/v/${d.versionId}.jar`, jsonPath: `/v/${d.versionId}.json`, gameDir: `/v/${d.versionId}`, librariesPath: `/v/${d.versionId}/lib`, assetsPath: '/v/assets', totalSize: 500000000, javaVersion: 17 }; return Promise.resolve(mockVersions[d.versionId]) },
    uninstallVersion: (id: string) => { delete mockVersions[id]; return Promise.resolve(true) },
    verifyVersion: () => Promise.resolve({ valid: true, missing: [], corrupted: [] }),
    onVersionProgress: () => {},
    listInstances: () => Promise.resolve(mockInstances),
    getInstance: (id: string) => Promise.resolve(mockInstances.find(i => i.id === id) || null),
    createInstance: (d: any) => { const inst = { id: 'inst_' + Date.now(), name: d.name, versionId: d.versionId, versionType: 'release', createdAt: new Date().toISOString(), lastPlayed: null, gameDir: '/i/' + d.name, minMemory: d.minMemory || 512, maxMemory: d.maxMemory || 2048, javaPath: d.javaPath || '', jvmArgs: d.jvmArgs || [], gameArgs: [], closeOnLaunch: false, showConsole: true, resolution: d.resolution || { width: 854, height: 480 }, fullscreen: d.fullscreen || false, modloader: null, playTime: 0 }; mockInstances.push(inst); return Promise.resolve(inst) },
    updateInstance: (id: string, u: any) => { const i = mockInstances.find(x => x.id === id); if (i) Object.assign(i, u); return Promise.resolve(i) },
    deleteInstance: (id: string) => { const idx = mockInstances.findIndex(x => x.id === id); if (idx >= 0) mockInstances.splice(idx, 1); return Promise.resolve(true) },
    openInstanceFolder: () => Promise.resolve(),
    getDownloadStatus: () => Promise.resolve([]),
    cancelDownload: () => Promise.resolve(true), cancelDownloadGroup: () => Promise.resolve(true), clearDownloads: () => Promise.resolve(true),
    onDownloadProgress: () => {}, onDownloadCompleted: () => {}, onDownloadFailed: () => {},
    listMods: (id: string) => id === 'survival' ? Promise.resolve([
      { id: 'sodium.jar', name: 'Sodium', version: '0.5.8', filename: 'sodium.jar', enabled: true, path: '/m/sodium.jar', size: 5242880 },
      { id: 'iris.jar', name: 'Iris Shaders', version: '1.7.0', filename: 'iris.jar', enabled: true, path: '/m/iris.jar', size: 3145728 },
      { id: 'lithium.jar', name: 'Lithium', version: '0.12.1', filename: 'lithium.jar', enabled: true, path: '/m/lithium.jar', size: 1048576 },
      { id: 'create.jar', name: 'Create', version: '0.5.1', filename: 'create.jar', enabled: true, path: '/m/create.jar', size: 8388608 },
      { id: 'rei.jar', name: 'Roughly Enough Items', version: '15.0.0', filename: 'rei.jar', enabled: false, path: '/m/rei.jar', size: 2097152 }
    ]) : Promise.resolve([]),
    installMods: () => Promise.resolve([]), uninstallMod: () => Promise.resolve(true), toggleMod: (d: any) => Promise.resolve({ enabled: true }),
    openModsFolder: () => {}, installFabric: () => Promise.resolve({ success: true }), installForge: () => Promise.resolve({ success: true }),
    launchGame: () => Promise.resolve({ pid: 12345, instanceId: 'mock' }),
    stopGame: () => Promise.resolve(true), getGameStatus: () => Promise.resolve(null),
    onGameLaunched: () => {}, onGameExited: () => {}, onGameError: () => {}, onGameLog: () => {}, onLauncherLog: () => {},
    fetchNews: () => Promise.resolve([
      { id: '1', title: 'Minecraft 1.21.4 - The Garden Awakens', date: '2025-06-10T12:00:00Z', summary: 'The latest update brings new blocks, mobs, and gameplay mechanics inspired by ancient gardens.', category: 'Update', imageUrl: '' },
      { id: '2', title: 'Minecraft Live 2025 Announced', date: '2025-08-01T12:00:00Z', summary: 'Join us for the annual Minecraft Live event featuring mob votes and community celebrations.', category: 'Event', imageUrl: '' },
      { id: '3', title: 'Snapshot 25w14craftmine', date: '2025-08-15T12:00:00Z', summary: 'The latest snapshot introduces experimental crafting mechanics and new mineable blocks.', category: 'Snapshot', imageUrl: '' }
    ]),
    exportDiagnostics: () => Promise.resolve(JSON.stringify({ version: '0.1.19', platform: 'mock' }, null, 2)),
    getAutoStart: () => Promise.resolve({ openAtLogin: false }),
    setAutoStart: () => Promise.resolve(),
    showNotification: () => Promise.resolve(),
    quitApp: () => Promise.resolve(),
    relaunchApp: () => Promise.resolve(),
    cancelUpdate: () => Promise.resolve(),
    removeAllListeners: () => {},
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
