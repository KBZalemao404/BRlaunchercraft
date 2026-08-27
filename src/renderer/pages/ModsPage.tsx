import { useState, useEffect } from 'react'
import type { Instance, ModInfo } from '../../shared/types'

interface Props { instances: Instance[] }

export default function ModsPage({ instances }: Props) {
  const [selected, setSelected] = useState('')
  const [mods, setMods] = useState<ModInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showLoader, setShowLoader] = useState(false)
  const [fabricVer, setFabricVer] = useState('')
  const [forgeVer, setForgeVer] = useState('')
  const [installingLoader, setInstallingLoader] = useState(false)

  useEffect(() => { if (instances.length && !selected) setSelected(instances[0].id) }, [instances])
  useEffect(() => { if (selected) loadMods() }, [selected])

  const loadMods = async () => { if (!selected) return; setLoading(true); try { setMods(await window.electronAPI?.listMods(selected) || []) } catch (e: any) { setMsg({ type: 'error', text: e.message }) } finally { setLoading(false) } }

  const addMods = async () => {
    const fp = await window.electronAPI?.selectFiles([{ name: 'Java Archive', extensions: ['jar'] }])
    if (!fp) return
    try { await window.electronAPI?.installMods({ instanceId: selected, filePaths: fp }); await loadMods(); setMsg({ type: 'success', text: `${fp.length} mod(s) instalado(s)!` }) } catch (e: any) { setMsg({ type: 'error', text: e.message }) }
  }

  const removeMod = async (f: string) => { try { await window.electronAPI?.uninstallMod({ instanceId: selected, modFilename: f }); await loadMods() } catch (e: any) { setMsg({ type: 'error', text: e.message }) } }
  const toggleMod = async (f: string) => { try { await window.electronAPI?.toggleMod({ instanceId: selected, modFilename: f }); await loadMods() } catch (e: any) { setMsg({ type: 'error', text: e.message }) } }

  const installFabricLoader = async () => {
    const inst = instances.find(i => i.id === selected)
    if (!inst || !fabricVer) return
    setInstallingLoader(true)
    try { await window.electronAPI?.installFabric({ instanceId: selected, fabricVersion: fabricVer, minecraftVersion: inst.versionId }); setMsg({ type: 'success', text: `Fabric ${fabricVer} instalado!` }); setShowLoader(false) }
    catch (e: any) { setMsg({ type: 'error', text: e.message }) } finally { setInstallingLoader(false) }
  }

  const installForgeLoader = async () => {
    const inst = instances.find(i => i.id === selected)
    if (!inst || !forgeVer) return
    setInstallingLoader(true)
    try { await window.electronAPI?.installForge({ instanceId: selected, forgeVersion: forgeVer, minecraftVersion: inst.versionId }); setMsg({ type: 'success', text: `Forge ${forgeVer} instalado!` }); setShowLoader(false) }
    catch (e: any) { setMsg({ type: 'error', text: e.message }) } finally { setInstallingLoader(false) }
  }

  const inst = instances.find(i => i.id === selected)

  return (
    <>
      <div className="page-header"><h1 className="page-title">🧩 Mods</h1><p className="page-subtitle">Gerencie mods por instância</p></div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'danger'}`}>{msg.type === 'success' ? '✅' : '⚠️'} {msg.text}<button className="btn btn-sm btn-secondary" onClick={() => setMsg(null)} style={{ marginLeft: 'auto' }}>✕</button></div>}

      {instances.length === 0 ? <div className="empty-state"><div className="empty-icon">🎮</div><h3 className="empty-title">Nenhuma instância</h3></div> : (
        <>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)} style={{ width: '280px' }}>{instances.map(i => <option key={i.id} value={i.id}>{i.name} ({i.versionId})</option>)}</select>
            {inst?.modloader && <span className="badge badge-loader">{inst.modloader.type} {inst.modloader.version}</span>}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={addMods}>📥 Adicionar Mods</button>
            <button className="btn btn-secondary" onClick={() => window.electronAPI?.openModsFolder(selected)}>📂 Abrir Pasta</button>
            <button className="btn btn-secondary" onClick={() => setShowLoader(!showLoader)}>🧩 Modloader</button>
            <button className="btn btn-secondary" onClick={loadMods}>🔄 Atualizar</button>
          </div>

          {showLoader && (
            <div className="glass-card" style={{ marginBottom: '20px', maxWidth: '560px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>🧩 Instalar Modloader</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div><label className="form-label">Fabric</label><input className="form-input" placeholder="Versão (ex: 0.15.11)" value={fabricVer} onChange={e => setFabricVer(e.target.value)} /><button className="btn btn-primary btn-block" style={{ marginTop: '8px' }} onClick={installFabricLoader} disabled={!fabricVer || installingLoader}>{installingLoader ? '⏳...' : '⚙️ Instalar Fabric'}</button></div>
                <div><label className="form-label">Forge</label><input className="form-input" placeholder="Versão (ex: 47.3.0)" value={forgeVer} onChange={e => setForgeVer(e.target.value)} /><button className="btn btn-primary btn-block" style={{ marginTop: '8px' }} onClick={installForgeLoader} disabled={!forgeVer || installingLoader}>{installingLoader ? '⏳...' : '⚙️ Instalar Forge'}</button></div>
              </div>
            </div>
          )}

          {loading ? <div className="loading-container"><div className="spinner" /></div> : mods.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🧩</div><h3 className="empty-title">Nenhum mod</h3><p className="empty-subtitle">Clique em "Adicionar Mods" para instalar .jar</p></div>
          ) : (
            <div>{mods.map(m => (
              <div key={m.id} className={`mod-item ${m.enabled ? '' : 'disabled'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <label className="form-checkbox"><input type="checkbox" checked={m.enabled} onChange={() => toggleMod(m.filename)} /><span className="mod-name">{m.name}</span></label>
                  <span className="mod-version">v{m.version}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{(m.size / 1024).toFixed(0)} KB</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Remover "${m.name}"?`)) removeMod(m.filename) }}>🗑️</button>
              </div>
            ))}</div>
          )}
        </>
      )}
    </>
  )
}
