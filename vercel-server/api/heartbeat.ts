import type { VercelRequest, VercelResponse } from '@vercel/node'
import { recordHeartbeat, decrementActiveClients, getServerStats } from './_lib/storage'
import { cors, handleOptions } from './_lib/auth'

/**
 * POST /api/heartbeat  — Launcher sends heartbeat every 1s
 * GET  /api/heartbeat  — Get server status (public)
 *
 * Body: { version: "1.0.0", platform: "win32" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  try {
    // ── GET: public server status ──
    if (req.method === 'GET') {
      const stats = await getServerStats()
      return res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: 'active',
        ...stats
      })
    }

    // ── POST: client heartbeat ──
    if (req.method === 'POST') {
      const { version = 'unknown', platform = 'unknown' } = req.body || {}

      const state = await recordHeartbeat(version, platform)

      return res.status(200).json({
        status: 'ok',
        timestamp: state.lastHeartbeat,
        serverTime: new Date().toISOString(),
        activeClients: state.activeClients,
        totalDownloads: state.totalDownloads,
        // Tell client if update is available (quick check without full update flow)
        latestVersion: Object.values(state.versions)
          .filter(v => v.published && v.channel === 'latest')
          .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())[0]?.version || null
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Heartbeat error:', err)
    return res.status(500).json({ error: err.message })
  }
}
