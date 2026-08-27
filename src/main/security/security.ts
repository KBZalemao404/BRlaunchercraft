import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

export function sanitizePath(basePath: string, filePath: string): string {
  const resolved = path.resolve(basePath, filePath)
  const normalizedBase = path.resolve(basePath)
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error(`Path traversal detected: ${filePath}`)
  }
  return resolved
}

export function validateHash(filePath: string, expectedHash: string): boolean {
  if (!fs.existsSync(filePath)) return false
  try {
    const content = fs.readFileSync(filePath)
    const actualHash = crypto.createHash('sha1').update(content).digest('hex')
    return actualHash === expectedHash
  } catch { return false }
}

export function computeHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export function isSafePath(filePath: string): boolean {
  return !['..', '~', '\0'].some(d => filePath.includes(d))
}

export function verifyFileIntegrity(filePath: string, expectedSize?: number, expectedSha1?: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  if (!fs.existsSync(filePath)) return { valid: false, issues: ['missing'] }
  const stats = fs.statSync(filePath)
  if (expectedSize && stats.size !== expectedSize) issues.push('size_mismatch')
  if (expectedSha1) {
    try {
      const content = fs.readFileSync(filePath)
      const actualHash = crypto.createHash('sha1').update(content).digest('hex')
      if (actualHash !== expectedSha1) issues.push('hash_mismatch')
    } catch { issues.push('hash_error') }
  }
  return { valid: issues.length === 0, issues }
}

export class SecureTokenStore {
  private filePath: string
  private key = 'FreebuffMCLauncher2024!@#$%^&*()_+'

  constructor(filePath: string) {
    this.filePath = filePath
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  private obfuscate(data: any): string {
    const buf = Buffer.from(JSON.stringify(data), 'utf8')
    const keyBuf = Buffer.from(this.key)
    const result = Buffer.alloc(buf.length)
    for (let i = 0; i < buf.length; i++) result[i] = buf[i] ^ keyBuf[i % keyBuf.length]
    return result.toString('base64')
  }

  private deobfuscate(encrypted: string): any {
    try {
      const buf = Buffer.from(encrypted, 'base64')
      const keyBuf = Buffer.from(this.key)
      const result = Buffer.alloc(buf.length)
      for (let i = 0; i < buf.length; i++) result[i] = buf[i] ^ keyBuf[i % keyBuf.length]
      return JSON.parse(result.toString('utf8'))
    } catch { return null }
  }

  save(data: any): void {
    fs.writeFileSync(this.filePath, this.obfuscate(data), 'utf8')
  }

  load(): any {
    if (!fs.existsSync(this.filePath)) return null
    return this.deobfuscate(fs.readFileSync(this.filePath, 'utf8'))
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath)
  }
}
