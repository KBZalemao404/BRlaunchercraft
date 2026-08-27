import { useState, useEffect } from 'react'

const SERVER_URL = 'https://minecraft-launcher-updates.vercel.app'

export default function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [clients, setClients] = useState(0)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/heartbeat`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json()
          setStatus('online')
          setClients(data.activeClients || 0)
        } else {
          setStatus('offline')
        }
      } catch {
        setStatus('offline')
      }
    }

    check()
    const interval = setInterval(check, 30_000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
      background: status === 'online' ? 'rgba(0,232,123,0.08)' : status === 'offline' ? 'rgba(255,51,102,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${status === 'online' ? 'rgba(0,232,123,0.15)' : status === 'offline' ? 'rgba(255,51,102,0.15)' : 'rgba(255,255,255,0.06)'}`,
      color: status === 'online' ? 'var(--accent)' : status === 'offline' ? 'var(--rose)' : 'var(--text-muted)',
      cursor: 'default', userSelect: 'none'
    }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: status === 'online' ? 'var(--accent)' : status === 'offline' ? 'var(--rose)' : 'var(--text-muted)',
        animation: status === 'checking' ? 'pulse 1.5s infinite' : undefined
      }} />
      {status === 'online' && <span>Online{clients > 0 ? ` · ${clients}` : ''}</span>}
      {status === 'offline' && <span>Offline</span>}
      {status === 'checking' && <span>...</span>}
    </div>
  )
}
