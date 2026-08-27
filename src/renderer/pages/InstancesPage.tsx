import { useState } from 'react'
import type { Instance, InstalledVersion } from '../../shared/types'

interface Props { instances: Instance[]; installedVersions: Record<string, InstalledVersion>; onCreate: (d: any) => void; onUpdate: (id: string, u: any) => void; onDelete: (id: string) => void; onPlay: (id: string) => void; onOpenMods: (id: string) => void }

export default function InstancesPage({ instances, installedVersions, onCreate, onUpdate, onDelete, onPlay, onOpenMods }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', versionId: '', minMemory: 512, maxMemory: 2048, javaPath: '', jvmArgs: '', resW: 854, resH: 480, fullscreen: false })

  const javaVers = Object.values(installedVersions)
  const reset = () => { setForm({ name: '', versionId: '', minMemory: 512, maxMemory: 2048, javaPath: '', jvmArgs: '', resW: 854, resH: 480, fullscreen: false }); setEditId(null); setShowForm(false) }

  const submit = () => {
    if (!form.name.trim() || (!editId && !form.versionId)) return
    const data = { name: form.name.trim(), versionId: form.versionId, minMemory: form.minMemory, maxMemory: form.maxMemory, javaPath: form.javaPath, jvmArgs: form.jvmArgs.split(' ').filter(Boolean), resolution: { width: form.resW, height: form.resH }, fullscreen: form.fullscreen }
    if (editId) onUpdate(editId, data); else onCreate(data)
    reset()
  }

  const startEdit = (inst: Instance) => { setEditId(inst.id); setForm({ name: inst.name, versionId: inst.versionId, minMemory: inst.minMemory, maxMemory: inst.maxMemory, javaPath: inst.javaPath || '', jvmArgs: (inst.jvmArgs || []).join(' '), resW: inst.resolution?.width || 854, resH: inst.resolution?.height || 480, fullscreen: inst.fullscreen }); setShowForm(true) }

  return (
    <>
      <div className="page-header"><h1 className="page-title">🎮 Instâncias</h1><p className="page-subtitle">Gerencie instâncias isoladas do Minecraft</p></div>
      <button className="btn btn-primary" onClick={() => { reset(); setShowForm(true) }} style={{ marginBottom: '20px' }}>➕ Criar Instância</button>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: '20px', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>{editId ? '✏️ Editar' : '➕ Nova'} Instância</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ gridColumn: editId ? undefined : '1 / -1' }}><label className="form-label">Nome</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Minha instância..." disabled={!!editId} /></div>
            {!editId && <div className="form-group"><label className="form-label">Versão</label><select className="form-input" value={form.versionId} onChange={e => setForm({ ...form, versionId: e.target.value })}><option value="">Selecione...</option>{javaVers.map(v => <option key={v.id} value={v.id}>{v.id}</option>)}</select></div>}
            <div className="form-group"><label className="form-label">RAM Mínima (MB)</label><input className="form-input" type="number" min={256} max={8192} step={256} value={form.minMemory} onChange={e => setForm({ ...form, minMemory: parseInt(e.target.value) || 512 })} /></div>
            <div className="form-group"><label className="form-label">RAM Máxima (MB)</label><input className="form-input" type="number" min={512} max={32768} step={256} value={form.maxMemory} onChange={e => setForm({ ...form, maxMemory: parseInt(e.target.value) || 2048 })} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Java (vazio = auto)</label><input className="form-input" value={form.javaPath} onChange={e => setForm({ ...form, javaPath: e.target.value })} placeholder="Auto-detect" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">JVM Args</label><input className="form-input" value={form.jvmArgs} onChange={e => setForm({ ...form, jvmArgs: e.target.value })} placeholder="-XX:+UseG1GC" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} /></div>
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
