import type { UpdateState } from '../../shared/types'

interface Props {
  state: UpdateState
  onCheck: () => void
  onDownload: () => void
  onInstall: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s'
}

export default function UpdatePanel({ state, onCheck, onDownload, onInstall }: Props) {
  const renderStatus = () => {
    switch (state.status) {
      case 'checking':
        return (
          <div className="update-status">
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <span>Verificando atualizações...</span>
          </div>
        )
      case 'available':
        return (
          <div className="update-status update-available">
            <div className="update-badge-new">NOVO</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                v{state.info?.version} disponível!
              </div>
              {state.info?.releaseDate && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Publicado em {new Date(state.info.releaseDate).toLocaleDateString('pt-BR')}
                </div>
              )}
              {state.info?.releaseNotes && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.5' }}>
                  {state.info.releaseNotes}
                </div>
              )}
            </div>
          </div>
        )
      case 'downloading':
        return (
          <div className="update-status">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>Baixando v{state.info?.version}...</span>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                  {state.progress?.percent || 0}%
                </span>
              </div>
              <div className="update-progress-bar">
                <div className="update-progress-fill" style={{ width: `${state.progress?.percent || 0}%` }} />
              </div>
              {state.progress && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>{formatBytes(state.progress.transferred)} / {formatBytes(state.progress.total)}</span>
                  <span>{formatSpeed(state.progress.bytesPerSecond)}</span>
                </div>
              )}
            </div>
          </div>
        )
      case 'downloaded':
        return (
          <div className="update-status update-downloaded">
            <div className="update-badge-ready">PRONTO</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--green)' }}>
                v{state.info?.version} baixada!
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Clique em "Reiniciar e Atualizar" para aplicar.
              </div>
            </div>
          </div>
        )
      case 'not-available':
        return (
          <div className="update-status">
            <span style={{ fontSize: '24px' }}>✅</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Você está na versão mais recente!</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Última verificação: {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        )
      case 'error':
        return (
          <div className="update-status update-error">
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#ff6b6b' }}>Erro ao verificar</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                {state.error}
              </div>
            </div>
          </div>
        )
      default:
        return (
          <div className="update-status">
            <span style={{ fontSize: '24px', opacity: 0.6 }}>🔄</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Clique em verificar para buscar atualizações
            </span>
          </div>
        )
    }
  }

  return (
    <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔄 Atualizar Launcher
            <span style={{
              fontSize: '10px', fontFamily: 'JetBrains Mono', padding: '2px 8px',
              borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontWeight: 500
            }}>
              v{state.currentVersion}
            </span>
          </div>
        </div>
      </div>

      {renderStatus()}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        {state.status === 'idle' || state.status === 'not-available' || state.status === 'error' ? (
          <button className="btn btn-secondary" onClick={onCheck}>
            🔍 Verificar Atualizações
          </button>
        ) : null}

        {state.status === 'available' && (
          <button className="btn btn-launch" onClick={onDownload}>
            ⬇️ Baixar Atualização
          </button>
        )}

        {state.status === 'downloading' && (
          <button className="btn btn-secondary" disabled>
            ⏳ Baixando...
          </button>
        )}

        {state.status === 'downloaded' && (
          <button className="btn btn-launch" onClick={onInstall} style={{ background: 'var(--green)' }}>
            🚀 Reiniciar e Atualizar
          </button>
        )}

        <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI?.openUrl?.('https://github.com/Freebuff/minecraft-launcher/blob/main/CHANGELOG.md')} style={{ marginLeft: 'auto' }}>
          📋 Ver Changelog
        </button>
      </div>
    </div>
  )
}
