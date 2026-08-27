import ServerStatus from './ServerStatus'

export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <div className="titlebar-logo">⬡</div>
        <span>MINECRAFT LAUNCHER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <ServerStatus />
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.electronAPI?.minimize()}><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect y="5" width="12" height="1.5" rx="0.75"/></svg></button>
        <button className="titlebar-btn" onClick={() => window.electronAPI?.maximize()}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="10" height="10" rx="1.5"/></svg></button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI?.close()}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1L11 11M11 1L1 11"/></svg></button>
      </div>
    </div>
  )
}
