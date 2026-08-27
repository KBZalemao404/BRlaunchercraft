import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getVersion } from './_lib/storage'
import { cors, handleOptions } from './_lib/auth'
import https from 'https'
import http from 'http'

/**
 * GET /api/fetch-update?version=0.1.2
 * 
 * Proxies the installer download from the fileUrl stored in the version entry.
 * The launcher uses this endpoint to download updates in-app with progress tracking.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { version } = req.query as Record<string, string>

    if (!version) {
      return res.status(400).json({ error: 'Missing "version" query parameter' })
    }

    const entry = await getVersion(version)

    if (!entry) {
      return res.status(404).json({ error: `Version ${version} not found` })
    }

    if (!entry.fileUrl) {
      return res.status(404).json({ error: 'No download URL for this version' })
    }

    // Proxy the download from the original source
    const client = entry.fileUrl.startsWith('https') ? https : http

    return new Promise<void>((resolve) => {
      const proxyReq = client.get(entry.fileUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'MinecraftLauncher-Update/0.1.5' }
      }, (proxyRes) => {
        // Follow redirects
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          proxyRes.resume()
          const redirectClient = proxyRes.headers.location.startsWith('https') ? https : http
          redirectClient.get(proxyRes.headers.location, {
            timeout: 30000,
            headers: { 'User-Agent': 'MinecraftLauncher-Update/0.1.5' }
          }, (redirectRes) => {
            if (redirectRes.statusCode !== 200) {
              res.status(502).json({ error: `Upstream returned ${redirectRes.statusCode}` })
              resolve()
              return
            }
            // Stream the redirected response
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Content-Disposition', `attachment; filename="${entry.fileName || `MinecraftLauncherSetup-${version}.exe`}"`)
            if (redirectRes.headers['content-length']) {
              res.setHeader('Content-Length', redirectRes.headers['content-length'])
            }
            res.setHeader('Cache-Control', 'no-cache')
            redirectRes.pipe(res)
            redirectRes.on('end', () => resolve())
            redirectRes.on('error', () => { res.end(); resolve() })
          }).on('error', (err) => {
            res.status(502).json({ error: `Failed to follow redirect: ${err.message}` })
            resolve()
          })
          return
        }

        if (proxyRes.statusCode !== 200) {
          res.status(502).json({ error: `Upstream returned ${proxyRes.statusCode}` })
          resolve()
          return
        }

        // Stream the file
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${entry.fileName || `MinecraftLauncherSetup-${version}.exe`}"`)
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length'])
        }
        res.setHeader('Cache-Control', 'no-cache')
        proxyRes.pipe(res)
        proxyRes.on('end', () => resolve())
        proxyRes.on('error', () => { res.end(); resolve() })
      })

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: `Failed to fetch update: ${err.message}` })
        }
        resolve()
      })

      proxyReq.on('timeout', () => {
        proxyReq.destroy()
        if (!res.headersSent) {
          res.status(504).json({ error: 'Download timeout' })
        }
        resolve()
      })
    })
  } catch (err: any) {
    console.error('Fetch update error:', err)
    return res.status(500).json({ error: err.message })
  }
}
