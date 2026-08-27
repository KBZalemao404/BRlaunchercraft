import type { Page, Instance, InstalledVersion, AuthAccount } from '../../shared/types'

interface Props { account: AuthAccount | null; instances: Instance[]; installedVersions: Record<string, InstalledVersion>; selectedInstanceId: string | null; onSelectInstance: (id: string) => void; onNavigate: (p: Page) => void; onLaunch: (id: string) => void; gameRunning: Record<string, boolean> }

export default function HomePage({ account, instances, installedVersions, selectedInstanceId, onSelectInstance, onNavigate, onLaunch, gameRunning }: Props) {
  const selected = instances.find(i => i.id === selectedInstanceId)
  const isRunning = selectedInstanceId ? gameRunning[selectedInstanceId] : false

  return (
    <>
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-text">
            {!account ? (
              <><h1>Bem-vindo ao<br /><span style={{ background: 'linear-gradient(135deg,#00e87b,#00b8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Minecraft Launcher</span></h1>
              <p>Faça login com sua conta Microsoft para jogar.</p>
              <button className="btn btn-launch" style={{ marginTop: '20px' }} onClick={() => onNavigate('login')}>🔐 Entrar com Microsoft</button></>
            ) : (
              <><h1>Olá, <span style={{ background: 'linear-gradient(135deg,#00e87b,#00b8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{account.username}</span></h1>
              <p>Selecione uma instância e comece a jogar!</p>
              {selected && !isRunning && <button className="btn btn-launch" style={{ marginTop: '20px' }} onClick={() => onLaunch(selected.id)}>▶ Jogar {selected.name}</button>}
              {isRunning && <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><div className="spinner" style={{ width: '18px', height: '18px', margin: 0 }} /><span style={{ color: 'var(--accent)', fontWeight: 600 }}>Minecraft em execução!</span></div>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--accent)' }}>{instances.length}</div><div className="stat-label">Instâncias</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--java)' }}>{Object.keys(installedVersions).length}</div><div className="stat-label">Versões</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: account ? 'var(--cyan)' : 'var(--text-muted)' }}>{account ? '✓' : '✗'}</div><div className="stat-label">Conta</div></div>
      </div>

      {instances.length > 0 && (
        <>
          <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Instâncias</span><div className="section-divider-line" /></div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {instances.slice(0, 6).map(i => (
              <div key={i.id} className={`instance-selector ${selectedInstanceId === i.id ? 'selected' : ''}`} onClick={() => onSelectInstance(i.id)}>
                <div className="instance-selector-name">{i.name}</div>
                <div className="instance-selector-meta">{i.versionId} • {i.maxMemory}MB</div>
                {gameRunning[i.id] && <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '2px' }}>🟢 Rodando</div>}
              </div>
            ))}
          </div>
          {selected && (
            <div className="glass-card" style={{ maxWidth: '560px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{selected.name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selected.versionId} • {selected.maxMemory}MB RAM</div>
                  {selected.modloader && <div style={{ fontSize: '12px', color: 'var(--cyan)', marginTop: '2px' }}>🧩 {selected.modloader.type} {selected.modloader.version}</div>}
                </div>
                {!isRunning ? <button className="btn btn-launch" onClick={() => onLaunch(selected.id)}>▶ Jogar</button> : <button className="btn btn-danger">🛑 Parar</button>}
              </div>
            </div>
          )}
        </>
      )}

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Ações Rápidas</span><div className="section-divider-line" /></div>
      <div className="feature-cards">
        <div className="feature-card" onClick={() => onNavigate('versions')}><div className="feature-card-icon" style={{ background: 'rgba(231,111,0,0.12)' }}>📦</div><div className="feature-card-title">Versões</div><div className="feature-card-desc">Baixe e gerencie versões do Minecraft.</div></div>
        <div className="feature-card" onClick={() => onNavigate('instances')}><div className="feature-card-icon" style={{ background: 'rgba(0,232,123,0.12)' }}>🎮</div><div className="feature-card-title">Instâncias</div><div className="feature-card-desc">Crie instâncias isoladas com configs próprias.</div></div>
        <div className="feature-card" onClick={() => onNavigate('mods')}><div className="feature-card-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>🧩</div><div className="feature-card-title">Mods</div><div className="feature-card-desc">Instale Fabric, Forge e mods.</div></div>
        <div className="feature-card" onClick={() => onNavigate('console')}><div className="feature-card-icon" style={{ background: 'rgba(0,212,255,0.12)' }}>📋</div><div className="feature-card-title">Logs</div><div className="feature-card-desc">Veja logs em tempo real.</div></div>
      </div>
    </>
  )
}
