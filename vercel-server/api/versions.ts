import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVersions, addVersion, updateVersion, deleteVersion, type VersionEntry } from './_lib/storage'
import { cors, handleOptions, requireAdmin } from './_lib/auth'

/**
 * GET    /api/versions              — List all versions
 * POST   /api/versions              — Create new version (admin)
 * PUT    /api/versions              — Update version (admin)
 * DELETE /api/versions?version=x    — Delete version (admin)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  try {
    // ── GET: list all ──
    if (req.method === 'GET') {
      const versions = await getVersions()
      const sorted = Object.values(versions)
        .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
      return res.status(200).json({ versions: sorted })
    }

    // ── POST/PUT/DELETE: admin only ──
    if (!requireAdmin(req, res)) return

    // ── POST: create version ──
    if (req.method === 'POST') {
      const { version, releaseNotes = '', fileName, fileUrl, fileSize = 0, fileHash = '', blockMapUrl = '', channel = 'latest', minClientVersion = '', published = true } = req.body

      if (!version || !fileUrl) {
        return res.status(400).json({ error: 'Missing required fields: version, fileUrl' })
      }

      const existing = await getVersions()
      if (existing[version]) {
        return res.status(409).json({ error: `Version ${version} already exists. Use PUT to update.` })
      }

      const entry: VersionEntry = {
        version,
        releaseDate: new Date().toISOString(),
        releaseNotes,
        fileName: fileName || `MinecraftLauncherSetup-${version}.exe`,
        fileUrl,
        fileSize,
        fileHash,
        blockMapUrl,
        channel: channel as any,
        minClientVersion,
        published,
        downloads: 0
      }

      await addVersion(entry)
      return res.status(201).json({ message: `Version ${version} created`, entry })
    }

    // ── PUT: update version ──
    if (req.method === 'PUT') {
      const { version, ...updates } = req.body
      if (!version) return res.status(400).json({ error: 'Missing "version" field' })

      const ok = await updateVersion(version, updates)
      if (!ok) return res.status(404).json({ error: `Version ${version} not found` })

      return res.status(200).json({ message: `Version ${version} updated` })
    }

    // ── DELETE: remove version ──
    if (req.method === 'DELETE') {
      const { version } = req.query as any
      if (!version) return res.status(400).json({ error: 'Missing "version" query parameter' })

      const ok = await deleteVersion(version)
      if (!ok) return res.status(404).json({ error: `Version ${version} not found` })

      return res.status(200).json({ message: `Version ${version} deleted` })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('Versions API error:', err)
    return res.status(500).json({ error: err.message })
  }
}
