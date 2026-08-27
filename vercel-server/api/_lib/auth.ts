import type { VercelRequest, VercelResponse } from '@vercel/node'

export function getAdminToken(): string {
  return process.env.ADMIN_TOKEN || 'dev-token-change-in-production'
}

export function verifyAdmin(req: VercelRequest): boolean {
  const token = req.headers['x-admin-token'] || req.query.token
  return token === getAdminToken()
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: 'Unauthorized. Provide X-Admin-Token header.' })
    return false
  }
  return true
}

export function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
}

export function handleOptions(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    cors(res)
    return res.status(200).end()
  }
  return false
}
