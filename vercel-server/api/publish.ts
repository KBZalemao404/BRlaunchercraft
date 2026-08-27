import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addVersion, type VersionEntry } from './_lib/storage'
import { cors, handleOptions } from './_lib/auth'

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'minecraft-launcher-admin-2026'

/**
 * POST /api/publish
 * 
 * Admin endpoint to publish a new version.
 * Requires Authorization header with admin token.
 * 
 * Body: { version, releaseDate, releaseNotes, fileName, fileUrl, fileSize, channel, minClientVersion }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = req.body || {}
    const { version, releaseDate, releaseNotes, fileName, fileUrl, fileSize, channel = 'latest', minClientVersion = '0.0.1' } = body

    if (!version) {
      return res.status(400).json({ error: 'Missing "version" in body' })
    }

    const entry: VersionEntry = {
      version,
      releaseDate: releaseDate || new Date().toISOString().split('T')[0],
      releaseNotes: releaseNotes || '',
      fileName: fileName || `MinecraftLauncherSetup-${version}.exe`,
      fileUrl: fileUrl || `https://github.com/KBZalemao404/BRlaunchercraft/releases/download/v${version}/${fileName || `MinecraftLauncherSetup-${version}.exe`}`,
      fileSize: fileSize || 0,
      fileHash: '',
      blockMapUrl: '',
      channel: channel as any,
      minClientVersion,
      published: true,
      downloads: 0
    }

    await addVersion(entry)

    return res.status(200).json({ success: true, version, entry })
  } catch (err: any) {
    console.error('Publish error:', err)
    return res.status(500).json({ error: err.message })
  }
}
