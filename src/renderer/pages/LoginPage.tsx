import { useState, useEffect } from 'react'

interface Props { onAccountReady: () => void }

type Mode = 'select' | 'microsoft-waiting' | 'offline-form' | 'success' | 'error'

export default function LoginPage({ onAccountReady }: Props) {
  const [mode, setMode] = useState<Mode>('select')
  const [deviceCode, setDeviceCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<any>(null)
  const [offlineUsername, setOfflineUsername] = useState('')
  const [offlineLoading, setOfflineLoading] = useState(false)
  const [offlineError, setOfflineError] = useState('')

  useEffect(() => {
    window.electronAPI?.getAccount?.().then((a: any) => {
      if (a && (a.accessToken || a.type === 'offline')) { setAccount(a); setMode('success') }
    })
    return () => {
      window.electronAPI?.removeAllListeners('auth-progress')
      window.electronAPI?.removeAllListeners('auth-success')
      window.electronAPI?.removeAllListeners('auth-error')
      window.electronAPI?.removeAllListeners('auth-expired')
    }
  }, [])

  // ── Microsoft Login ──
  const startMicrosoftLogin = async () => {
    try {
      setError(''); setMode('microsoft-waiting')
      const r = await window.electronAPI?.startDeviceCode()
      setDeviceCode(r.userCode); setVerificationUri(r.verificationUri); setCountdown(r.expiresInSeconds)
      window.electronAPI.onAuthSuccess((a: any) => { setAccount(a); setMode('success'); onAccountReady() })
      window.electronAPI.onAuthError((m: string) => { setError(m); setMode('error') })
      window.electronAPI.onAuthExpired(() => { setError('Tempo esgotado. Tente novamente.'); setMode('error') })
    } catch (e: any) { setError(e.message); setMode('error') }
  }

  // ── Offline Login ──
  const startOfflineLogin = async () => {
    const name = offlineUsername.trim()
    if (name.length < 3) { setOfflineError('Mínimo 3 caracteres'); return }
    if (name.length > 16) { setOfflineError('Máximo 16 caracteres'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) { setOfflineError('Apenas letras, números e _'); return }

    setOfflineLoading(true); setOfflineError('')
    try {
      const a = await window.electronAPI?.loginOffline(name)
      if (a?.error) { setOfflineError(a.error); setOfflineLoading(false); return }
      setAccount(a); setMode('success')
      onAccountReady()
    } catch (e: any) { setOfflineError(e.message) }
    finally { setOfflineLoading(false) }
  }

  useEffect(() => {
    if (mode !== 'microsoft-waiting' || countdown <= 0) return
    const t = setInterval(() => setCountdown(p => { if (p <= 1) { clearInterval(t); return 0 } return p - 1 }), 1000)
    return () => clearInterval(t)
  }, [mode, countdown])

  const handleLogout = async () => { await window.electronAPI?.logout(); setAccount(null); setMode('select') }
  const copyCode = () => navigator.clipboard?.writeText(deviceCode)
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">⬡</div>
          <h1>Minecraft Launcher</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Escolha como deseja jogar
          </p>
        </div>

        {/* ── Step 1: Mode Selection ── */}
        {mode === 'select' && (
          <>
            {/* Microsoft */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '14px', cursor: 'pointer' }}
              onClick={startMicrosoftLogin}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg,var(--cyan),var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🪟</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '2px' }}>Conta Microsoft</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Jogo original. Login seguro via OAuth. Acesso a skins, servidores premium e atualizações.
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '18px' }}>→</div>
              </div>
            </div>

            {/* Offline */}
            <div className="glass-card" style={{ padding: '24px', cursor: 'pointer' }}
              onClick={() => setMode('offline-form')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg,var(--orange),var(--rose))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🎮</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '2px' }}>Modo Offline</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Jogar sem conta. Basta digitar um nome de usuário. Servidores e skins limitados.
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '18px' }}>→</div>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2a: Microsoft Waiting ── */}
        {mode === 'microsoft-waiting' && (
          <div className="login-device-code-card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '12px' }}>Abra o navegador</h3>
            <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI?.openUrl(verificationUri) }}
              style={{ display: 'block', fontSize: '18px', fontWeight: 700, color: 'var(--cyan)', padding: '14px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '16px', textDecoration: 'none' }}>
              {verificationUri}
            </a>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '8px' }}>Digite o código</h3>
            <div className="login-code-display" onClick={copyCode} title="Clique para copiar">
              <span className="login-code-text">{deviceCode}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📋 Copiar</span>
            </div>
            <div style={{ margin: '12px 0' }}>
              <div className="progress-bar-bg" style={{ height: '3px' }}>
                <div className="progress-bar-fill" style={{ width: `${(countdown / 900) * 100}%`, background: 'linear-gradient(90deg,var(--rose),var(--orange))' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>Expira em {fmt(countdown)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', margin: 0 }} />Aguardando autorização...
            </div>
            <button className="btn btn-secondary" onClick={() => setMode('select')} style={{ marginTop: '8px', width: '100%' }}>← Voltar</button>
          </div>
        )}

        {/* ── Step 2b: Offline Form ── */}
        {mode === 'offline-form' && (
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,var(--orange),var(--rose))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎮</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)' }}>Modo Offline</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Digite seu nome de jogador</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome de Usuário</label>
              <input
                className="form-input"
                value={offlineUsername}
                onChange={(e) => { setOfflineUsername(e.target.value); setOfflineError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') startOfflineLogin() }}
                placeholder="Steve"
                maxLength={16}
                autoFocus
                style={{ fontSize: '16px', fontFamily: 'JetBrains Mono', padding: '14px 16px', letterSpacing: '1px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {offlineUsername.length}/16 caracteres
                </span>
                {offlineUsername.length >= 3 && /^[a-zA-Z0-9_]+$/.test(offlineUsername) && (
                  <span style={{ fontSize: '10px', color: 'var(--accent)' }}>✓ Válido</span>
                )}
              </div>
            </div>

            {offlineError && (
              <div className="alert alert-danger" style={{ marginBottom: '12px' }}>⚠️ {offlineError}</div>
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={startOfflineLogin}
              disabled={offlineLoading || offlineUsername.trim().length < 3}
              style={{ fontSize: '14px', padding: '12px', marginTop: '8px' }}
            >
              {offlineLoading ? '⏳ Entrando...' : '🎮 Entrar Offline'}
            </button>

            <button className="btn btn-secondary" onClick={() => setMode('select')} style={{ marginTop: '8px', width: '100%' }}>← Voltar</button>

            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,138,0,0.05)', border: '1px solid rgba(255,138,0,0.12)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--orange)' }}>⚠️ Modo Offline</strong><br />
              • Sem verificação de conta — jogar em servidores que permitem cracked<br />
              • Sem acesso a skins oficiais (usa Steve/Alex padrão)<br />
              • Sem marketplace ou Realms<br />
              • Funciona 100% para singleplayer e servers offline
            </div>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {mode === 'success' && account && (
          <div className="login-success-card">
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)', marginBottom: '12px' }}>Conectado!</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: account.type === 'offline'
                  ? 'linear-gradient(135deg,var(--orange),var(--rose))'
                  : 'linear-gradient(135deg,var(--accent),var(--cyan))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: 900, color: '#000'
              }}>
                {account.username[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-bright)' }}>{account.username}</div>
                <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                  {account.type === 'offline' ? '🎮 Offline' : '🪟 Microsoft'} · UUID: {account.uuid?.slice(0, 8)}...
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={onAccountReady} style={{ marginTop: '16px' }}>Continuar</button>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: '8px' }}>Sair</button>
          </div>
        )}

        {/* ── Error ── */}
        {mode === 'error' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>❌</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--rose)', marginBottom: '8px' }}>Falha na Autenticação</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => setMode('select')}>Tentar Novamente</button>
          </div>
        )}
      </div>
    </div>
  )
}
