import { useState, useEffect } from 'react'

const SERVER_URL = 'https://minecraft-launcher-updates.vercel.app'

export default function SplashScreen({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState('Iniciando...')
  const [dots, setDots] = useState('')

  useEffect(() => {
    // Animate dots
    const dotInterval = setInterval(() => {
      setDots(p => p.length >= 3 ? '' : p + '.')
    }, 400)

    const init = async () => {
      // Check server
      setStatus('Conectando ao servidor...')
      try {
        const res = await fetch(`${SERVER_URL}/api/heartbeat`, { method: 'GET', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          setStatus('Servidor online ✓')
        } else {
          setStatus('Servidor indisponível — modo offline')
        }
      } catch {
        setStatus('Sem conexão — modo offline')
      }

      // Brief pause then ready
      await new Promise(r => setTimeout(r, 800))
      onReady()
    }

    init()
    return () => clearInterval(dotInterval)
  }, [onReady])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-void)',
      animation: 'splashFadeIn 0.5s ease'
    }}>
      <style>{`
        @keyframes splashFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes splashPulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.7; transform: scale(1.05) } }
        @keyframes splashSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Logo */}
      <div style={{
        width: '80px', height: '80px', borderRadius: '22px',
        background: 'linear-gradient(135deg, #00e87b, #00b8d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '32px', fontWeight: 900, color: '#000',
        boxShadow: '0 0 60px rgba(0,232,123,0.3)',
        animation: 'splashPulse 2s ease-in-out infinite',
        marginBottom: '24px'
      }}>
        ⬡
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px',
        background: 'linear-gradient(135deg, #fff, #c0c0d0)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: '4px'
      }}>
        MINECRAFT LAUNCHER
      </h1>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '32px' }}>
        Java Edition · v0.1.8
      </p>

      {/* Spinner */}
      <div style={{
        width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.06)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'splashSpin 0.8s linear infinite',
        marginBottom: '16px'
      }} />

      {/* Status */}
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {status}{status.includes('...') ? '' : dots}
      </p>
    </div>
  )
}
