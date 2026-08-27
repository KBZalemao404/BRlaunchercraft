import { useState, useEffect } from 'react'
import type { InstalledVersion } from '../../shared/types'

interface Props { installedVersions: Record<string, InstalledVersion>; onInstall: (id: string, url: string, type: string) => void; onUninstall: (id: string) => void; onPlay: (id: string) => void }

export default function VersionsPage({ installedVersions, onInstall, onUninstall, onPlay }: Props) {
  const [manifest, setManifest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'release' | 'snapshot' | 'old_beta' | 'old_alpha'>('all')
  const [tab, setTab] = useState<'available' | 'installed'>('available')
  const [installing, setInstalling] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, { percent: number; message: string }>>({})

  useEffect(() => {
    fetchVersions()
    const unsub = window.electronAPI?.onVersionProgress?.((d: any) => {
      if (d.versionId) setProgress(p => ({ ...p, [d.versionId]: { percent: d.percent, message: d.message } }))
      if (d.step === 'complete') { setInstalling(null); setProgress(p => { const n = { ...p }; delete n[d.versionId]; return n }) }
    })
    return () => window.electronAPI?.removeAllListeners('version-progress')
  }, [])

  const fetchVersions = async () => { try { setLoading(true); setError(null); setManifest(await window.electronAPI?.fetchManifest()) } catch (e: any) { setError(e.message) } finally { setLoading(false) } }

  const filtered = manifest?.versions?.filter((v: any) => {
    if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false
    if (filter !== 'all' && v.type !== filter) return false
    return true
  }) || []

  const isInstalled = (id: string) => !!installedVersions[id]
  const isInstalling = (id: string) => installing === id || !!progress[id]
  const installedList = Object.values(installedVersions)

  const typeBadge = (type: string) => {
    switch (type) {
      case 'release': return <span className="badge badge-release">Release</span>
      case 'snapshot': return <span className="badge badge-snapshot">Snapshot</span>
      case 'old_beta': return <span className="badge" style={{ background: 'rgba(255,138,0,0.1)', color: 'var(--orange)' }}>Beta</span>
      case 'old_alpha': return <span className="badge" style={{ background: 'rgba(255,51,102,0.1)', color: 'var(--rose)' }}>Alpha</span>
      default: return <span className="badge">{type}</span>
    }
  }

  return (
    <>
      <div className="page-header"><h1 className="page-title">📦 Versões</h1><p className="page-subtitle">Gerencie versões do Minecraft Java Edition</p></div>
      {error && <div className="alert alert-danger">⚠️ {error}<button className="btn btn-sm btn-secondary" onClick={fetchVersions} style={{ marginLeft: 'auto' }}>Tentar novamente</button></div>}
      <div className="tabs">
        <button className={`tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>📋 Disponíveis {manifest ? `(${filtered.length})` : ''}</button>
        <button className={`tab ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>✅ Instaladas ({installedList.length})</button>
      </div>
      {tab === 'available' && (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div className="search-bar" style={{ flex: 1 }}><span className="search-icon">🔍</span><input className="form-input" placeholder="Buscar versão..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} /></div>
            <select className="form-input" value={filter} onChange={e => setFilter(e.target.value as any)} style={{ width: '150px' }}>
              <option value="all">Todas</option><option value="release">Releases</option><option value="snapshot">Snapshots</option><option value="old_beta">Beta</option><option value="old_alpha">Alpha</option>
            </select>
          </div>
          {loading ? <div className="loading-container"><div className="spinner" /><p style={{ color: 'var(--text-secondary)' }}>Carregando...</p></div> : (
            <div className="card-grid">
              {filtered.map((v: any) => (
                <div key={v.id} className={`version-card ${manifest.latest?.release === v.id && filter === 'all' && !search ? 'featured' : ''}`}>
                  <div className="version-card-header"><span className="badge badge-java">☕ Java</span>{typeBadge(v.type)}</div>
                  <div className="version-name">{v.id}</div>
                  <div className="version-meta"><span>📅 {new Date(v.releaseTime).toLocaleDateString('pt-BR')}</span>{isInstalled(v.id) && <span>✅ Instalada</span>}</div>
                  {isInstalling(v.id) ? (
                    <div className="progress-container"><div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${progress[v.id]?.percent || 0}%` }} /></div><div className="progress-text"><span>{progress[v.id]?.message || 'Instalando...'}</span><span style={{ color: 'var(--accent)' }}>{progress[v.id]?.percent || 0}%</span></div></div>
                  ) : isInstalled(v.id) ? (
                    <div style={{ display: 'flex', gap: '6px' }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onPlay(v.id)}>▶ Jogar</button><button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Remover ${v.id}?`)) onUninstall(v.id) }}>🗑️</button></div>
                  ) : (
                    <button className="btn btn-primary btn-block" onClick={() => { setInstalling(v.id); onInstall(v.id, v.url, v.type) }}>⬇️ Baixar {v.id}</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🔍</div><h3 className="empty-title">Nenhuma versão encontrada</h3></div>}
        </>
      )}
      {tab === 'installed' && (
        installedList.length === 0 ? <div className="empty-state"><div className="empty-icon">📦</div><h3 className="empty-title">Nenhuma versão instalada</h3><button className="btn btn-primary" onClick={() => setTab('available')}>📋 Ver Disponíveis</button></div> : (
          <div className="card-grid">{installedList.map(v => (
            <div key={v.id} className="version-card"><div className="version-card-header"><span className="badge badge-java">☕ Java</span><span className="badge badge-installed">✓ Instalada</span></div><div className="version-name">{v.id}</div>
              <div className="version-meta"><span>📅 {new Date(v.downloadedAt).toLocaleDateString('pt-BR')}</span></div>
              <div style={{ display: 'flex', gap: '6px' }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onPlay(v.id)}>▶ Jogar</button><button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Remover ${v.id}?`)) onUninstall(v.id) }}>🗑️</button></div>
            </div>
          ))}</div>
        )
      )}
    </>
  )
}
