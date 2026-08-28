import { EventEmitter } from 'events'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

// ═══════════════════════════════════════════════════════════
// OPENROUTER AI SERVICE — Complete Professional Integration
// ═══════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface ChatResponse {
  content: string
  error?: string
  model?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  cost?: number
  latencyMs?: number
  finishReason?: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  free: boolean
  maxTokens: number
  contextLength: number
  description: string
  category: 'free' | 'fast' | 'balanced' | 'premium' | 'code'
  pricing: { prompt: number; completion: number } // per 1M tokens
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: string
  updatedAt: string
}

export interface UsageStats {
  totalTokens: number
  totalCost: number
  messagesCount: number
  modelUsage: Record<string, { tokens: number; cost: number; count: number }>
}

export interface AISettings {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  autoContext: boolean
  streamEnabled: boolean
}

// ═══════ Model Catalog ═══════

const MODEL_CATALOG: ModelInfo[] = [
  // FREE MODELS
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B', provider: 'Google', free: true, maxTokens: 8192, contextLength: 8192, description: 'Modelo leve e rápido do Google. Bom para conversas casuais.', category: 'free', pricing: { prompt: 0, completion: 0 } },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', provider: 'Meta', free: true, maxTokens: 8192, contextLength: 131072, description: 'Modelo open-source da Meta. Ótimo para código e instruções.', category: 'free', pricing: { prompt: 0, completion: 0 } },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', provider: 'Mistral AI', free: true, maxTokens: 8192, contextLength: 32768, description: 'Modelo europeu eficiente. Bom para múltiplos idiomas.', category: 'free', pricing: { prompt: 0, completion: 0 } },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B', provider: 'Alibaba', free: true, maxTokens: 8192, contextLength: 131072, description: 'Modelo chinês multilíngue. Excelente para código.', category: 'free', pricing: { prompt: 0, completion: 0 } },
  { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B', provider: 'Hugging Face', free: true, maxTokens: 4096, contextLength: 8192, description: 'Modelo baseado em Mistral, fine-tuned para chat.', category: 'free', pricing: { prompt: 0, completion: 0 } },

  // FAST MODELS
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', free: false, maxTokens: 16384, contextLength: 128000, description: 'Modelo rápido e barato da OpenAI.', category: 'fast', pricing: { prompt: 0.15, completion: 0.6 } },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'Google', free: false, maxTokens: 8192, contextLength: 1048576, description: 'Ultra rápido com contexto gigante.', category: 'fast', pricing: { prompt: 0.075, completion: 0.3 } },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', free: false, maxTokens: 4096, contextLength: 200000, description: 'Modelo rápido e eficiente da Anthropic.', category: 'fast', pricing: { prompt: 0.25, completion: 1.25 } },

  // BALANCED MODELS
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', free: false, maxTokens: 16384, contextLength: 128000, description: 'Modelo principal da OpenAI. Excelente qualidade.', category: 'balanced', pricing: { prompt: 2.5, completion: 10 } },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', free: false, maxTokens: 8192, contextLength: 200000, description: 'Melhor modelo para código e análise técnica.', category: 'balanced', pricing: { prompt: 3, completion: 15 } },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', free: false, maxTokens: 8192, contextLength: 2097152, description: 'Contexto de 2M tokens! Ideal para documentos grandes.', category: 'balanced', pricing: { prompt: 1.25, completion: 5 } },

  // PREMIUM MODELS
  { id: 'openai/o1-preview', name: 'o1 Preview', provider: 'OpenAI', free: false, maxTokens: 32768, contextLength: 128000, description: 'Modelo de raciocínio avançado da OpenAI.', category: 'premium', pricing: { prompt: 15, completion: 60 } },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', free: false, maxTokens: 4096, contextLength: 200000, description: 'O mais inteligente da Anthropic. Análise profunda.', category: 'premium', pricing: { prompt: 15, completion: 75 } },

  // CODE MODELS
  { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', free: false, maxTokens: 16384, contextLength: 128000, description: 'Especializado em programação. Suporta 80+ linguagens.', category: 'code', pricing: { prompt: 0.14, completion: 0.28 } },
  { id: 'codellama/codellama-34b-instruct:free', name: 'CodeLlama 34B', provider: 'Meta', free: true, maxTokens: 4096, contextLength: 16384, description: 'Especializado em código. Gratuito!', category: 'code', pricing: { prompt: 0, completion: 0 } },
]

const DEFAULT_SYSTEM_PROMPT = `Você é o Buffy, o assistente pessoal do usuário dentro do Minecraft Launcher (Freebuff Desktop).

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
- Monitorar o estado do launcher e servidor

## Regras:
- Nunca invente soluções — se não souber, diga
- Seja honesto sobre limitações
- Use emojis com moderação
- Respostas devem ser concisas mas completas
- Quando diagnosticar um erro, explique a CAUSA e a SOLUÇÃO
- Se o usuário parecer frustrado, seja empático e motivador`

// ═══════ Main Service ═══════

