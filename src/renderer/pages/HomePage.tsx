import { useState, useEffect } from 'react'
import type { Page, Instance, InstalledVersion, AuthAccount } from '../../shared/types'

interface Props { account: AuthAccount | null; instances: Instance[]; installedVersions: Record<string, InstalledVersion>; selectedInstanceId: string | null; onSelectInstance: (id: string) => void; onNavigate: (p: Page) => void; onLaunch: (id: string) => void; gameRunning: Record<string, boolean> }

export default function HomePage({ account, instances, installedVersions, selectedInstanceId, onSelectInstance, onNavigate, onLaunch, gameRunning }: Props) {
  const selected = instances.find(i => i.id === selectedInstanceId)
  const isRunning = selectedInstanceId ? gameRunning[selectedInstanceId] : false
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 12) setGreeting('Bom dia')
    else if (h < 18) setGreeting('Boa tarde')
    else setGreeting('Boa noite')
  }, [])

  return (
    <>
      {/* Hero Banner */}
      <div className="hero-banner" style={{ marginBottom: '32px' }}>
        <div className="hero-content">
          <div className="hero-text">
            {!account ? (
              <>
                <h1 style={{ fontSize: '30px' }}>
                  {greeting || 'Bem-vindo'} ao<br />
                  <span style={{
                    background: 'linear-gradient(135deg, #00e87b, #00b8d4, #a855f7)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundSize: '200% 100%', animation: 'heroGradient 4s ease-in-out infinite'
                  }}>
                    Minecraft Launcher
                  </span>
                </h1>
                <p>Faça login com sua conta Microsoft ou jogue offline para começar.</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button className="btn btn-launch" onClick={() => onNavigate('login')}>
                    🔐 Entrar com Microsoft
                  </button>
                  <button className="btn btn-secondary" onClick={() => onNavigate('login')} style={{ fontSize: '13px' }}>
                    🎮 Jogar Offline
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: '30px' }}>
                  {greeting},{' '}
                  <span style={{
                    background: 'linear-gradient(135deg, #00e87b, #00b8d4)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>
                    {account.username}
                  </span>
                </h1>
                <p>Selecione uma instância e comece a jogar!</p>
                {selected && !isRunning && (
                  <button className="btn btn-launch" style={{ marginTop: '20px' }} onClick={() => onLaunch(selected.id)}>
                    ▶ Jogar {selected.name}
                  </button>
                )}
                {isRunning && (
                  <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="spinner" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px' }} />
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '14px' }}>Minecraft em execução!</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <style>{`
          @keyframes heroGradient { 0%, 100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
        `}</style>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('instances')}>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{instances.length}</div>
          <div className="stat-label">Instâncias</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('versions')}>
          <div className="stat-value" style={{ color: 'var(--java)' }}>{Object.keys(installedVersions).length}</div>
          <div className="stat-label">Versões</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: account ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '22px' }}>
            {account ? '✓' : '✗'}
          </div>
          <div className="stat-label">Conta</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--purple)', fontSize: '22px' }}>
            {instances.reduce((sum, i) => sum + (i.playTime || 0), 0) || 0}
          </div>
          <div className="stat-label">Minutos Jogados</div>
        </div>
      </div>

      {/* Instance selector */}
      {instances.length > 0 && (
        <>
          <div className="section-divider">
            <div className="section-divider-line" />
            <span className="section-divider-text">Instâncias</span>
            <div className="section-divider-line" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {instances.slice(0, 6).map(i => (
              <div
                key={i.id}
                className={`instance-selector ${selectedInstanceId === i.id ? 'selected' : ''}`}
                onClick={() => onSelectInstance(i.id)}
                style={{
                  borderLeft: selectedInstanceId === i.id ? '3px solid var(--accent)' : undefined,
                  position: 'relative'
                }}
              >
                <div className="instance-selector-name">{i.name}</div>
                <div className="instance-selector-meta">{i.versionId} • {i.maxMemory}MB</div>
                {gameRunning[i.id] && (
                  <div style={{
                    fontSize: '10px', color: 'var(--accent)', marginTop: '4px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <span style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: 'var(--accent)', display: 'inline-block',
                      animation: 'pulse 1.5s infinite', boxShadow: '0 0 6px rgba(0,232,123,0.5)'
                    }} />
                    Rodando
                  </div>
                )}
              </div>
            ))}
          </div>

          {selected && (
            <div className="glass-card" style={{ maxWidth: '600px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{selected.name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    📦 {selected.versionId} • 💾 {selected.maxMemory}MB RAM
                  </div>
                  {selected.modloader && (
                    <div style={{ fontSize: '12px', color: 'var(--cyan)', marginTop: '4px' }}>
                      🧩 {selected.modloader.type} {selected.modloader.version}
                    </div>
                  )}
                  {selected.playTime > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ⏱️ {selected.playTime} min jogado
                    </div>
                  )}
                </div>
                {!isRunning ? (
                  <button className="btn btn-launch" onClick={() => onLaunch(selected.id)}>
                    ▶ Jogar
                  </button>
                ) : (
                  <button className="btn btn-danger" style={{ fontSize: '13px' }}>
                    🛑 Parar
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div className="section-divider">
        <div className="section-divider-line" />
        <span className="section-divider-text">Ações Rápidas</span>
        <div className="section-divider-line" />
      </div>
      <div className="feature-cards">
        {[
          { icon: '📦', label: 'Versões', desc: 'Baixe e gerencie versões do Minecraft', page: 'versions' as Page, color: 'rgba(231,111,0,0.12)' },
          { icon: '🎮', label: 'Instâncias', desc: 'Crie instâncias isoladas com configs próprias', page: 'instances' as Page, color: 'rgba(0,232,123,0.12)' },
          { icon: '🧩', label: 'Mods', desc: 'Instale Fabric, Forge e mods', page: 'mods' as Page, color: 'rgba(168,85,247,0.12)' },
          { icon: '📋', label: 'Logs', desc: 'Veja logs em tempo real', page: 'console' as Page, color: 'rgba(0,212,255,0.12)' },
        ].map(card => (
          <div key={card.page} className="feature-card" onClick={() => onNavigate(card.page)}>
            <div className="feature-card-icon" style={{ background: card.color }}>
              {card.icon}
            </div>
            <div className="feature-card-title">{card.label}</div>
            <div className="feature-card-desc">{card.desc}</div>
          </div>
        ))}
      </div>
    </>
  )
}
