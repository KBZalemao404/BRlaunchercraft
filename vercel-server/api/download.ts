import type { VercelRequest, VercelResponse } from '@vercel/node'
import { recordDownload, getVersion } from './_lib/storage'
import { cors, handleOptions } from './_lib/auth'

/**
 * POST /api/download — Track download event
 * Body: { version: "1.0.0" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { version } = req.body

    if (!version) {
      return res.status(400).json({ error: 'Missing "version" field' })
    }

    await recordDownload(version)

    const entry = await getVersion(version)

    return res.status(200).json({
      status: 'tracked',
      version,
      downloads: entry?.downloads || 0,
      fileUrl: entry?.fileUrl || null
    })
  } catch (err: any) {
    console.error('Download tracking error:', err)
    return res.status(500).json({ error: err.message })
  }
}
