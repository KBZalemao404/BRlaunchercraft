import { EventEmitter } from 'events'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  content: string
  error?: string
}

/**
 * AI Assistant — powered by OpenAI API.
 * Acts as a friendly, technical companion for the Minecraft Launcher.
 * Knows about Java, Minecraft, mods, server issues, and everything in the project.
 */
export class AIAssistant extends EventEmitter {
  private apiKey: string = ''
  private model: string = 'gpt-4o-mini'
  private conversationHistory: ChatMessage[] = []
  private systemPrompt: string = ''
  private maxHistory = 40

  constructor(private dataDir: string) {
    super()
    this.systemPrompt = this.buildSystemPrompt()
    this.loadApiKey()
  }

  private buildSystemPrompt(): string {
    return `Você é o Buffy, o assistente pessoal do usuário dentro do Minecraft Launcher (Freebuff Desktop).

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
  }

  loadApiKey(): void {
    try {
      const settingsPath = path.join(this.dataDir, 'ai-settings.json')
      if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        this.apiKey = data.apiKey || ''
        this.model = data.model || 'gpt-4o-mini'
      }
    } catch {}
  }

  saveApiKey(apiKey: string, model?: string): void {
    this.apiKey = apiKey
    if (model) this.model = model
    try {
      const settingsPath = path.join(this.dataDir, 'ai-settings.json')
      fs.writeFileSync(settingsPath, JSON.stringify({ apiKey, model: this.model }, null, 2), 'utf8')
    } catch {}
  }

  getApiKey(): string { return this.apiKey }
  getModel(): string { return this.model }

  isConfigured(): boolean { return !!this.apiKey }

  /**
   * Send a message and get a response from the AI.
   */
  async chat(userMessage: string, context?: {
    javaPath?: string
    javaVersion?: number
    mcVersion?: string
    systemInfo?: any
    recentLogs?: string[]
    errorLogs?: string[]
  }): Promise<ChatResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'API key não configurada. Vá em Configurações → AI Assistant para configurar.' }
    }

    // Build context-aware message
    let fullMessage = userMessage
    if (context) {
      const ctxParts: string[] = []
      if (context.javaPath) ctxParts.push(`Java: ${context.javaPath} (v${context.javaVersion || '?'})`)
      if (context.mcVersion) ctxParts.push(`MC versão: ${context.mcVersion}`)
      if (context.systemInfo) ctxParts.push(`Sistema: ${context.systemInfo.platform} ${context.systemInfo.arch}, ${context.systemInfo.cpus} CPUs, ${context.systemInfo.totalMemory}GB RAM`)
      if (context.recentLogs?.length) ctxParts.push(`Logs recentes:\n${context.recentLogs.slice(-15).join('\n')}`)
      if (context.errorLogs?.length) ctxParts.push(`Logs de erro:\n${context.errorLogs.slice(-10).join('\n')}`)
      if (ctxParts.length > 0) {
        fullMessage = `[CONTEXTO DO SISTEMA]\n${ctxParts.join('\n')}\n\n[PERGUNTA DO USUÁRIO]\n${userMessage}`
      }
    }

    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: fullMessage })

    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory)
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory
    ]

    try {
      const response = await this.callOpenAI(messages)
      if (response.error) return response

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: response.content })
      return response
    } catch (err: any) {
      return { content: '', error: `Erro na IA: ${err.message}` }
    }
  }

  /**
   * Quick diagnosis — analyze error logs and give a summary
   */
  async diagnose(errorLogs: string[]): Promise<string> {
    if (!this.apiKey) return 'API key não configurada para diagnóstico.'

    const prompt = `Analise estes logs de erro do Minecraft e forneça um diagnóstico técnico conciso com causa e solução:\n\n${errorLogs.join('\n')}`

    const response = await this.chat(prompt)
    return response.error || response.content
  }

  /**
   * Suggest optimal JVM args based on system
   */
  async suggestJvmArgs(systemInfo: any, mcVersion: string): Promise<string> {
    if (!this.apiKey) return 'API key não configurada.'

    const prompt = `Sugira os melhores JVM args para Minecraft ${mcVersion} com este sistema:
- RAM: ${systemInfo.totalMemory}GB
- CPUs: ${systemInfo.cpus}
- OS: ${systemInfo.platform} ${systemInfo.arch}
- Livre: ${systemInfo.freeMemory}GB

Forneça apenas os args JVM (sem -Xms/-Xmx) com explicações curtas.`

    const response = await this.chat(prompt)
    return response.error || response.content
  }

  clearHistory(): void {
    this.conversationHistory = []
  }

  private callOpenAI(messages: ChatMessage[]): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: false
      })

      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body).toString()
        },
        timeout: 30000
      }, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => data += c)
        res.on('end', () => {
          try {
            if (res.statusCode === 401) {
              resolve({ content: '', error: 'API key inválida. Verifique em Configurações.' })
              return
            }
            if (res.statusCode === 429) {
              resolve({ content: '', error: 'Limite de requests atingido. Aguarde um momento.' })
              return
            }
            if (res.statusCode !== 200) {
              resolve({ content: '', error: `OpenAI API erro ${res.statusCode}: ${data.substring(0, 200)}` })
              return
            }
            const json = JSON.parse(data)
            const content = json.choices?.[0]?.message?.content || ''
            resolve({ content })
          } catch (err: any) {
            resolve({ content: '', error: `Erro ao processar resposta: ${err.message}` })
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(body)
      req.end()
    })
  }
}

export default AIAssistant
