import { useState } from 'react'
import type { Instance, InstalledVersion } from '../../shared/types'

interface Props { instances: Instance[]; installedVersions: Record<string, InstalledVersion>; onCreate: (d: any) => void; onUpdate: (id: string, u: any) => void; onDelete: (id: string) => void; onPlay: (id: string) => void; onOpenMods: (id: string) => void }

interface SystemInfo { platform: string; arch: string; cpus: number; totalMemory: number; freeMemory: number; hostname: string }

interface Preset {
  name: string; icon: string; color: string
  minRam: number; maxRam: number
  jvmArgs: string; resolution: { width: number; height: number }
  description: string
}

function getPresets(sys: SystemInfo | null): Preset[] {
  const totalGB = sys?.totalMemory || 8
  const cpuCount = sys?.cpus || 4
  return [
    {
      name: 'Baixo', icon: '🟢', color: '#22c55e',
      minRam: 512, maxRam: Math.min(2048, Math.floor(totalGB * 1024 * 0.25)),
      jvmArgs: '-XX:+UseG1GC -XX:G1HeapRegionSize=16m',
      resolution: { width: 854, height: 480 },
      description: `Para PC fraco (${totalGB}GB RAM, ${cpuCount} cores). 480p, 2GB max.`
    },
    {
      name: 'Médio', icon: '🟡', color: '#eab308',
      minRam: 1024, maxRam: Math.min(4096, Math.floor(totalGB * 1024 * 0.375)),
      jvmArgs: '-XX:+UseG1GC -XX:G1HeapRegionSize=16m -XX:MaxGCPauseMillis=20',
      resolution: { width: 1280, height: 720 },
      description: `Para PC intermediário (${totalGB}GB RAM, ${cpuCount} cores). 720p, 4GB max.`
    },
    {
      name: 'Alto', icon: '🔴', color: '#ef4444',
      minRam: 2048, maxRam: Math.min(8192, Math.floor(totalGB * 1024 * 0.5)),
      jvmArgs: '-XX:+UseG1GC -XX:G1HeapRegionSize=32m -XX:MaxGCPauseMillis=15 -XX:+ParallelRefProcEnabled',
      resolution: { width: 1920, height: 1080 },
      description: `Para PC bom (${totalGB}GB RAM, ${cpuCount} cores). 1080p, 8GB max.`
    },
    {
      name: 'Ultra', icon: '🟣', color: '#a855f7',
      minRam: 4096, maxRam: Math.min(16384, Math.floor(totalGB * 1024 * 0.75)),
      jvmArgs: '-XX:+UseG1GC -XX:G1HeapRegionSize=32m -XX:MaxGCPauseMillis=10 -XX:+ParallelRefProcEnabled -XX:+AlwaysPreTouch',
      resolution: { width: 2560, height: 1440 },
      description: `Para PC gamer (${totalGB}GB RAM, ${cpuCount} cores). 1440p, memória máxima.`
    }
  ]
}

