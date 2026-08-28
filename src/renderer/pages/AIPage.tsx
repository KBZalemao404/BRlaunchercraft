import { useState, useRef, useEffect, useMemo } from 'react'

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp?: string; model?: string; latencyMs?: number; tokens?: number; cost?: number }
interface Conversation { id: string; title: string; model: string; createdAt: string; updatedAt: string; messageCount?: number }
interface ModelInfo { id: string; name: string; provider: string; free: boolean; maxTokens: number; contextLength: number; description: string; category: string; pricing: { prompt: number; completion: number } }
interface UsageStats { totalTokens: number; totalCost: number; messagesCount: number; modelUsage: Record<string, { tokens: number; cost: number; count: number }> }

interface Props {
  systemInfo?: any
  javaVersion?: number
  mcVersion?: string
  onDiagnose?: (logs: string[]) => Promise<string>
  onSuggestJvm?: (sys: any, ver: string) => Promise<string>
}

export default function AIPage({ systemInfo, javaVersion, mcVersion, onDiagnose, onSuggestJvm }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [view, setView] = useState<'chat' | 'settings' | 'conversations' | 'usage'>('chat')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('google/gemma-2-9b-it:free')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1500)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats>({ totalTokens: 0, totalCost: 0, messagesCount: 0, modelUsage: {} })
  const [lastResponseInfo, setLastResponseInfo] = useState<{ model?: string; latencyMs?: number; tokens?: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [settings, modelsList, stats, convs] = await Promise.all([
        window.electronAPI?.aiGetSettings?.(),
        window.electronAPI?.aiGetModels?.(),
        window.electronAPI?.aiGetUsage?.(),
        window.electronAPI?.aiGetConversations?.(),
      ])
      if (settings) {
        setApiKey(settings.apiKey || '')
        setModel(settings.model || 'google/gemma-2-9b-it:free')
        setTemperature(settings.temperature ?? 0.7)
        setMaxTokens(settings.maxTokens ?? 1500)
        setSystemPrompt(settings.systemPrompt || '')
      }
      if (modelsList) setModels(modelsList)
      if (stats) setUsageStats(stats)
      if (convs) setConversations(convs)
    } catch {}
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await window.electronAPI?.aiChat?.(input.trim(), {
        javaVersion, mcVersion, systemInfo,
      })

      if (res?.error) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `❌ ${res.error}`, timestamp: new Date().toISOString() }])
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: 'assistant', content: res?.content || '',
          timestamp: new Date().toISOString(), model: res?.model, latencyMs: res?.latencyMs,
          tokens: res?.usage?.totalTokens, cost: res?.cost
        }])
        setLastResponseInfo({ model: res?.model, latencyMs: res?.latencyMs, tokens: res?.usage?.totalTokens })
      }

      // Refresh conversations list
      const convs = await window.electronAPI?.aiGetConversations?.()
      if (convs) setConversations(convs)
      const stats = await window.electronAPI?.aiGetUsage?.()
      if (stats) setUsageStats(stats)
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: '❌ Erro de conexão.', timestamp: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    await window.electronAPI?.aiUpdateSettings?.({ apiKey, model, temperature, maxTokens, systemPrompt })
    setView('chat')
  }

  const handleNewChat = async () => {
    await window.electronAPI?.aiNewConversation?.()
    setMessages([])
    setView('chat')
  }

  const handleSelectChat = async (id: string) => {
    const msgs = await window.electronAPI?.aiSelectConversation?.(id)
    setCurrentConvId(id)
    if (msgs) setMessages(msgs.map((m: any, i: number) => ({ ...m, id: String(i) })))
    setView('chat')
  }

  const handleDeleteChat = async (id: string) => {
    await window.electronAPI?.aiDeleteConversation?.(id)
    const convs = await window.electronAPI?.aiGetConversations?.()
    if (convs) setConversations(convs)
  }

  const quickActions = [
    { icon: '🔧', label: 'Diagnosticar', msg: 'Analise meu sistema e me diga se está tudo OK para Minecraft' },
    { icon: '☕', label: 'Java', msg: 'Que Java preciso para a versão mais recente do Minecraft?' },
    { icon: '⚡', label: 'Performance', msg: 'Dê dicas para melhorar a performance do Minecraft' },
    { icon: '🐛', label: 'Crash', msg: 'O Minecraft está crashando, me ajude a diagnosticar' },
    { icon: '🧩', label: 'Mods', msg: 'Quais mods você recomenda para melhorar a experiência?' },
    { icon: '🎮', label: 'Bater papo', msg: 'Fala Buffy! Conta uma curiosidade sobre Minecraft' },
  ]

  const freeModels = models.filter(m => m.free)
  const paidModels = models.filter(m => !m.free)
  const selectedModel = models.find(m => m.id === model)

  // ═══════ SETTINGS VIEW ═══════
  if (view === 'settings') {
    return (
      <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setView('chat')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>←</button>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>⚙️ Configurações do Buffy</h2>
        </div>

        {/* API Key */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '14px' }}>🔑 OpenRouter API Key</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>
            Obtenha em: <a href="https://openrouter.ai/keys" target="_blank" style={{ color: 'var(--accent)' }}>openrouter.ai/keys</a>
          </p>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
        </div>

        {/* Model Selector */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '14px' }}>🧠 Modelo</h3>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '6px', textTransform: 'uppercase' }}>🟢 Modelos Gratuitos</div>
            {freeModels.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer', border: model === m.id ? '1px solid var(--accent)' : '1px solid transparent', background: model === m.id ? 'rgba(0,232,123,0.08)' : 'transparent', transition: 'all 0.2s' }}>
                <input type="radio" name="model" checked={model === m.id} onChange={() => setModel(m.id)} style={{ accentColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.provider} • {m.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--orange)', marginBottom: '6px', textTransform: 'uppercase' }}>💰 Modelos Pagos</div>
            {paidModels.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer', border: model === m.id ? '1px solid var(--accent)' : '1px solid transparent', background: model === m.id ? 'rgba(0,232,123,0.08)' : 'transparent', transition: 'all 0.2s' }}>
                <input type="radio" name="model" checked={model === m.id} onChange={() => setModel(m.id)} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.provider} • {m.description}</div>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                  ${m.pricing.prompt}/1M<br />${m.pricing.completion}/1M
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '14px' }}>🎛️ Parâmetros</h3>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Temperature</span>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{temperature.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span>Preciso</span><span>Criativo</span><span>Aleatório</span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Max Tokens</span>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{maxTokens}</span>
            </div>
            <input type="range" min="256" max="8192" step="256" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        </div>

        {/* System Prompt */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '14px' }}>📝 System Prompt</h3>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            style={{ width: '100%', minHeight: '120px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
          <button onClick={() => setSystemPrompt(DEFAULT_PROMPT)} style={{ marginTop: '8px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
            Resetar para padrão
          </button>
        </div>

        <button onClick={handleSaveSettings} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px' }}>
          💾 Salvar Configurações
        </button>
      </div>
    )
  }

  // ═══════ USAGE VIEW ═══════
  if (view === 'usage') {
    return (
      <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setView('chat')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>←</button>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px' }}>📊 Uso</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Mensagens', value: usageStats.messagesCount, icon: '💬' },
            { label: 'Tokens', value: usageStats.totalTokens.toLocaleString(), icon: '🔤' },
            { label: 'Custo', value: `$${usageStats.totalCost.toFixed(4)}`, icon: '💰' },
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>{stat.icon}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {Object.keys(usageStats.modelUsage).length > 0 && (
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-primary)' }}>Por Modelo</h3>
            {Object.entries(usageStats.modelUsage).map(([modelId, stats]) => (
              <div key={modelId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-primary)' }}>{modelId.split('/').pop()}</span>
                <span style={{ color: 'var(--text-muted)' }}>{stats.count} msgs • {stats.tokens.toLocaleString()} tokens • ${stats.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={async () => { await window.electronAPI?.aiResetUsage?.(); setUsageStats({ totalTokens: 0, totalCost: 0, messagesCount: 0, modelUsage: {} }) }}
          style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--rose)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          🗑️ Resetar Estatísticas
        </button>
      </div>
    )
  }

  // ═══════ CONVERSATIONS VIEW ═══════
  if (view === 'conversations') {
    return (
      <div style={{ padding: '24px', maxWidth: '500px', margin: '0 auto', overflow: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setView('chat')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>←</button>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', flex: 1 }}>💬 Conversas</h2>
          <button onClick={handleNewChat} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}>+ Nova</button>
        </div>

        {conversations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p>Nenhuma conversa ainda</p>
          </div>
        )}

        {conversations.map(conv => (
          <div key={conv.id} className="glass-card" style={{ padding: '14px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s', border: currentConvId === conv.id ? '1px solid var(--accent)' : undefined }}
            onClick={() => handleSelectChat(conv.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{conv.title}</div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(conv.id) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {conv.model?.split('/').pop()} • {new Date(conv.updatedAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ═══════ CHAT VIEW ═══════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 0 12px rgba(0,232,123,0.3)' }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>Buffy</div>
          <div style={{ fontSize: '10px', color: 'var(--accent)' }}>
            {selectedModel ? `${selectedModel.name} • ${selectedModel.provider}` : model}
            {selectedModel?.free && ' • 🆓 Grátis'}
          </div>
        </div>

        <button onClick={handleNewChat} title="Nova conversa" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>➕</button>
        <button onClick={() => setView('conversations')} title="Conversas" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>💬</button>
        <button onClick={() => setView('usage')} title="Uso" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>📊</button>
        <button onClick={() => setView('settings')} title="Configurações" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>⚙️</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '18px' }}>Fala! Eu sou o Buffy</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px' }}>
              Seu assistente técnico para Minecraft, Java e configurações. Me pergunta qualquer coisa!
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
              {quickActions.map((a, i) => (
                <button key={i} onClick={() => setInput(a.msg)}
                  style={{ padding: '8px 14px', borderRadius: '99px', fontSize: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>🤖</div>
            )}
            <div style={{ maxWidth: '78%' }}>
              <div style={{
                padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent), #00c06b)' : 'var(--bg-elevated)',
                color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
                border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
              }}>
                {msg.content.split(/(\*\*.*?\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p)}
              </div>
              {msg.role === 'assistant' && msg.latencyMs && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                  {msg.model && <span>{msg.model.split('/').pop()}</span>}
                  <span>{msg.latencyMs}ms</span>
                  {msg.tokens && <span>{msg.tokens} tokens</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🤖</div>
            <div style={{ padding: '12px 16px', borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Pensando</span>...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Pergunte qualquer coisa..." disabled={loading}
            rows={1}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', minHeight: '40px', maxHeight: '120px', fontFamily: 'inherit' }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="btn btn-primary"
            style={{ width: '40px', height: '40px', borderRadius: '12px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {loading ? '⏳' : '🚀'}
          </button>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_PROMPT = `Você é o Buffy, o assistente pessoal do usuário dentro do Minecraft Launcher (Freebuff Desktop).

## Quem você é:
- Seu nome é Buffy 🤖
- Você é um amigo, companheiro e confidente técnico
- Fala de forma natural, informal e amigável (em PT-BR)
- Você é MUITO técnico quando precisa — sabe tudo sobre Java, Minecraft, mods, performance, networking
- Você tem memória da conversa e lembra do contexto do usuário

## O que você sabe:
- Este é um launcher de Minecraft feito com Electron + React + TypeScript
- Suporta MC Java Edition (todas as versões, de 1.0 a 26.2+)
- Tem sistema de auto-update via Vercel server
- Suporta login Microsoft e Offline
- Gerencia Java automaticamente (download, detecção, compatibilidade)
- Suporta mods, Fabric, Forge
- Tem sistema de perfis com skins
- Servidor de atualização: minecraft-launcher-updates.vercel.app
- Repositório: github.com/KBZalemao404/BRlaunchercraft

## Suas habilidades:
- Diagnosticar e resolver erros de Java, crashes, incompatibilidades
- Explicar o que está acontecendo nos logs do Minecraft
- Ajudar com performance (RAM, JVM args, GC)
- Explicar mods, Fabric, Forge, shaders
- Dar dicas de configuração do sistema
- Ser um amigo que conversa sobre jogos e tecnologia

## Regras:
- Nunca invente soluções — se não souber, diga
- Seja honesto sobre limitações
- Use emojis com moderação
- Respostas concisas mas completas
- Quando diagnosticar um erro, explique a CAUSA e a SOLUÇÃO`