export class OpenRouterService extends EventEmitter {
  private settings: AISettings
  private conversations: Conversation[] = []
  private currentConversationId: string | null = null
  private usageStats: UsageStats = { totalTokens: 0, totalCost: 0, messagesCount: 0, modelUsage: {} }
  private dataDir: string

  constructor(dataDir: string) {
    super()
    this.dataDir = dataDir
    this.settings = {
      apiKey: '',
      model: 'google/gemma-2-9b-it:free',
      temperature: 0.7,
      maxTokens: 1500,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      autoContext: true,
      streamEnabled: true,
    }
    this.loadData()
  }

  // ═══════ Settings ═══════

  getSettings(): AISettings { return { ...this.settings } }

  updateSettings(updates: Partial<AISettings>): void {
    this.settings = { ...this.settings, ...updates }
    this.saveData()
  }

  getApiKey(): string { return this.settings.apiKey }
  setApiKey(key: string): void { this.settings.apiKey = key; this.saveData() }
  getModel(): string { return this.settings.model }

  static getModels(): ModelInfo[] { return MODEL_CATALOG }
  static getModelById(id: string): ModelInfo | undefined { return MODEL_CATALOG.find(m => m.id === id) }

  // ═══════ Conversations ═══════

  getConversations(): Conversation[] {
    return this.conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  getCurrentConversation(): Conversation | null {
    if (!this.currentConversationId) return null
    return this.conversations.find(c => c.id === this.currentConversationId) || null
  }

  createConversation(title?: string): Conversation {
    const conv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title || 'Nova conversa',
      messages: [],
      model: this.settings.model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.conversations.push(conv)
    this.currentConversationId = conv.id
    this.saveData()
    return conv
  }

  selectConversation(id: string): void {
    this.currentConversationId = id
  }

  deleteConversation(id: string): void {
    this.conversations = this.conversations.filter(c => c.id !== id)
    if (this.currentConversationId === id) this.currentConversationId = null
    this.saveData()
  }

  renameConversation(id: string, title: string): void {
    const conv = this.conversations.find(c => c.id === id)
    if (conv) { conv.title = title; this.saveData() }
  }

  // ═══════ Usage Stats ═══════

  getUsageStats(): UsageStats { return { ...this.usageStats } }

  resetUsageStats(): void {
    this.usageStats = { totalTokens: 0, totalCost: 0, messagesCount: 0, modelUsage: {} }
    this.saveData()
  }

  // ═══════ Chat ═══════

  async chat(userMessage: string, context?: {
    javaPath?: string
    javaVersion?: number
    mcVersion?: string
    systemInfo?: any
    recentLogs?: string[]
    errorLogs?: string[]
  }): Promise<ChatResponse> {
    if (!this.settings.apiKey) {
      return { content: '', error: 'API key não configurada. Configure em AI → Configurações.' }
    }

    // Ensure we have a conversation
    if (!this.currentConversationId) {
      this.createConversation(this.generateTitle(userMessage))
    }
    const conv = this.getCurrentConversation()!
    conv.updatedAt = new Date().toISOString()

    // Build message
    let fullMessage = userMessage
    if (this.settings.autoContext && context) {
      const ctxParts: string[] = []
      if (context.javaPath) ctxParts.push(`Java: ${context.javaPath} (v${context.javaVersion || '?'})`)
      if (context.mcVersion) ctxParts.push(`MC: ${context.mcVersion}`)
      if (context.systemInfo) ctxParts.push(`Sistema: ${context.systemInfo.platform} ${context.systemInfo.arch}, ${context.systemInfo.cpus} CPUs, ${context.systemInfo.totalMemory}GB RAM`)
      if (context.recentLogs?.length) ctxParts.push(`Logs:\n${context.recentLogs.slice(-15).join('\n')}`)
      if (context.errorLogs?.length) ctxParts.push(`Erros:\n${context.errorLogs.slice(-10).join('\n')}`)
      if (ctxParts.length > 0) fullMessage = `[CONTEXTO]\n${ctxParts.join('\n')}\n\n${userMessage}`
    }

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: fullMessage, timestamp: new Date().toISOString() }
    conv.messages.push(userMsg)

    // Build messages for API
    const messages: ChatMessage[] = [
      { role: 'system', content: this.settings.systemPrompt },
      ...conv.messages.slice(-30).map(m => ({ role: m.role, content: m.content }))
    ]

    const startTime = Date.now()
    try {
      const response = await this.callOpenRouter(messages)
      const latencyMs = Date.now() - startTime

      if (response.error) return response

      // Add assistant message
      const assistantMsg: ChatMessage = { role: 'assistant', content: response.content, timestamp: new Date().toISOString() }
      conv.messages.push(assistantMsg)

      // Auto-title from first message
      if (conv.messages.length === 2 && conv.title === 'Nova conversa') {
        conv.title = this.generateTitle(userMessage)
      }

      // Track usage
      if (response.usage) {
        this.usageStats.totalTokens += response.usage.totalTokens
        this.usageStats.messagesCount++
        if (!this.usageStats.modelUsage[response.model || this.settings.model]) {
          this.usageStats.modelUsage[response.model || this.settings.model] = { tokens: 0, cost: 0, count: 0 }
        }
        const mu = this.usageStats.modelUsage[response.model || this.settings.model]
        mu.tokens += response.usage.totalTokens
        mu.cost += response.cost || 0
        mu.count++
        this.usageStats.totalCost += response.cost || 0
      }

      this.saveData()
      return { ...response, latencyMs }
    } catch (err: any) {
      return { content: '', error: `Erro: ${err.message}` }
    }
  }