export default function InstancesPage({ instances, installedVersions, onCreate, onUpdate, onDelete, onPlay, onOpenMods }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', versionId: '', minMemory: 512, maxMemory: 2048, javaPath: '', jvmArgs: '', resW: 854, resH: 480, fullscreen: false })
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  const javaVers = Object.values(installedVersions)
  const reset = () => { setForm({ name: '', versionId: '', minMemory: 512, maxMemory: 2048, javaPath: '', jvmArgs: '', resW: 854, resH: 480, fullscreen: false }); setEditId(null); setShowForm(false); setShowPresets(false) }

  const submit = () => {
    if (!form.name.trim() || (!editId && !form.versionId)) return
    const data = { name: form.name.trim(), versionId: form.versionId, minMemory: form.minMemory, maxMemory: form.maxMemory, javaPath: form.javaPath, jvmArgs: form.jvmArgs.split(' ').filter(Boolean), resolution: { width: form.resW, height: form.resH }, fullscreen: form.fullscreen }
    if (editId) onUpdate(editId, data); else onCreate(data)
    reset()
  }

  const startEdit = (inst: Instance) => { setEditId(inst.id); setForm({ name: inst.name, versionId: inst.versionId, minMemory: inst.minMemory, maxMemory: inst.maxMemory, javaPath: inst.javaPath || '', jvmArgs: (inst.jvmArgs || []).join(' '), resW: inst.resolution?.width || 854, resH: inst.resolution?.height || 480, fullscreen: inst.fullscreen }); setShowForm(true); setShowPresets(false) }

  const loadSmartConfig = async () => {
    try {
      const info: SystemInfo = await (window as any).electronAPI?.getSystemInfo()
      setSysInfo(info)
      setShowPresets(true)
    } catch {
      alert('Não foi possível detectar as configurações do sistema.')
    }
  }

  const applyPreset = (preset: Preset) => {
    setForm(f => ({
      ...f,
      minMemory: preset.minRam,
      maxMemory: preset.maxRam,
      jvmArgs: preset.jvmArgs,
      resW: preset.resolution.width,
      resH: preset.resolution.height
    }))
    setShowPresets(false)
  }

  const presets = getPresets(sysInfo)

  return (
    <>
      <div className="page-header"><h1 className="page-title">🎮 Instâncias</h1><p className="page-subtitle">Gerencie instâncias isoladas do Minecraft</p></div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={() => { reset(); setShowForm(true) }}>➕ Criar Instância</button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: '20px', maxWidth: '700px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>{editId ? '✏️ Editar' : '➕ Nova'} Instância</h3>

          {/* Smart Config Button */}
          {!editId && (
            <button
              className="btn"
              onClick={loadSmartConfig}
              style={{
                width: '100%', marginBottom: '16px', padding: '14px 20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                color: '#fff', fontWeight: 700, fontSize: '14px', borderRadius: '12px',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '10px', justifyContent: 'center', transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
              }}
            >
              ⚡ Configuração Inteligente
              <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>— Auto-detectar sistema e aplicar preset ideal</span>
            </button>
          )}

          {/* Preset Selector */}
          {showPresets && !editId && (
            <div style={{
              marginBottom: '16px', padding: '16px',
              background: 'rgba(99, 102, 241, 0.08)', borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🖥️ Sistema detectado: <span style={{ color: 'var(--text-primary)' }}>{sysInfo?.cpus} cores · {sysInfo?.totalMemory}GB RAM · {sysInfo?.platform} {sysInfo?.arch}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                {presets.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '14px 10px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.03)', border: `2px solid ${p.color}33`,
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.background = `${p.color}15`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${p.color}33`; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <span style={{ fontSize: '28px' }}>{p.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: p.color }}>{p.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3' }}>{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ gridColumn: editId ? undefined : '1 / -1' }}><label className="form-label">Nome</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Minha instância..." disabled={!!editId} /></div>
            {!editId && <div className="form-group"><label className="form-label">Versão</label><select className="form-input" value={form.versionId} onChange={e => setForm({ ...form, versionId: e.target.value })}><option value="">Selecione...</option>{javaVers.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}</select></div>}
            <div className="form-group"><label className="form-label">RAM Mínima (MB)</label><input className="form-input" type="number" min={256} max={8192} step={256} value={form.minMemory} onChange={e => setForm({ ...form, minMemory: parseInt(e.target.value) || 512 })} /></div>
            <div className="form-group"><label className="form-label">RAM Máxima (MB)</label><input className="form-input" type="number" min={512} max={32768} step={256} value={form.maxMemory} onChange={e => setForm({ ...form, maxMemory: parseInt(e.target.value) || 2048 })} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Resolução</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input className="form-input" type="number" min={320} max={7680} step={10} value={form.resW} onChange={e => setForm({ ...form, resW: parseInt(e.target.value) || 854 })} style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>×</span>
                <input className="form-input" type="number" min={240} max={4320} step={10} value={form.resH} onChange={e => setForm({ ...form, resH: parseInt(e.target.value) || 480 })} style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {form.resW}×{form.resH}
                </span>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Java (vazio = auto)</label>
              <input className="form-input" value={form.javaPath} onChange={e => setForm({ ...form, javaPath: e.target.value })} placeholder="Auto-detect" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">JVM Args</label>
              <input className="form-input" value={form.jvmArgs} onChange={e => setForm({ ...form, jvmArgs: e.target.value })} placeholder="-XX:+UseG1GC" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={submit} disabled={!form.name.trim() || (!editId && !form.versionId)}>{editId ? '💾 Salvar' : '➕ Criar'}</button>
            <button className="btn btn-secondary" onClick={reset}>Cancelar</button>
          </div>
        </div>
      )}

      {instances.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🎮</div><h3 className="empty-title">Nenhuma instância</h3><button className="btn btn-primary" onClick={() => setShowForm(true)}>➕ Criar</button></div>
      ) : (
        <div className="card-grid">{instances.map(inst => (
          <div key={inst.id} className="version-card">
            <div className="version-card-header"><span className="badge badge-java">🎮 {inst.versionType}</span>{inst.modloader && <span className="badge badge-loader">{inst.modloader.type} {inst.modloader.version}</span>}</div>
            <div className="version-name">{inst.name}</div>
            <div className="version-meta"><span>📦 {inst.versionId}</span><span>💾 {inst.maxMemory}MB</span>{inst.lastPlayed && <span>🕐 {new Date(inst.lastPlayed).toLocaleDateString('pt-BR')}</span>}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>{inst.playTime > 0 ? `⏱️ ${inst.playTime}min jogado` : 'Nunca jogado'}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: '70px' }} onClick={() => onPlay(inst.id)}>▶ Jogar</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onOpenMods(inst.id)} title="Mods">🧩</button>
              <button className="btn btn-secondary btn-sm" onClick={() => startEdit(inst)} title="Editar">✏️</button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI?.openInstanceFolder(inst.id)} title="Pasta">📁</button>
              <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Deletar "${inst.name}"?`)) onDelete(inst.id) }} title="Deletar">🗑️</button>
            </div>
          </div>
        ))}</div>
      )}
    </>
  )
}
