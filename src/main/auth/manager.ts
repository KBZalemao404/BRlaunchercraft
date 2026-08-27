import * as https from 'https'
import { SecureTokenStore } from '../security/security'
import { EventEmitter } from 'events'
import { AuthAccount } from '../../shared/types'

const MS_DEVICE_CODE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const XBOX_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XBOX_XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'
const MC_CLIENT_ID = '00000000402b5328'

export class AuthManager extends EventEmitter {
  private tokenStore: SecureTokenStore
  private account: AuthAccount | null = null
  private polling = false
  private pollTimer: NodeJS.Timeout | null = null

  constructor(tokenPath: string) {
    super()
    this.tokenStore = new SecureTokenStore(tokenPath)
    const stored = this.tokenStore.load()
    if (stored?.accessToken) {
      this.account = stored
      if (stored.expiresAt && Date.now() > stored.expiresAt) this.tryRefresh(stored)
    }
  }

  getAccount(): AuthAccount | null {
    if (!this.account) return null
    if (this.account.expiresAt && Date.now() > this.account.expiresAt) return { ...this.account, expiresAt: 0 } as any
    return this.account
  }

  async startDeviceCodeFlow() {
    const body = new URLSearchParams({ client_id: MC_CLIENT_ID, scope: 'service::user.auth.xboxlive.com::MBI_SSL' })
    const response = await this.httpPost(MS_DEVICE_CODE_URL, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' })
    const data = JSON.parse(response)
    this.startPolling(data.device_code, data.interval, data.expires_in)
    return { userCode: data.user_code, verificationUri: data.verification_uri, expiresInSeconds: data.expires_in, interval: data.interval, message: data.message }
  }

  private startPolling(deviceCode: string, interval: number, expiresIn: number) {
    if (this.polling) return
    this.polling = true
    const startTime = Date.now()
    this.pollTimer = setInterval(async () => {
      if (Date.now() - startTime > expiresIn * 1000) { this.stopPolling(); this.emit('auth-expired'); return }
      try {
        const body = new URLSearchParams({ client_id: MC_CLIENT_ID, grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode })
        const response = await this.httpPost(MS_TOKEN_URL, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' })
        const data = JSON.parse(response)
        if (data.access_token) { this.stopPolling(); await this.completeAuth(data.access_token, data.refresh_token, data.expires_in) }
        else if (data.error === 'slow_down') { /* increase interval */ }
        else if (data.error && data.error !== 'authorization_pending') { this.stopPolling(); this.emit('auth-error', data.error_description || data.error) }
      } catch {}
    }, (interval || 5) * 1000)
  }

  private stopPolling() { this.polling = false; if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null } }

  private async completeAuth(msAccessToken: string, refreshToken?: string, expiresIn?: number) {
    try {
      this.emit('auth-progress', 'Conectando ao Xbox Live...')
      const xboxToken = await this.authenticateXbox(msAccessToken)
      this.emit('auth-progress', 'Obtendo token XSTS...')
      const xstsToken = await this.authorizeXSTS(xboxToken)
      this.emit('auth-progress', 'Entrando na conta Minecraft...')
      const mcToken = await this.loginMinecraft(xstsToken)
      this.emit('auth-progress', 'Obtendo perfil do jogador...')
      const profile = await this.getProfile(mcToken)
      this.account = {
        username: profile.name, uuid: profile.id, accessToken: mcToken,
        refreshToken, expiresAt: Date.now() + ((expiresIn || 86400) * 1000) - 60000,
        type: 'microsoft', skins: profile.skins || []
      }
      this.tokenStore.save(this.account)
      this.emit('auth-success', this.account)
    } catch (err: any) { this.emit('auth-error', err.message); throw err }
  }

  private async authenticateXbox(msToken: string) {
    const payload = { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msToken }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' }
    const response = await this.httpPost(XBOX_AUTH_URL, JSON.stringify(payload), { 'Content-Type': 'application/json', 'Accept': 'application/json' })
    const data = JSON.parse(response)
    if (!data.Token) throw new Error('Falha na autenticação Xbox Live')
    return { token: data.Token, userHash: data.DisplayClaims.xui[0].uhs }
  }

  private async authorizeXSTS(xboxToken: { token: string; userHash: string }) {
    const payload = { Properties: { SandboxId: 'RETAIL', UserTokens: [xboxToken.token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' }
    const response = await this.httpPost(XBOX_XSTS_URL, JSON.stringify(payload), { 'Content-Type': 'application/json', 'Accept': 'application/json' })
    const data = JSON.parse(response)
    if (data.XErr) {
      const errors: Record<number, string> = { 2148916233: 'Conta sem acesso ao Minecraft. Compre o jogo.', 2148916235: 'Conta não encontrada.', 2148916236: 'Conta suspensa.' }
      throw new Error(errors[data.XErr] || `Erro XSTS: ${data.XErr}`)
    }
    if (!data.Token) throw new Error('Falha na autorização XSTS')
    return { token: data.Token, userHash: xboxToken.userHash }
  }

  private async loginMinecraft(xstsToken: { token: string; userHash: string }) {
    const response = await this.httpPost(MC_LOGIN_URL, JSON.stringify({ identityToken: `XBL3.0 x=${xstsToken.userHash};${xstsToken.token}` }), { 'Content-Type': 'application/json' })
    const data = JSON.parse(response)
    if (!data.access_token) throw new Error('Falha no login Minecraft')
    return data.access_token
  }

  private async getProfile(mcToken: string) {
    const response = await this.httpGet(MC_PROFILE_URL, { 'Authorization': `Bearer ${mcToken}` })
    const data = JSON.parse(response)
    if (data.error) throw new Error(data.errorType === 'NOT_FOUND' ? 'Conta sem Minecraft. Compre o jogo.' : `Erro: ${data.errorMessage || data.error}`)
    return { id: data.id, name: data.name, skins: data.skins || [] }
  }

  private async tryRefresh(stored: AuthAccount) {
    if (!stored.refreshToken) { this.account = null; this.tokenStore.clear(); this.emit('auth-expired'); return }
    try {
      const body = new URLSearchParams({ client_id: MC_CLIENT_ID, grant_type: 'refresh_token', refresh_token: stored.refreshToken })
      const response = await this.httpPost(MS_TOKEN_URL, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' })
      const data = JSON.parse(response)
      if (data.access_token) await this.completeAuth(data.access_token, data.refresh_token || stored.refreshToken, data.expires_in)
      else { this.account = null; this.tokenStore.clear(); this.emit('auth-expired') }
    } catch { this.emit('auth-error', 'Sessão expirada. Faça login novamente.') }
  }

  logout() { this.stopPolling(); this.account = null; this.tokenStore.clear(); this.emit('auth-logout') }

  loginOffline(username: string) {
    if (!username || username.trim().length < 3) throw new Error('Nome de usuário deve ter pelo menos 3 caracteres.')
    if (username.trim().length > 16) throw new Error('Nome de usuário deve ter no máximo 16 caracteres.')
    const clean = username.trim()
    // Generate deterministic UUID from username
    const uuid = this.generateOfflineUUID(clean)
    this.account = {
      username: clean,
      uuid,
      accessToken: '0',
      type: 'offline'
    }
    this.tokenStore.save(this.account)
    this.emit('auth-success', this.account)
    return this.account
  }

  private generateOfflineUUID(name: string): string {
    // Minecraft offline UUID is MD5 of "OfflinePlayer:<name>"
    const crypto = require('crypto')
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + name).digest()
    hash[6] = (hash[6] & 0x0f) | 0x30 // version 3
    hash[8] = (hash[8] & 0x3f) | 0x80 // variant
    const hex = hash.toString('hex')
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  }

  private httpPost(url: string, body: string, headers: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const req = https.request({ hostname: parsed.hostname, port: 443, path: parsed.pathname, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() }, timeout: 30000 }, (res) => {
        let data = ''; res.on('data', (c) => data += c); res.on('end', () => resolve(data))
      })
      req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
      req.write(body); req.end()
    })
  }

  private httpGet(url: string, headers: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      https.get({ hostname: parsed.hostname, port: 443, path: parsed.pathname + parsed.search, headers, timeout: 30000 }, (res) => {
        let data = ''; res.on('data', (c) => data += c); res.on('end', () => resolve(data))
      }).on('error', reject)
    })
  }
}

export default AuthManager
