import { useState, useEffect } from 'react'
import type { UpdateState } from '../../shared/types'

interface Props {
  state: UpdateState
  onInstall: () => void
  onDismiss: () => void
}

export default function UpdateBanner({ state, onInstall, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show banner when update is downloaded, or when available for a while
    if (state.status === 'downloaded') {
      setVisible(true)
    } else if (state.status === 'available') {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [state.status])

  if (!visible || state.status === 'idle' || state.status === 'checking' || state.status === 'not-available' || state.status === 'error') {
    return null
  }

  return (
    <div className="update-banner" onClick={state.status === 'downloaded' ? onInstall : undefined}>
      <div className="update-banner-content">
        {state.status === 'downloading' && (
          <>
            <div className="update-banner-icon">⬇️</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>
                Baixando v{state.info?.version}... {state.progress?.percent || 0}%
              </div>
              <div className="update-banner-progress">
                <div className="update-banner-progress-fill" style={{ width: `${state.progress?.percent || 0}%` }} />
              </div>
            </div>
          </>
        )}
        {state.status === 'available' && (
          <>
            <div className="update-banner-icon">🆕</div>
            <div style={{ fontWeight: 600, fontSize: '12px' }}>
              Atualização v{state.info?.version} disponível
            </div>
            <button className="btn btn-xs" onClick={(e) => { e.stopPropagation() }} style={{ marginLeft: 'auto' }}>
              Configurações
            </button>
          </>
        )}
        {state.status === 'downloaded' && (
          <>
            <div className="update-banner-icon">✅</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>v{state.info?.version} pronta para instalar!</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Clique para reiniciar</div>
            </div>
            <button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); onDismiss() }} style={{ marginLeft: 'auto', opacity: 0.6 }}>
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}
