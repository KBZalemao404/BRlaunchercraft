import { useState, useEffect, useRef } from 'react'
import type { LogEntry } from '../../shared/types'

interface Props { logs: LogEntry[] }

export default function ConsolePage({ logs }: Props) {
  const [filter, setFilter] = useState<'all' | 'minecraft' | 'launcher' | 'java'>('all')
  const [levelFilter, setLevelFilter] = useState<'all' | 'INFO' | 'WARN' | 'ERROR'>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs, autoScroll])

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.source !== filter) return false
    if (levelFilter !== 'all' && l.level !== levelFilter) return false
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const clear = () => { /* logs are managed by App */ }
  const copy = () => navigator.clipboard?.writeText(filtered.map(l => `[${l.timestamp}] [${l.level}/${l.source}] ${l.message}`).join('\n'))
  const exportLogs = () => {
    const blob = new Blob([filtered.map(l => `[${l.timestamp}] [${l.level}/${l.source}] ${l.message}`).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mc-logs-${new Date().toISOString().slice(0, 10)}.log`; a.click(); URL.revokeObjectURL(url)
  }
  const exportDiag = async () => { try { const d = await window.electronAPI?.exportDiagnostics(); const blob = new Blob([d || ''], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `diagnostics-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url) } catch {} }

  const lvlColor = (l: string) => l === 'ERROR' || l === 'FATAL' ? 'var(--rose)' : l === 'WARN' ? 'var(--orange)' : 'var(--accent)'
  const srcIcon = (s: string) => s === 'minecraft' ? '🎮' : s === 'launcher' ? '⬡' : s === 'java' ? '☕' : '📄'

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 className="page-title">📋 Console</h1><p className="page-subtitle">Logs em tempo real</p></div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={copy}>📋 Copiar</button>
            <button className="btn btn-secondary btn-sm" onClick={exportLogs}>💾 Exportar</button>
            <button className="btn btn-secondary btn-sm" onClick={exportDiag}>📊 Diagnóstico</button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: '280px' }}><span className="search-icon">🔍</span><input className="form-input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px', fontSize: '12px' }} /></div>
        <select className="form-input" value={filter} onChange={e => setFilter(e.target.value as any)} style={{ width: '130px', fontSize: '12px' }}>
          <option value="all">Todos</option><option value="minecraft">🎮 Minecraft</option><option value="launcher">⬡ Launcher</option><option value="java">☕ Java</option>
        </select>
        <select className="form-input" value={levelFilter} onChange={e => setLevelFilter(e.target.value as any)} style={{ width: '120px', fontSize: '12px' }}>
          <option value="all">Todos</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option>
        </select>
        <label className="form-checkbox" style={{ fontSize: '12px' }}><input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /><span>Auto-scroll</span></label>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filtered.length} linhas</span>
      </div>
      <div className="console-container" ref={ref}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}><div style={{ fontSize: '36px', marginBottom: '10px' }}>📋</div><p>Nenhum log ainda. Inicie o Minecraft para ver logs aqui.</p></div>
        ) : filtered.map((l, i) => (
          <div key={i} className={`console-line ${l.level.toLowerCase()}`}>
            <span className="console-time">{l.timestamp.includes('T') ? l.timestamp.split('T')[1]?.split('.')[0] || l.timestamp : l.timestamp}</span>
            <span>{srcIcon(l.source)}</span>
            <span className="console-level" style={{ color: lvlColor(l.level) }}>[{l.level}]</span>
            <span className="console-message">{l.message}</span>
          </div>
        ))}
      </div>
    </>
  )
}
