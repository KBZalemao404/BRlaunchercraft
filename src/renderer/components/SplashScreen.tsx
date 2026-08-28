import { useState, useEffect } from 'react'

const SERVER_URL = 'https://minecraft-launcher-updates.vercel.app'

interface Step { label: string; icon: string; status: 'pending' | 'active' | 'done' | 'error' }

export default function SplashScreen({ onReady }: { onReady: () => void }) {
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Inicializando launcher', icon: '⚡', status: 'pending' },
    { label: 'Conectando ao servidor', icon: '🌐', status: 'pending' },
    { label: 'Verificando atualizações', icon: '🔄', status: 'pending' },
    { label: 'Carregando configurações', icon: '⚙️', status: 'pending' },
  ])
  const [particles, setParticles] = useState<Array<{ x: number; y: number; size: number; delay: number; duration: number }>>([])

  useEffect(() => {
    // Generate particles
    const p = Array.from({ length: 30 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 3 + 1, delay: Math.random() * 5,
      duration: Math.random() * 3 + 4
    }))
    setParticles(p)

    const updateStep = (idx: number, status: Step['status']) => {
      setSteps(s => s.map((st, i) => i === idx ? { ...st, status } : st))
    }

    const init = async () => {
      // Step 1: Init
      updateStep(0, 'active')
      await new Promise(r => setTimeout(r, 400))
      updateStep(0, 'done')

      // Step 2: Server check
      updateStep(1, 'active')
      try {
        const res = await fetch(`${SERVER_URL}/api/heartbeat`, { signal: AbortSignal.timeout(4000) })
        if (res.ok) updateStep(1, 'done')
        else { updateStep(1, 'error') }
      } catch { updateStep(1, 'error') }

      // Step 3: Update check
      updateStep(2, 'active')
      try {
        const res = await fetch(`${SERVER_URL}/api/update?current=0.1.18`, { signal: AbortSignal.timeout(4000) })
        if (res.ok) updateStep(2, 'done')
        else updateStep(2, 'done') // Non-critical
      } catch { updateStep(2, 'done') } // Non-critical

      // Step 4: Settings
      updateStep(3, 'active')
      await new Promise(r => setTimeout(r, 300))
      updateStep(3, 'done')

      await new Promise(r => setTimeout(r, 300))
      onReady()
    }

    init()
  }, [onReady])

  const allDone = steps.every(s => s.status === 'done' || s.status === 'error')
  const doneCount = steps.filter(s => s.status === 'done').length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#050508', overflow: 'hidden'
    }}>
      {/* Animated background gradient */}
      <div style={{
        position: 'absolute', inset: '-50%',
        background: 'radial-gradient(ellipse at 30% 50%, rgba(0,232,123,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(0,180,212,0.04) 0%, transparent 50%)',
        animation: 'splashBgRotate 20s linear infinite'
      }} />

      {/* Particles */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: `${p.size}px`, height: `${p.size}px`,
          borderRadius: '50%',
          background: i % 3 === 0 ? 'rgba(0,232,123,0.3)' : i % 3 === 1 ? 'rgba(0,180,212,0.2)' : 'rgba(168,85,247,0.2)',
          animation: `splashFloat ${p.duration}s ease-in-out ${p.delay}s infinite`
        }} />
      ))}

      <style>{`
        @keyframes splashBgRotate { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes splashFloat { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.3 } 50% { transform: translateY(-20px) scale(1.2); opacity: 0.7 } }
        @keyframes splashLogoIn { from { opacity: 0; transform: scale(0.5) rotate(-10deg) } to { opacity: 1; transform: scale(1) rotate(0deg) } }
        @keyframes splashTextIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes splashSpin { to { transform: rotate(360deg) } }
        @keyframes splashPulseGlow { 0%, 100% { box-shadow: 0 0 40px rgba(0,232,123,0.2), 0 0 80px rgba(0,232,123,0.1) } 50% { box-shadow: 0 0 60px rgba(0,232,123,0.35), 0 0 120px rgba(0,232,123,0.15) } }
        @keyframes splashStepIn { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>

      {/* Logo */}
      <div style={{
        width: '88px', height: '88px', borderRadius: '24px',
        background: 'linear-gradient(135deg, #00e87b, #00b8d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '36px', fontWeight: 900, color: '#000',
        animation: 'splashLogoIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards, splashPulseGlow 3s ease-in-out infinite',
        marginBottom: '24px', position: 'relative', zIndex: 1
      }}>
        ⬡
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px',
        background: 'linear-gradient(135deg, #fff, #c0c0d0)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: '4px', position: 'relative', zIndex: 1,
        animation: 'splashTextIn 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) both'
      }}>
        MINECRAFT LAUNCHER
      </h1>
      <p style={{
        fontSize: '11px', color: 'var(--text-muted)', marginBottom: '36px',
        position: 'relative', zIndex: 1,
        animation: 'splashTextIn 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both'
      }}>
        Java Edition · v0.1.18
      </p>

      {/* Loading steps */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '6px',
        minWidth: '280px', position: 'relative', zIndex: 1,
        animation: 'splashTextIn 0.6s 0.5s cubic-bezier(0.16,1,0.3,1) both'
      }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 12px', borderRadius: '8px',
            background: step.status === 'active' ? 'rgba(0,232,123,0.06)' : 'transparent',
            transition: 'all 0.3s ease',
            animation: `splashStepIn 0.3s ${0.6 + i * 0.1}s cubic-bezier(0.16,1,0.3,1) both`
          }}>
            <span style={{ fontSize: '12px', width: '16px', textAlign: 'center' }}>
              {step.status === 'done' ? '✅' : step.status === 'error' ? '⚠️' : step.status === 'active' ? (
                <span style={{ display: 'inline-block', animation: 'splashSpin 0.8s linear infinite', fontSize: '12px' }}>⏳</span>
              ) : <span style={{ opacity: 0.3 }}>{step.icon}</span>}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: step.status === 'active' ? 600 : 400,
              color: step.status === 'done' ? 'var(--accent)' : step.status === 'error' ? 'var(--orange)' : step.status === 'active' ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.3s ease'
            }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{
        width: '280px', height: '3px', background: 'rgba(255,255,255,0.04)',
        borderRadius: '2px', marginTop: '20px', overflow: 'hidden',
        position: 'relative', zIndex: 1,
        animation: 'splashTextIn 0.6s 0.5s cubic-bezier(0.16,1,0.3,1) both'
      }}>
        <div style={{
          height: '100%', borderRadius: '2px',
          background: 'linear-gradient(90deg, var(--accent), var(--cyan))',
          transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
          width: `${(doneCount / steps.length) * 100}%`
        }} />
      </div>
    </div>
  )
}
