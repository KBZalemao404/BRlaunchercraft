import { useState, useEffect } from 'react'

interface Profile {
  id: string; username: string; uuid: string; type: 'microsoft' | 'offline'
  skinUrl?: string; skinModel?: 'classic' | 'slim'; capeUrl?: string
  createdAt: string; lastUsedAt: string; playTime: number; gamesPlayed: number
  isFavorite: boolean
}

interface Skin {
  id: string; name: string; url: string; model: 'classic' | 'slim'
  source: 'url' | 'file' | 'library'; addedAt: string; preview?: string
}

interface Props {
  profiles: Profile[]
  activeProfileId: string | null
  onSwitchProfile: (id: string) => void
  onCreateProfile: (d: any) => void
  onDeleteProfile: (id: string) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ProfilePage({ profiles, activeProfileId, onSwitchProfile, onCreateProfile, onDeleteProfile, showToast }: Props) {
  const [skins, setSkins] = useState<Skin[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'offline' | 'microsoft'>('offline')
  const [skinUrl, setSkinUrl] = useState('')
  const [skinName, setSkinName] = useState('')
  const [skinModel, setSkinModel] = useState<'classic' | 'slim'>('classic')
  const [showAddSkin, setShowAddSkin] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<'profiles' | 'skins'>('profiles')

  useEffect(() => { loadSkins() }, [])

  const loadSkins = async () => {
    try { const s = await window.electronAPI?.getSkins?.(); setSkins(s || []) } catch {}
  }

  const handleCreate = async () => {
    if (newName.trim().length < 3) { showToast('Mínimo 3 caracteres', 'error'); return }
    if (newName.trim().length > 16) { showToast('Máximo 16 caracteres', 'error'); return }
    try {
      await window.electronAPI?.createProfile?.({ username: newName.trim(), type: newType })
      setNewName(''); setShowCreate(false); showToast('Perfil criado!', 'success')
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar este perfil?')) return
    try { await window.electronAPI?.deleteProfile?.(id); showToast('Perfil removido', 'success') }
    catch (e: any) { showToast(e.message, 'error') }
  }

  const handleAddSkin = async () => {
    if (!skinUrl.trim() || !skinName.trim()) { showToast('Nome e URL são obrigatórios', 'error'); return }
    try {
      await window.electronAPI?.addSkinFromUrl?.({ name: skinName.trim(), url: skinUrl.trim(), model: skinModel })
      setSkinUrl(''); setSkinName(''); setShowAddSkin(false); loadSkins(); showToast('Skin adicionada!', 'success')
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const handleApplySkin = async (profileId: string, skinId: string) => {
    try { await window.electronAPI?.applySkin?.({ profileId, skinId }); showToast('Skin aplicada!', 'success') }
    catch (e: any) { showToast(e.message, 'error') }
  }

  const handleDeleteSkin = async (id: string) => {
    try { await window.electronAPI?.deleteSkin?.(id); loadSkins(); showToast('Skin removida', 'success') }
    catch (e: any) { showToast(e.message, 'error') }
  }

  const handleAddFileSkin = async () => {
    const filePath = await window.electronAPI?.selectFile?.([{ name: 'PNG Image', extensions: ['png'] }])
    if (!filePath) return
    const name = prompt('Nome para esta skin:') || 'Minha Skin'
    try {
      await window.electronAPI?.addSkinFromFile?.({ name, filePath, model: skinModel })
      loadSkins(); showToast('Skin importada!', 'success')
    } catch (e: any) { showToast(e.message, 'error') }
  }

  const getHeadUrl = (uuid: string) => `https://mc-heads.net/head/128/${uuid.replace(/-/g, '')}`
  const getBodyUrl = (uuid: string) => `https://mc-heads.net/body/128/${uuid.replace(/-/g, '')}`
  const fmtTime = (min: number) => {
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}min`
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">👤 Perfis & Skins</h1>
        <p className="page-subtitle">Gerencie seus perfis e personalize sua aparência</p>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ maxWidth: '500px' }}>
        <button className={`tab ${activeTab === 'profiles' ? 'active' : ''}`} onClick={() => setActiveTab('profiles')}>👤 Perfis ({profiles.length})</button>
        <button className={`tab ${activeTab === 'skins' ? 'active' : ''}`} onClick={() => setActiveTab('skins')}>🎨 Skins ({skins.length})</button>
      </div>

      {/* ═══ PROFILES TAB ═══ */}
      {activeTab === 'profiles' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ Novo Perfil</button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div className="glass-card" style={{ maxWidth: '500px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-bright)' }}>Criar Perfil</h3>
              <div className="form-group">
                <label className="form-label">Nome de Usuário</label>
                <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Steve" maxLength={16}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={`btn ${newType === 'offline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNewType('offline')}>🎮 Offline</button>
                  <button className={`btn ${newType === 'microsoft' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setNewType('microsoft')}>🪟 Microsoft</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleCreate}>Criar</button>
                <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setNewName('') }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Profile Cards */}
          <div className="card-grid">
            {profiles.map(p => (
              <div key={p.id} className={`glass-card ${p.id === activeProfileId ? 'profile-active' : ''}`}
                style={{ cursor: 'pointer', border: p.id === activeProfileId ? '1px solid rgba(0,232,123,0.3)' : undefined }}
                onClick={() => setSelectedProfile(p)}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {/* Avatar */}
                  <div style={{ position: 'relative' }}>
                    <img src={getHeadUrl(p.uuid)} alt={p.username}
                      style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '2px solid var(--border-subtle)' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%23234' width='64' height='64' rx='14'/><text x='32' y='40' text-anchor='middle' fill='%23888' font-size='24' font-weight='bold'>${p.username[0]?.toUpperCase()}</text></svg>` }} />
                    {p.id === activeProfileId && (
                      <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#000', fontWeight: 900, border: '2px solid var(--bg-void)' }}>✓</div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)' }}>{p.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                      {p.type === 'offline' ? '🎮 Offline' : '🪟 Microsoft'} · {p.uuid.slice(0, 8)}...
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      ⏱ {fmtTime(p.playTime)} · 🎮 {p.gamesPlayed} partidas
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                  {p.id !== activeProfileId && (
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onSwitchProfile(p.id) }}>
                      Usar
                    </button>
                  )}
                  {p.id === activeProfileId && (
                    <span className="badge badge-installed" style={{ fontSize: '10px' }}>✓ Ativo</span>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedProfile(p); setActiveTab('skins') }}>
                    🎨 Skin
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {profiles.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-icon">👤</div>
                <div className="empty-title">Nenhum perfil</div>
                <div className="empty-subtitle">Crie um perfil para começar a jogar</div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ Criar Perfil</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ SKINS TAB ═══ */}
      {activeTab === 'skins' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button className="btn btn-primary" onClick={() => setShowAddSkin(true)}>🔗 Adicionar por URL</button>
            <button className="btn btn-secondary" onClick={handleAddFileSkin}>📁 Importar Arquivo</button>
          </div>

          {/* Add Skin Form */}
          {showAddSkin && (
            <div className="glass-card" style={{ maxWidth: '500px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-bright)' }}>Adicionar Skin</h3>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" value={skinName} onChange={e => setSkinName(e.target.value)} placeholder="Minha Skin" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">URL da Skin (PNG)</label>
                <input className="form-input" value={skinUrl} onChange={e => setSkinUrl(e.target.value)} placeholder="https:// skins.net/skin.png" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={`btn btn-sm ${skinModel === 'classic' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSkinModel('classic')}>🧍 Classic (Steve)</button>
                  <button className={`btn btn-sm ${skinModel === 'slim' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSkinModel('slim')}>🧍‍♀️ Slim (Alex)</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleAddSkin}>Adicionar</button>
                <button className="btn btn-secondary" onClick={() => { setShowAddSkin(false); setSkinUrl(''); setSkinName('') }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Skin Grid */}
          <div className="card-grid">
            {skins.map(s => (
              <div key={s.id} className="glass-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {/* Preview */}
                  <div style={{ width: '64px', height: '128px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                    {s.preview ? (
                      <img src={s.preview} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '24px' }}>🎨</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-bright)' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {s.model === 'classic' ? '🧍 Classic' : '🧍‍♀️ Slim'} · {s.source}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>
                      {new Date(s.addedAt).toLocaleDateString('pt-BR')}
                    </div>
                    {/* Apply to profiles */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {profiles.filter(p => p.id === activeProfileId || p.type === 'offline').slice(0, 3).map(p => (
                        <button key={p.id} className="btn btn-xs btn-secondary"
                          onClick={() => handleApplySkin(p.id, s.id)}>
                          → {p.username}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSkin(s.id)} title="Remover">🗑️</button>
                </div>
              </div>
            ))}

            {skins.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-icon">🎨</div>
                <div className="empty-title">Nenhuma skin</div>
                <div className="empty-subtitle">Adicione skins por URL ou importe um arquivo PNG</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Profile Detail Modal ═══ */}
      {selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelectedProfile(null)}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '28px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
              <img src={getHeadUrl(selectedProfile.uuid)} alt="" style={{ width: '80px', height: '80px', borderRadius: '18px', background: 'rgba(255,255,255,0.04)' }}
                onError={(e) => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect fill='%23234' width='80' height='80' rx='18'/><text x='40' y='50' text-anchor='middle' fill='%23888' font-size='30' font-weight='bold'>${selectedProfile.username[0]?.toUpperCase()}</text></svg>` }} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-bright)' }}>{selectedProfile.username}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                  UUID: {selectedProfile.uuid}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedProfile.type === 'offline' ? '🎮 Modo Offline' : '🪟 Conta Microsoft'}
                </div>
              </div>
            </div>
            {/* Full body preview */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img src={getBodyUrl(selectedProfile.uuid)} alt="Body" style={{ height: '160px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>{fmtTime(selectedProfile.playTime)}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tempo Total</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cyan)' }}>{selectedProfile.gamesPlayed}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Partidas</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--purple)' }}>{new Date(selectedProfile.createdAt).toLocaleDateString('pt-BR')}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Criado</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setSelectedProfile(null)} style={{ width: '100%' }}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
