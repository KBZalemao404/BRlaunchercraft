import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  selectDirectory: () => ipcRenderer.invoke('system:select-directory'),
  selectFile: (f: any) => ipcRenderer.invoke('system:select-file', f),
  selectFiles: (f: any) => ipcRenderer.invoke('system:select-files', f),
  openUrl: (u: string) => ipcRenderer.invoke('system:open-url', u),
  openFolder: (p: string) => ipcRenderer.invoke('system:open-folder', p),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: any) => ipcRenderer.invoke('settings:save', s),

  // Java
  detectJava: () => ipcRenderer.invoke('java:detect'),
  verifyJava: (p: string) => ipcRenderer.invoke('java:verify', p),

  // Auth
  getAccount: () => ipcRenderer.invoke('auth:get-account'),
  startDeviceCode: () => ipcRenderer.invoke('auth:start-device-code'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  loginOffline: (username: string) => ipcRenderer.invoke('auth:login-offline', username),
  onAuthProgress: (cb: Function) => ipcRenderer.on('auth-progress', (_, d) => cb(d)),
  onAuthSuccess: (cb: Function) => ipcRenderer.on('auth-success', (_, d) => cb(d)),
  onAuthError: (cb: Function) => ipcRenderer.on('auth-error', (_, d) => cb(d)),
  onAuthExpired: (cb: Function) => ipcRenderer.on('auth-expired', () => cb()),

  // Versions
  fetchManifest: (f?: boolean) => ipcRenderer.invoke('versions:manifest', f),
  getInstalledVersions: () => ipcRenderer.invoke('versions:installed'),
  installVersion: (d: any) => ipcRenderer.invoke('versions:install', d),
  uninstallVersion: (id: string) => ipcRenderer.invoke('versions:uninstall', id),
  verifyVersion: (id: string) => ipcRenderer.invoke('versions:verify', id),
  onVersionProgress: (cb: Function) => ipcRenderer.on('version-progress', (_, d) => cb(d)),

  // Instances
  listInstances: () => ipcRenderer.invoke('instances:list'),
  getInstance: (id: string) => ipcRenderer.invoke('instances:get', id),
  createInstance: (d: any) => ipcRenderer.invoke('instances:create', d),
  updateInstance: (id: string, u: any) => ipcRenderer.invoke('instances:update', id, u),
  deleteInstance: (id: string) => ipcRenderer.invoke('instances:delete', id),
  openInstanceFolder: (id: string) => ipcRenderer.invoke('instances:open-folder', id),

  // Downloads
  getDownloadStatus: () => ipcRenderer.invoke('downloads:status'),
  cancelDownload: (id: string) => ipcRenderer.invoke('downloads:cancel', id),
  cancelDownloadGroup: (id: string) => ipcRenderer.invoke('downloads:cancel-group', id),
  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),
  onDownloadProgress: (cb: Function) => ipcRenderer.on('download-progress', (_, d) => cb(d)),
  onDownloadCompleted: (cb: Function) => ipcRenderer.on('download-completed', (_, d) => cb(d)),
  onDownloadFailed: (cb: Function) => ipcRenderer.on('download-failed', (_, d) => cb(d)),

  // Mods
  listMods: (id: string) => ipcRenderer.invoke('mods:list', id),
  installMods: (d: any) => ipcRenderer.invoke('mods:install', d),
  uninstallMod: (d: any) => ipcRenderer.invoke('mods:uninstall', d),
  toggleMod: (d: any) => ipcRenderer.invoke('mods:toggle', d),
  openModsFolder: (id: string) => ipcRenderer.invoke('mods:open-folder', id),
  installFabric: (d: any) => ipcRenderer.invoke('mods:install-fabric', d),
  installForge: (d: any) => ipcRenderer.invoke('mods:install-forge', d),

  // Game
  launchGame: (d: any) => ipcRenderer.invoke('game:launch', d),
  stopGame: (id: string) => ipcRenderer.invoke('game:stop', id),
  getGameStatus: (id: string) => ipcRenderer.invoke('game:status', id),
  onGameLaunched: (cb: Function) => ipcRenderer.on('game-launched', (_, d) => cb(d)),
  onGameExited: (cb: Function) => ipcRenderer.on('game-exited', (_, d) => cb(d)),
  onGameError: (cb: Function) => ipcRenderer.on('game-error', (_, d) => cb(d)),
  onGameLog: (cb: Function) => ipcRenderer.on('game-log', (_, d) => cb(d)),
  onLauncherLog: (cb: Function) => ipcRenderer.on('launcher-log', (_, d) => cb(d)),

  // Auto-start & System
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled: boolean, startMinimized: boolean) => ipcRenderer.invoke('autostart:set', enabled, startMinimized),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('tray:show-notification', title, body),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  relaunchApp: () => ipcRenderer.invoke('app:relaunch'),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  cancelUpdate: () => ipcRenderer.invoke('update:cancel'),
  getUpdateState: () => ipcRenderer.invoke('update:state'),
  onUpdateState: (cb: Function) => ipcRenderer.on('update:state', (_, d) => cb(d)),

  // Profiles
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  getProfile: (id: string) => ipcRenderer.invoke('profiles:get', id),
  getActiveProfile: () => ipcRenderer.invoke('profiles:get-active'),
  createProfile: (d: any) => ipcRenderer.invoke('profiles:create', d),
  updateProfile: (id: string, u: any) => ipcRenderer.invoke('profiles:update', id, u),
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  setActiveProfile: (id: string) => ipcRenderer.invoke('profiles:set-active', id),
  addSkinFromUrl: (d: any) => ipcRenderer.invoke('profiles:add-skin-url', d),
  addSkinFromFile: (d: any) => ipcRenderer.invoke('profiles:add-skin-file', d),
  deleteSkin: (id: string) => ipcRenderer.invoke('profiles:delete-skin', id),
  applySkin: (d: any) => ipcRenderer.invoke('profiles:apply-skin', d),
  getSkins: () => ipcRenderer.invoke('profiles:get-skins'),
  getAvatarUrl: (uuid: string) => ipcRenderer.invoke('profiles:avatar', uuid),
  onProfileSwitched: (cb: Function) => ipcRenderer.on('profile-switched', (_, d) => cb(d)),

  // News
  fetchNews: () => ipcRenderer.invoke('news:fetch'),

  // Diagnostics
  exportDiagnostics: () => ipcRenderer.invoke('diagnostics:export'),

  // AI Assistant
  aiChat: (msg: string, ctx?: any) => ipcRenderer.invoke('ai:chat', msg, ctx),
  aiDiagnose: (logs: string[]) => ipcRenderer.invoke('ai:diagnose', logs),
  aiSuggestJvm: (sys: any, ver: string) => ipcRenderer.invoke('ai:suggest-jvm', sys, ver),
  aiFixError: (err: string) => ipcRenderer.invoke('ai:fix-error', err),
  aiGetSettings: () => ipcRenderer.invoke('ai:settings'),
  aiUpdateSettings: (s: any) => ipcRenderer.invoke('ai:settings-update', s),
  aiGetModels: () => ipcRenderer.invoke('ai:models'),
  aiGetConversations: () => ipcRenderer.invoke('ai:conversations'),
  aiNewConversation: () => ipcRenderer.invoke('ai:conv-new'),
  aiSelectConversation: (id: string) => ipcRenderer.invoke('ai:conv-select', id),
  aiDeleteConversation: (id: string) => ipcRenderer.invoke('ai:conv-delete', id),
  aiRenameConversation: (id: string, t: string) => ipcRenderer.invoke('ai:conv-rename', id, t),
  aiGetUsage: () => ipcRenderer.invoke('ai:usage'),
  aiResetUsage: () => ipcRenderer.invoke('ai:usage-reset'),
  aiClearHistory: () => ipcRenderer.invoke('ai:clear-history'),
  onAiProgress: (cb: Function) => ipcRenderer.on('ai:progress', (_, d) => cb(d)),

  // Java Auto-Download
  javaAutoDownload: (ver: number) => ipcRenderer.invoke('java:auto-download', ver),
  javaEnsure: (ver: number) => ipcRenderer.invoke('java:ensure', ver),
  javaListManaged: () => ipcRenderer.invoke('java:list-managed'),
  onJavaProgress: (cb: Function) => ipcRenderer.on('java:progress', (_, d) => cb(d)),
  onJavaLog: (cb: Function) => ipcRenderer.on('java:log', (_, d) => cb(d)),

  // Cleanup
  removeAllListeners: (ch: string) => ipcRenderer.removeAllListeners(ch)
})