  clearHistory(): void {
    const conv = this.getCurrentConversation()
    if (conv) { conv.messages = []; conv.updatedAt = new Date().toISOString(); this.saveData() }
  }

  // ═══════ Quick Actions ═══════

  async diagnose(errorLogs: string[]): Promise<string> {
    const response = await this.chat(`Analise estes logs de erro do Minecraft e dê um diagnóstico conciso com causa e solução:\n\n${errorLogs.join('\n')}`)
    return response.error || response.content
  }

  async suggestJvmArgs(systemInfo: any, mcVersion: string): Promise<string> {
    const response = await this.chat(`Sugira JVM args para Minecraft ${mcVersion}:\nRAM: ${systemInfo.totalMemory}GB | CPUs: ${systemInfo.cpus} | OS: ${systemInfo.platform} ${systemInfo.arch}`)
    return response.error || response.content
  }

  async fixError(errorMsg: string): Promise<string> {
    const response = await this.chat(`Como resolver este erro do Minecraft? Dê a solução passo a passo:\n\n${errorMsg}`)
    return response.error || response.content
  }

  // ═══════ OpenRouter API ═══════

  private callOpenRouter(messages: ChatMessage[]): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      const model = this.settings.model
      const modelInfo = OpenRouterService.getModelById(model)

      const body = JSON.stringify({
        model,
        messages,
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
      })

      const startTime = Date.now()
      const req = https.request({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'HTTP-Referer': 'https://github.com/KBZalemao404/BRlaunchercraft',
          'X-Title': 'Minecraft Launcher — Buffy AI',
          'Content-Length': Buffer.byteLength(body).toString()
        },
        timeout: 60000
      }, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => data += c)
        res.on('end', () => {
          try {
            const latencyMs = Date.now() - startTime

            if (res.statusCode === 401) {
              resolve({ content: '', error: 'API key inválida. Verifique sua key do OpenRouter.' })
              return
            }
            if (res.statusCode === 402) {
              resolve({ content: '', error: 'Créditos insuficientes. Use um modelo gratuito ou adicione créditos em openrouter.ai/credits' })
              return
            }
            if (res.statusCode === 429) {
              resolve({ content: '', error: 'Rate limit atingido. Aguarde ou troque de modelo.' })
              return
            }
            if (res.statusCode !== 200) {
              const errMsg = data.length > 500 ? data.substring(0, 500) : data
              resolve({ content: '', error: `OpenRouter ${res.statusCode}: ${errMsg}` })
              return
            }

            const json = JSON.parse(data)
            const content = json.choices?.[0]?.message?.content || ''
            const finishReason = json.choices?.[0]?.finish_reason
            const usage = json.usage ? {
              promptTokens: json.usage.prompt_tokens || 0,
              completionTokens: json.usage.completion_tokens || 0,
              totalTokens: (json.usage.prompt_tokens || 0) + (json.usage.completion_tokens || 0),
            } : undefined

            // Calculate cost
            let cost = 0
            if (usage && modelInfo && !modelInfo.free) {
              cost = (usage.promptTokens * modelInfo.pricing.prompt + usage.completionTokens * modelInfo.pricing.completion) / 1000000
            }

            if (!content) {
              resolve({ content: '', error: 'Resposta vazia. Tente outro modelo.', model, usage, latencyMs })
              return
            }

            resolve({ content, model, usage, cost, latencyMs, finishReason })
          } catch (err: any) {
            resolve({ content: '', error: `Erro ao processar: ${err.message}` })
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(body)
      req.end()
    })
  }

  // ═══════ Persistence ═══════

  private loadData(): void {
    try {
      const settingsPath = path.join(this.dataDir, 'ai-settings.json')
      if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        this.settings = { ...this.settings, ...data.settings }
        this.conversations = data.conversations || []
        this.usageStats = data.usageStats || this.usageStats
      }
    } catch {}
  }

  private saveData(): void {
    try {
      const settingsPath = path.join(this.dataDir, 'ai-settings.json')
      fs.writeFileSync(settingsPath, JSON.stringify({
        settings: this.settings,
        conversations: this.conversations,
        usageStats: this.usageStats,
      }, null, 2), 'utf8')
    } catch {}
  }

  private generateTitle(firstMessage: string): string {
    const words = firstMessage.split(' ').slice(0, 5).join(' ')
    return words.length > 40 ? words.substring(0, 40) + '...' : words
  }
}

export default OpenRouterService
