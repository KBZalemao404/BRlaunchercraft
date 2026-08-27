import { useState, useEffect, useCallback } from 'react'
import type { Page, AuthAccount, Instance, InstalledVersion, SystemInfo, AppSettings, LogEntry } from '../shared/types'
import { useUpdate } from './hooks/useUpdate'
import { useHeartbeat } from './hooks/useHeartbeat'

declare global { interface Window { electronAPI: any } }

// Lazy load pages
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import VersionsPage from './pages/VersionsPage'
import InstancesPage from './pages/InstancesPage'
import ModsPage from './pages/ModsPage'
import DownloadsPage from './pages/DownloadsPage'
import ConsolePage from './pages/ConsolePage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import UpdateBanner from './components/UpdateBanner'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [pageKey, setPageKey] = useState(0)
  const [account, setAccount] = useState<AuthAccount | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])
  const [installedVersions, setInstalledVersions] = useState<Record<string, InstalledVersion>>({})
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [profiles, setProfiles] = useState<any[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [gameRunning, setGameRunning] = useState<Record<string, boolean>>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [splashDone, setSplashDone] = useState(false)
  const update = useUpdate()
  useHeartbeat(update.state.currentVersion)

  const nav = useCallback((p: Page) => { setPage(p); setPageKey(k => k + 1) }, [])
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => { init(); return () => cleanup() }, [])

  const init = async () => {
    try {
      const [acc, insts, vers, sys, sets, profs, activeProf] = await Promise.all([
        window.electronAPI?.getAccount(), window.electronAPI?.listInstances(),
        window.electronAPI?.getInstalledVersions(), window.electronAPI?.getSystemInfo(),
        window.electronAPI?.getSettings(), window.electronAPI?.listProfiles?.(),
        window.electronAPI?.getActiveProfile?.()
      ])
      setAccount(acc); setInstances(insts || []); setInstalledVersions(vers || {})
      setSystemInfo(sys); setSettings(sets); setProfiles(profs || [])
      if (activeProf) setActiveProfileId(activeProf.id)
      if (insts?.length > 0) setSelectedInstanceId(insts[0].id)
      setupListeners()
    } catch (e) { console.error('Init error:', e) } finally { setLoading(false) }
  }

  const reload = async () => {
    const [insts, vers] = await Promise.all([window.electronAPI?.listInstances(), window.electronAPI?.getInstalledVersions()])
    setInstances(insts || []); setInstalledVersions(vers || {})
  }

  const setupListeners = () => {
    window.electronAPI?.onAuthSuccess?.((a: any) => { setAccount(a); showToast('Login realizado!', 'success') })
    window.electronAPI?.onAuthExpired?.(() => { setAccount(null); showToast('Sessão expirada.', 'info') })
    window.electronAPI?.onGameLaunched?.((d: any) => { setGameRunning(p => ({ ...p, [d.instanceId]: true })); showToast('Minecraft iniciado!', 'success') })
    window.electronAPI?.onGameExited?.((d: any) => { setGameRunning(p => { const n = { ...p }; delete n[d.instanceId]; return n }); if (d.code !== 0) showToast(`Encerrou com código ${d.code}`, 'error') })
    window.electronAPI?.onGameError?.((d: any) => { setGameRunning(p => { const n = { ...p }; delete n[d.instanceId]; return n }); showToast(`Erro: ${d.error}`, 'error') })
    window.electronAPI?.onGameLog?.((d: LogEntry) => setLogs(p => [...p.slice(-4999), d]))
    window.electronAPI?.onUpdateState?.((s: any) => {
      if (s.status === 'downloaded') showToast(`Update v${s.info?.version} disponível!`, 'info')
    })
  }

  const cleanup = () => {
    ['auth-progress','auth-success','auth-error','auth-expired','game-launched','game-exited','game-error','game-log','download-progress','download-completed','download-failed','version-progress','launcher-log','update:state']
      .forEach(ch => window.electronAPI?.removeAllListeners(ch))
  }

  // Handlers
  const handleInstallVersion = async (id: string, url: string, type: string) => {
    try { await window.electronAPI?.installVersion({ versionId: id, versionUrl: url, versionType: type }); await reload(); showToast(`${id} instalada!`, 'success') }
    catch (e: any) { showToast(`Erro: ${e.message}`, 'error') }
  }
  const handleUninstallVersion = async (id: string) => { try { await window.electronAPI?.uninstallVersion(id); await reload(); showToast('Versão removida', 'success') } catch (e: any) { showToast(`Erro: ${e.message}`, 'error') } }
  const handleCreateInstance = async (d: any) => { try { await window.electronAPI?.createInstance(d); await reload(); showToast('Instância criada!', 'success') } catch (e: any) { showToast(`Erro: ${e.message}`, 'error') } }
  const handleUpdateInstance = async (id: string, u: any) => { try { await window.electronAPI?.updateInstance(id, u); await reload(); showToast('Atualizada!', 'success') } catch (e: any) { showToast(`Erro: ${e.message}`, 'error') } }
  const handleDeleteInstance = async (id: string) => { try { await window.electronAPI?.deleteInstance(id); await reload(); showToast('Removida', 'success') } catch (e: any) { showToast(`Erro: ${e.message}`, 'error') } }
  const handleLaunch = async (instanceId: string) => {
    if (!account) { showToast('Faça login para jogar', 'info'); nav('login'); return }
    if (gameRunning[instanceId]) { showToast('Já está em execução', 'info'); return }
    try { await window.electronAPI?.launchGame({ instanceId }) } catch (e: any) { showToast(e.message, 'error') }
  }
  const handleSaveSettings = async (s: AppSettings) => { try { await window.electronAPI?.saveSettings(s); setSettings(s); showToast('Configurações salvas!', 'success') } catch (e: any) { showToast(`Erro: ${e.message}`, 'error') } }

  const reloadProfiles = async () => {
    const [profs, activeProf] = await Promise.all([window.electronAPI?.listProfiles?.(), window.electronAPI?.getActiveProfile?.()])
    setProfiles(profs || []); if (activeProf) setActiveProfileId(activeProf.id)
  }

  const handleSwitchProfile = async (id: string) => { try { await window.electronAPI?.setActiveProfile?.(id); await reloadProfiles(); showToast('Perfil alterado!', 'success') } catch (e: any) { showToast(e.message, 'error') } }
  const handleCreateProfile = async (d: any) => { try { await window.electronAPI?.createProfile?.(d); await reloadProfiles(); showToast('Perfil criado!', 'success') } catch (e: any) { showToast(e.message, 'error') } }
  const handleDeleteProfile = async (id: string) => { try { await window.electronAPI?.deleteProfile?.(id); await reloadProfiles(); showToast('Perfil removido', 'success') } catch (e: any) { showToast(e.message, 'error') } }

  const renderPage = () => {
    switch (page) {
      case 'home': return <HomePage account={account} instances={instances} installedVersions={installedVersions} selectedInstanceId={selectedInstanceId} onSelectInstance={setSelectedInstanceId} onNavigate={nav} onLaunch={handleLaunch} gameRunning={gameRunning} />
      case 'login': return <LoginPage onAccountReady={() => nav('home')} />
      case 'versions': return <VersionsPage installedVersions={installedVersions} onInstall={handleInstallVersion} onUninstall={handleUninstallVersion} onPlay={(id) => { const inst = instances.find(i => i.versionId === id); if (inst) handleLaunch(inst.id); else { showToast('Crie uma instância para jogar', 'info'); nav('instances') } }} />
      case 'instances': return <InstancesPage instances={instances} installedVersions={installedVersions} onCreate={handleCreateInstance} onUpdate={handleUpdateInstance} onDelete={handleDeleteInstance} onPlay={handleLaunch} onOpenMods={(id) => { setSelectedInstanceId(id); nav('mods') }} />
      case 'mods': return <ModsPage instances={instances} />
      case 'downloads': return <DownloadsPage />
      case 'console': return <ConsolePage logs={logs} />
      case 'settings': return <SettingsPage settings={settings} systemInfo={systemInfo} onSave={handleSaveSettings} updateState={update.state} onCheckUpdate={update.checkForUpdates} onDownloadUpdate={update.downloadUpdate} onInstallUpdate={update.installUpdate} />
      case 'profile': return <ProfilePage profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={handleSwitchProfile} onCreateProfile={handleCreateProfile} onDeleteProfile={handleDeleteProfile} showToast={showToast} />
      default: return null
    }
  }

  if (loading || !splashDone) return <SplashScreen onReady={() => { setLoading(false); setSplashDone(true) }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div className="app-layout">
        <Sidebar currentPage={page} onNavigate={nav} account={account} instanceCount={instances.length} installedCount={Object.keys(installedVersions).length} currentVersion={update.state.currentVersion} updateAvailable={update.isNewVersion} />
        <main className="main-content" key={pageKey}><div className="page-enter">{renderPage()}</div></main>
      </div>
      {toast && <div className={`toast ${toast.type}`} onClick={() => setToast(null)}>{toast.msg}</div>}
      <UpdateBanner state={update.state} onInstall={update.installUpdate} onDismiss={() => {}} />
    </div>
  )
}
