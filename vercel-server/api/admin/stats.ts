import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVersions, getServerStats } from '../_lib/storage'
import { cors, handleOptions, requireAdmin } from '../_lib/auth'

/**
 * GET /api/admin/stats — Server statistics (admin only)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!requireAdmin(req, res)) return

  try {
    const versions = await getVersions()
    const stats = await getServerStats()

    const versionList = Object.values(versions)
      .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())

    const totalDownloads = versionList.reduce((sum, v) => sum + v.downloads, 0)

    return res.status(200).json({
      server: {
        lastHeartbeat: stats.lastHeartbeat,
        activeClients: stats.activeClients,
        totalDownloads,
        clientVersions: stats.clientVersions
      },
      versions: versionList.map(v => ({
        version: v.version,
        channel: v.channel,
        published: v.published,
        releaseDate: v.releaseDate,
        downloads: v.downloads,
        fileSize: v.fileSize
      }))
    })
  } catch (err: any) {
    console.error('Stats error:', err)
    return res.status(500).json({ error: err.message })
  }
}
