import { useState, useEffect } from 'react'
import type { SystemInfo, AppSettings, JavaInstall, UpdateState } from '../../shared/types'
import UpdatePanel from '../components/UpdatePanel'

interface Props { settings: AppSettings | null; systemInfo: SystemInfo | null; onSave: (s: AppSettings) => void; updateState: UpdateState; onCheckUpdate: () => void; onDownloadUpdate: () => void; onInstallUpdate: () => void; onCancelUpdate?: () => void }

export default function SettingsPage({ settings, systemInfo, onSave, updateState, onCheckUpdate, onDownloadUpdate, onInstallUpdate, onCancelUpdate }: Props) {
  const [form, setForm] = useState<AppSettings>({ javaPath: '', autoDetectJava: true, minMemory: 512, maxMemory: 2048, jvmArgs: '', resolution: { width: 854, height: 480 }, fullscreen: false, closeOnGameStart: false, keepLauncherOpen: true, showConsole: true, verifyFiles: true, downloadDir: '', maxConcurrentDownloads: 4, theme: 'dark', language: 'pt-BR', gameDir: '', launcherVersion: '0.1.14', autoStart: false, startMinimized: false, minimizeToTray: false })
  const [javaInstalls, setJavaInstalls] = useState<JavaInstall[]>([])
  const [detecting, setDetecting] = useState(false)

  useEffect(() => { if (settings) setForm(settings); detectJava() }, [settings])

  const detectJava = async () => { setDetecting(true); try { const j = await window.electronAPI?.detectJava(); setJavaInstalls(j || []) } catch {} finally { setDetecting(false) } }
  const selectJava = async () => { const p = await window.electronAPI?.selectFile([{ name: 'Java', extensions: ['exe', ''] }]); if (p) setForm({ ...form, javaPath: p }) }
  const selectGameDir = async () => { const p = await window.electronAPI?.selectDirectory(); if (p) setForm({ ...form, gameDir: p }) }
  const fmtSize = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`

  return (
    <>
      <div className="page-header"><h1 className="page-title">⚙️ Configurações</h1><p className="page-subtitle">Configure o launcher e o Minecraft</p></div>

      <UpdatePanel state={updateState} onCheck={onCheckUpdate} onDownload={onDownloadUpdate} onInstall={onInstallUpdate} onCancel={onCancelUpdate} />

      {systemInfo && (
        <><div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Sistema</span><div className="section-divider-line" /></div>
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: '18px' }}>{systemInfo.platform === 'win32' ? '🪟 Windows' : systemInfo.platform === 'darwin' ? '🍎 macOS' : '🐧 Linux'}</div><div className="stat-label">{systemInfo.arch}</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--cyan)' }}>{systemInfo.cpus}</div><div className="stat-label">CPUs</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--purple)' }}>{systemInfo.totalMemory}GB</div><div className="stat-label">RAM Total</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--accent)' }}>{systemInfo.freeMemory}GB</div><div className="stat-label">RAM Livre</div></div>
        </div></>
      )}

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Java</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div className="form-group"><label className="form-label">Java Executável</label>
          <div style={{ display: 'flex', gap: '8px' }}><input className="form-input" value={form.javaPath} onChange={e => setForm({ ...form, javaPath: e.target.value })} placeholder="Auto-detect" style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: '11px' }} /><button className="btn btn-secondary" onClick={selectJava}>📂</button></div></div>
        <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.autoDetectJava} onChange={e => setForm({ ...form, autoDetectJava: e.target.checked })} /><span>Auto-detectar Java</span></label></div>
        {javaInstalls.length > 0 && (
          <div style={{ marginTop: '10px' }}><label className="form-label">Java detectado ({javaInstalls.length})</label>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>{javaInstalls.map((j, i) => (
              <div key={i} onClick={() => setForm({ ...form, javaPath: j.path })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: `1px solid ${form.javaPath === j.path ? 'rgba(0,232,123,0.3)' : 'var(--border-subtle)'}`, borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', background: form.javaPath === j.path ? 'rgba(0,232,123,0.06)' : 'transparent' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-bright)' }}>Java {j.majorVersion}</span><span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{j.vendor}</span><span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px' }}>{j.architecture}</span></div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.path}</span>
              </div>
            ))}</div>
            <button className="btn btn-secondary btn-sm" onClick={detectJava} disabled={detecting} style={{ marginTop: '6px' }}>{detecting ? '⏳...' : '🔄 Re-detectar'}</button>
          </div>
        )}
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Memória</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group"><label className="form-label">RAM Mínima: {fmtSize(form.minMemory)}</label><input type="range" className="form-range" min={256} max={8192} step={256} value={form.minMemory} onChange={e => setForm({ ...form, minMemory: parseInt(e.target.value) })} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}><span>256 MB</span><span>8 GB</span></div></div>
          <div className="form-group"><label className="form-label">RAM Máxima: {fmtSize(form.maxMemory)}</label><input type="range" className="form-range" min={512} max={32768} step={256} value={form.maxMemory} onChange={e => setForm({ ...form, maxMemory: parseInt(e.target.value) })} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}><span>512 MB</span><span>32 GB</span></div></div>
        </div>
        {systemInfo && form.maxMemory > systemInfo.totalMemory * 1024 * 0.8 && <div className="alert alert-warning" style={{ marginBottom: 0 }}>⚠️ RAM alta pode causar lentidão.</div>}
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">JVM</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div className="form-group"><label className="form-label">Argumentos JVM</label><input className="form-input" value={form.jvmArgs} onChange={e => setForm({ ...form, jvmArgs: e.target.value })} placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions" style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} /></div>
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Tela</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group"><label className="form-label">Largura</label><input className="form-input" type="number" min={320} max={7680} value={form.resolution.width} onChange={e => setForm({ ...form, resolution: { ...form.resolution, width: parseInt(e.target.value) || 854 } })} /></div>
          <div className="form-group"><label className="form-label">Altura</label><input className="form-input" type="number" min={240} max={4320} value={form.resolution.height} onChange={e => setForm({ ...form, resolution: { ...form.resolution, height: parseInt(e.target.value) || 480 } })} /></div>
        </div>
        <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.fullscreen} onChange={e => setForm({ ...form, fullscreen: e.target.checked })} /><span>Tela cheia</span></label></div>
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Launcher</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        {[['closeOnGameStart', 'Fechar launcher ao iniciar o jogo'], ['keepLauncherOpen', 'Manter launcher aberto'], ['showConsole', 'Mostrar console'], ['verifyFiles', 'Verificar arquivos antes de jogar'], ['minimizeToTray', 'Minimizar para a bandeja ao fechar']].map(([k, label]) => (
          <div key={k} className="form-group"><label className="form-checkbox"><input type="checkbox" checked={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /><span>{label}</span></label></div>
        ))}
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,232,123,0.04)', borderRadius: '8px', border: '1px solid rgba(0,232,123,0.1)' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--accent)' }}>🚀 Inicialização</div>
          <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.autoStart} onChange={e => {
            const checked = e.target.checked
            setForm({ ...form, autoStart: checked })
            window.electronAPI?.setAutoStart?.(checked, form.startMinimized)
          }} /><span>Iniciar automaticamente com o Windows</span></label></div>
          <div className="form-group"><label className="form-checkbox"><input type="checkbox" checked={form.startMinimized} onChange={e => {
            const checked = e.target.checked
            setForm({ ...form, startMinimized: checked })
            window.electronAPI?.setAutoStart?.(form.autoStart, checked)
          }} disabled={!form.autoStart} /><span>Iniciar minimizado na bandeja{form.autoStart ? '' : ' (requer auto-start)'}</span></label></div>
        </div>
        <div className="form-group"><label className="form-label">Downloads simultâneos: {form.maxConcurrentDownloads}</label><input type="range" className="form-range" min={1} max={16} value={form.maxConcurrentDownloads} onChange={e => setForm({ ...form, maxConcurrentDownloads: parseInt(e.target.value) })} /></div>
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Interface</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group"><label className="form-label">Tema</label><select className="form-input" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value as 'dark' | 'light' })}><option value="dark">🌙 Escuro</option><option value="light" disabled>☀️ Claro (em breve)</option></select></div>
          <div className="form-group"><label className="form-label">Idioma</label><select className="form-input" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}><option value="pt-BR">🇧🇷 Português</option><option value="en-US">🇺🇸 English</option><option value="es">🇪🇸 Español</option></select></div>
        </div>
      </div>

      <div className="section-divider"><div className="section-divider-line" /><span className="section-divider-text">Diretórios</span><div className="section-divider-line" /></div>
      <div className="glass-card" style={{ maxWidth: '650px', marginBottom: '24px' }}>
        <div className="form-group"><label className="form-label">Diretório do jogo</label><div style={{ display: 'flex', gap: '8px' }}><input className="form-input" value={form.gameDir} readOnly style={{ flex: 1, fontFamily: 'JetBrains Mono', fontSize: '11px' }} /><button className="btn btn-secondary" onClick={selectGameDir}>📂</button></div></div>
      </div>

      <button className="btn btn-launch" onClick={() => onSave(form)} style={{ marginBottom: '40px' }}>💾 Salvar Configurações</button>
    </>
  )
}
