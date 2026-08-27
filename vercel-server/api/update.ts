import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getLatestVersion, getVersion, getServerStats } from './_lib/storage'
import { cors, handleOptions } from './_lib/auth'

/**
 * GET /api/update?current=1.0.0&channel=latest
 *
 * Returns update info if a newer version is available.
 * The launcher calls this to check if it should update.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { current, channel = 'latest', platform = 'win32' } = req.query as Record<string, string>

    if (!current) {
      return res.status(400).json({ error: 'Missing "current" query parameter (current app version)' })
    }

    const latest = await getLatestVersion(channel as any)

    if (!latest) {
      return res.status(200).json({
        updateAvailable: false,
        currentVersion: current,
        message: 'No versions published yet'
      })
    }

    // Simple semver comparison
    const currentParts = current.split('.').map(Number)
    const latestParts = latest.version.split('.').map(Number)
    let isNewer = false

    for (let i = 0; i < 3; i++) {
      const c = currentParts[i] || 0
      const l = latestParts[i] || 0
      if (l > c) { isNewer = true; break }
      if (l < c) break
    }

    if (!isNewer) {
      return res.status(200).json({
        updateAvailable: false,
        currentVersion: current,
        latestVersion: latest.version,
        message: 'You are up to date'
      })
    }

    // Return full update info
    return res.status(200).json({
      updateAvailable: true,
      currentVersion: current,
      version: latest.version,
      releaseDate: latest.releaseDate,
      releaseNotes: latest.releaseNotes,
      fileUrl: latest.fileUrl,
      fileSize: latest.fileSize,
      fileHash: latest.fileHash,
      blockMapUrl: latest.blockMapUrl,
      minClientVersion: latest.minClientVersion,
      fileName: latest.fileName
    })
  } catch (err: any) {
    console.error('Update check error:', err)
    return res.status(500).json({ error: err.message })
  }
}
