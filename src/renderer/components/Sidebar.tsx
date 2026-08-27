import { useState, useEffect } from 'react'
import type { Page, AuthAccount } from '../../shared/types'

interface Props { currentPage: Page; onNavigate: (p: Page) => void; account: AuthAccount | null; instanceCount: number; installedCount: number; currentVersion?: string; updateAvailable?: boolean }

export default function Sidebar({ currentPage, onNavigate, account, instanceCount, installedCount, currentVersion, updateAvailable }: Props) {
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('https://minecraft-launcher-updates.vercel.app/api/heartbeat', { signal: AbortSignal.timeout(5000) })
        setServerOnline(res.ok)
      } catch { setServerOnline(false) }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  const items: { page: Page; icon: string; label: string; badge?: number | string; color?: string }[] = [
    { page: 'home', icon: '🏠', label: 'Início' },
    { page: 'versions', icon: '📦', label: 'Versões', badge: installedCount || undefined, color: 'var(--java)' },
    { page: 'instances', icon: '🎮', label: 'Instâncias', badge: instanceCount || undefined, color: 'var(--accent)' },
    { page: 'mods', icon: '🧩', label: 'Mods', color: 'var(--purple)' },
    { page: 'downloads', icon: '⬇️', label: 'Downloads', color: 'var(--cyan)' },
    { page: 'console', icon: '📋', label: 'Logs', color: 'var(--orange)' },
    { page: 'settings', icon: '⚙️', label: 'Configurações', color: 'var(--text-secondary)' },
    { page: 'profile', icon: '👤', label: 'Perfis', color: 'var(--rose)' },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{
            boxShadow: '0 0 20px rgba(0,232,123,0.25), 0 0 40px rgba(0,232,123,0.1)'
          }}>⬡</div>
          <div>
            <div className="sidebar-logo-text">Launcher</div>
            <div className="sidebar-logo-sub">Minecraft</div>
          </div>
        </div>

        {/* Server status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px',
          padding: '6px 10px', borderRadius: '8px',
          background: serverOnline === true ? 'rgba(0,232,123,0.06)' : serverOnline === false ? 'rgba(255,51,102,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${serverOnline === true ? 'rgba(0,232,123,0.12)' : serverOnline === false ? 'rgba(255,51,102,0.12)' : 'var(--border-subtle)'}`,
          transition: 'all 0.3s'
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: serverOnline === true ? 'var(--accent)' : serverOnline === false ? 'var(--rose)' : 'var(--text-muted)',
            boxShadow: serverOnline === true ? '0 0 8px rgba(0,232,123,0.5)' : 'none',
            animation: serverOnline === true ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{
            fontSize: '10px', fontWeight: 600,
            color: serverOnline === true ? 'var(--accent)' : serverOnline === false ? 'var(--rose)' : 'var(--text-muted)'
          }}>
            {serverOnline === true ? 'Online' : serverOnline === false ? 'Offline' : 'Verificando...'}
          </span>
          {updateAvailable && (
            <span style={{
              marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
              background: 'linear-gradient(135deg, var(--accent), #00c06b)',
              color: '#000', padding: '2px 6px', borderRadius: '99px'
            }}>
              UPDATE
            </span>
          )}
        </div>

        {account && (
          <div className="sidebar-account">
            <div className="sidebar-account-avatar" style={{
              background: account.type === 'offline'
                ? 'linear-gradient(135deg, var(--orange), var(--rose))'
                : 'linear-gradient(135deg, var(--accent), var(--cyan))',
              boxShadow: account.type === 'offline'
                ? '0 0 12px rgba(255,138,0,0.3)'
                : '0 0 12px rgba(0,232,123,0.3)'
            }}>
              {account.username[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <div className="sidebar-account-name">{account.username}</div>
              <div className="sidebar-account-type">
                {account.type === 'offline' ? '🎮 Offline' : '🪟 Microsoft'}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-label">Principal</div>
        {items.map(i => (
          <button
            key={i.page}
            className={`sidebar-item ${currentPage === i.page ? 'active' : ''}`}
            onClick={() => onNavigate(i.page)}
            style={{ position: 'relative' }}
          >
            <span style={{ fontSize: '15px' }}>{i.icon}</span>
            <span>{i.label}</span>
            {i.badge !== undefined && (
              <span className="sidebar-badge" style={i.color ? { background: `${i.color}15`, color: i.color } : undefined}>
                {i.badge}
              </span>
            )}
          </button>
        ))}
        <div className="sidebar-divider" />
        <div className="sidebar-label">Conta</div>
        <button
          className={`sidebar-item ${currentPage === 'login' ? 'active' : ''}`}
          onClick={() => onNavigate('login')}
        >
          <span style={{ fontSize: '15px' }}>{account ? '👤' : '🔐'}</span>
          <span>{account ? 'Conta' : 'Login'}</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span>v{currentVersion || '0.1.13'}</span>
          {updateAvailable && (
            <span style={{
              fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '99px',
              background: 'linear-gradient(135deg, var(--accent), #00c06b)', color: '#000'
            }}>
              NEW
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
