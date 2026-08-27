import { useState, useEffect } from 'react'

export default function DownloadsPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const unsub1 = window.electronAPI?.onDownloadProgress?.(() => load())
    const unsub2 = window.electronAPI?.onDownloadCompleted?.(() => load())
    const unsub3 = window.electronAPI?.onDownloadFailed?.(() => load())
    const interval = setInterval(load, 2000)
    return () => { clearInterval(interval); window.electronAPI?.removeAllListeners('download-progress'); window.electronAPI?.removeAllListeners('download-completed'); window.electronAPI?.removeAllListeners('download-failed') }
  }, [])

  const load = async () => { try { setGroups(await window.electronAPI?.getDownloadStatus() || []) } catch {} finally { setLoading(false) } }
  const fmtSize = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : b > 1048576 ? `${(b / 1048576).toFixed(0)} MB` : `${(b / 1024).toFixed(0)} KB`
  const statusBadge = (s: string) => {
    switch (s) { case 'downloading': return <span className="badge badge-snapshot">⬇️ Baixando</span>; case 'completed': return <span className="badge badge-installed">✅ Concluído</span>; case 'failed': return <span className="badge" style={{ background: 'rgba(255,51,102,0.1)', color: 'var(--rose)' }}>❌ Falhou</span>; default: return <span className="badge">⏳ {s}</span> }
  }

  const active = groups.filter(g => g.status === 'downloading' || g.status === 'pending')
  const done = groups.filter(g => g.status === 'completed')
  const failed = groups.filter(g => g.status === 'failed' || g.status === 'cancelled')

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 className="page-title">⬇️ Downloads</h1><p className="page-subtitle">Acompanhe seus downloads</p></div>
          <button className="btn btn-secondary" onClick={async () => { await window.electronAPI?.clearDownloads(); await load() }}>🧹 Limpar</button>
        </div>
      </div>
      {loading ? <div className="loading-container"><div className="spinner" /></div> : groups.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">⬇️</div><h3 className="empty-title">Nenhum download</h3></div>
      ) : (
        <>
          {active.length > 0 && (
            <><div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Ativos ({active.length})</span><div className="section-divider-line" /></div>
            {active.map(g => { const pct = g.totalSize > 0 ? Math.round((g.downloadedSize / g.totalSize) * 100) : 0; return (
              <div key={g.groupId} className="glass-card" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div><h3 style={{ fontSize: '14px', fontWeight: 700 }}>{g.groupId}</h3><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{g.tasks?.length || 0} arquivo(s)</span></div>
                  {statusBadge(g.status)}
                </div>
                <div className="progress-container"><div className="progress-bar-bg" style={{ height: '7px' }}><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div><div className="progress-text"><span>{fmtSize(g.downloadedSize)} / {fmtSize(g.totalSize)}</span><span style={{ color: 'var(--accent)' }}>{pct}%</span></div></div>
                <button className="btn btn-danger btn-sm" onClick={() => window.electronAPI?.cancelDownloadGroup(g.groupId)}>🛑 Cancelar</button>
              </div>
            )})}</>
          )}
          {done.length > 0 && <><div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Concluídos ({done.length})</span><div className="section-divider-line" /></div>{done.map(g => <div key={g.groupId} className="glass-card" style={{ marginBottom: '8px', opacity: 0.7 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 600 }}>{g.groupId}</span>{statusBadge(g.status)}</div></div>)}</>}
          {failed.length > 0 && <><div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Falhos ({failed.length})</span><div className="section-divider-line" /></div>{failed.map(g => <div key={g.groupId} className="glass-card" style={{ marginBottom: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 600 }}>{g.groupId}</span>{statusBadge(g.status)}</div></div>)}</>}
        </>
      )}
    </>
  )
}
