import type { Page, AuthAccount } from '../../shared/types'

interface Props { currentPage: Page; onNavigate: (p: Page) => void; account: AuthAccount | null; instanceCount: number; installedCount: number; currentVersion?: string; updateAvailable?: boolean }

export default function Sidebar({ currentPage, onNavigate, account, instanceCount, installedCount, currentVersion, updateAvailable }: Props) {
  const items: { page: Page; icon: string; label: string; badge?: number }[] = [
    { page: 'home', icon: '🏠', label: 'Início' },
    { page: 'versions', icon: '📦', label: 'Versões', badge: installedCount || undefined },
    { page: 'instances', icon: '🎮', label: 'Instâncias', badge: instanceCount || undefined },
    { page: 'mods', icon: '🧩', label: 'Mods' },
    { page: 'downloads', icon: '⬇️', label: 'Downloads' },
    { page: 'console', icon: '📋', label: 'Logs' },
    { page: 'settings', icon: '⚙️', label: 'Configurações' },
    { page: 'profile', icon: '👤', label: 'Perfis' },
  ]
  const accountItems: { page: Page; icon: string; label: string }[] = [
    { page: 'login', icon: account ? '👤' : '🔐', label: account ? 'Conta' : 'Login' },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⬡</div>
          <div><div className="sidebar-logo-text">Launcher</div><div className="sidebar-logo-sub">Minecraft</div></div>
        </div>
        {account && (
          <div className="sidebar-account">
            <div className="sidebar-account-avatar" style={account.type === 'offline' ? { background: 'linear-gradient(135deg,var(--orange),var(--rose))' } : undefined}>{account.username[0]?.toUpperCase() || 'P'}</div>
            <div><div className="sidebar-account-name">{account.username}</div><div className="sidebar-account-type">{account.type === 'offline' ? '🎮 Offline' : '🪟 Microsoft'}</div></div>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-label">Principal</div>
        {items.map(i => (
          <button key={i.page} className={`sidebar-item ${currentPage === i.page ? 'active' : ''}`} onClick={() => onNavigate(i.page)} style={{ position: 'relative' }}>
            <span>{i.icon}</span><span>{i.label}</span>
            {i.badge !== undefined && <span className="sidebar-badge">{i.badge}</span>}
          </button>
        ))}
        <div className="sidebar-divider" />
        <div className="sidebar-label">Conta</div>
        {accountItems.map(i => (
          <button key={i.page} className={`sidebar-item ${currentPage === i.page ? 'active' : ''}`} onClick={() => onNavigate(i.page)}>
            <span>{i.icon}</span><span>{i.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">v{currentVersion || '0.1.1'}</div>
    </div>
  )
}
