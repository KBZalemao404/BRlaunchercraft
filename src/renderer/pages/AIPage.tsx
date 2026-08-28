import { useState, useRef, useEffect } from 'react'

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }

interface Props {
  apiKey: string
  onSaveApiKey: (key: string) => void
  systemInfo?: any
  javaVersion?: number
  mcVersion?: string
}

export default function AIPage({ apiKey, onSaveApiKey, systemInfo, javaVersion, mcVersion }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey)
  const [showSettings, setShowSettings] = useState(!apiKey)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Welcome message
  useEffect(() => {
    if (apiKey && messages.length === 0) {
      const sysInfo = systemInfo ? `${systemInfo.platform} ${systemInfo.arch}, ${systemInfo.cpus} CPUs, ${systemInfo.totalMemory}GB RAM` : 'desconhecido'
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Fala! 👋 Eu sou o **Buffy**, seu assistente pessoal do launcher!\n\nTô aqui pra te ajudar com qualquer coisa:\n- 🔧 Diagnosticar erros do jogo\n- ☕ Configurar Java otimizado\n- 🧩 Dicas de mods e performance\n- 💬 Só bater um papo mesmo\n\nSeu sistema: **${sysInfo}**\nJava: **${javaVersion || '?'}**\nMC: **${mcVersion || 'nenhuma versão instalada'}**\n\nMe manda a mensagem! 🚀`,
        timestamp: new Date().toISOString()
      }])
    }
  }, [apiKey])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await window.electronAPI?.aiChat?.(input.trim(), {
        javaVersion,
        mcVersion,
        systemInfo
      })

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res?.error || res?.content || 'Desculpa, não consegui processar sua mensagem.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Erro de conexão. Verifique sua internet e a API key.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = () => {
    if (keyInput.trim()) {
      onSaveApiKey(keyInput.trim())
      setShowSettings(false)
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `API key salva! ✅ Agora posso te ajudar! Me pergunta qualquer coisa sobre o launcher, Minecraft, Java... 🚀`,
        timestamp: new Date().toISOString()
      }])
    }
  }

  if (showSettings || !apiKey) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Buffy — Assistente IA</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Seu companion técnico para Minecraft, Java e configurações
          </p>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 16px', fontSize: '16px' }}>
            ⚙️ Configurar OpenRouter API Key
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Para usar o Buffy, você precisa de uma API key do OpenRouter.
            Obtenha em: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>openrouter.ai/keys</a>
          </p>

          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="sk-or-v1-..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px',
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', fontSize: '14px', marginBottom: '12px',
              fontFamily: 'monospace', boxSizing: 'border-box'
            }}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          />

          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
            💡 Modelos gratuitos disponíveis no OpenRouter:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {[
              { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B' },
              { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B' },
              { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B' },
              { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B' },
            ].map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(0,232,123,0.05)', border: '1px solid rgba(0,232,123,0.1)',
                fontSize: '12px', color: 'var(--text-secondary)'
              }}>
                <span style={{ color: 'var(--accent)' }}>🟢</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--accent)' }}>GRÁTIS</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveKey}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
          >
            🚀 Ativar Buffy
          </button>

          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '12px', textAlign: 'center' }}>
            Sua key fica salva localmente. Nada é enviado para terceiros.
          </p>
        </div>

        <button
          onClick={() => { onSaveApiKey(apiKey); setShowSettings(false) }}
          style={{
            display: 'block', margin: '16px auto 0', background: 'none',
            border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px'
          }}
        >
          Pular por enquanto
        </button>
      </div>
    )
  }

  const quickActions = [
    { label: '🔧 Diagnosticar meu sistema', msg: 'Analise meu sistema e me diga se está tudo OK para rodar Minecraft' },
    { label: '☕ Qual Java preciso?', msg: 'Que Java preciso para a versão mais recente do Minecraft?' },
    { label: '⚡ Otimizar performance', msg: 'Dê dicas para melhorar a performance do Minecraft no meu sistema' },
    { label: '🐛 Por que o jogo crashou?', msg: 'Me ajude a entender por que o Minecraft está crashando' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', boxShadow: '0 0 16px rgba(0,232,123,0.3)'
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>Buffy</div>
          <div style={{ fontSize: '11px', color: 'var(--accent)' }}>Assistente IA • Online</div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            marginLeft: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '12px'
          }}
        >
          ⚙️ API Key
        </button>
        <button
          onClick={() => setMessages([])}
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '12px'
          }}
        >
          🗑️ Limpar
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '16px 24px',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: '8px'
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', marginTop: '2px'
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: '75%', padding: '12px 16px', borderRadius: '16px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, var(--accent), #00c06b)'
                : 'var(--bg-elevated)',
              color: msg.role === 'user' ? '#000' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontSize: '13px', lineHeight: '1.6',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>
              {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                return part
              })}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
            }}>🤖</div>
            <div style={{
              padding: '12px 16px', borderRadius: '16px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: '13px'
            }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Pensando</span>...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions (only show at start) */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 24px 8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { setInput(action.msg) }}
              style={{
                padding: '6px 12px', borderRadius: '99px', fontSize: '12px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 24px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: '8px'
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Pergunte qualquer coisa..."
          disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: '12px',
            border: '1px solid var(--border)', background: 'var(--bg-elevated)',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn btn-primary"
          style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '14px' }}
        >
          {loading ? '⏳' : '🚀'}
        </button>
      </div>
    </div>
  )
}
