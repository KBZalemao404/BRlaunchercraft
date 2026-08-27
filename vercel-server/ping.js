/**
 * Ping script — keeps the Vercel server warm by sending a heartbeat every 1 second.
 *
 * Usage:
 *   node ping.js                          # Default: http://localhost:3001
 *   node ping.js https://your-app.vercel.app
 *   SERVER_URL=https://your-app.vercel.app node ping.js
 *
 * Environment:
 *   SERVER_URL  — The base URL of the update server
 *   VERSION     — Current launcher version (default: "1.0.0")
 *   PLATFORM    — Client platform (default: "win32")
 */

const SERVER_URL = process.env.SERVER_URL || process.argv[2] || 'http://localhost:3001'
const VERSION = process.env.VERSION || '0.1.8'
const PLATFORM = process.env.PLATFORM || 'win32'
const INTERVAL_MS = 1000 // 1 second

let pingCount = 0
let lastLatency = 0
let errors = 0

async function ping() {
  const start = Date.now()
  try {
    const res = await fetch(`${SERVER_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: VERSION, platform: PLATFORM })
    })

    lastLatency = Date.now() - start
    const data = await res.json()
    pingCount++

    const time = new Date().toLocaleTimeString('pt-BR')
    const status = data.status === 'ok' ? '🟢' : '🟡'
    const clients = data.activeClients || 0
    const downloads = data.totalDownloads || 0
    const latest = data.latestVersion || '-'

    process.stdout.write(
      `\r${status} [${time}] Ping #${pingCount} | ${lastLatency}ms | ` +
      `Clients: ${clients} | Downloads: ${downloads} | Latest: v${latest}  `
    )
  } catch (err) {
    errors++
    const time = new Date().toLocaleTimeString('pt-BR')
    process.stdout.write(
      `\r🔴 [${time}] Ping #${pingCount} | ERROR: ${err.message} (failures: ${errors})  `
    )
  }
}

console.log('═══════════════════════════════════════════════════')
console.log(`  🏓 Minecraft Launcher Update Server — Ping`)
console.log(`  Server: ${SERVER_URL}`)
console.log(`  Version: ${VERSION} | Platform: ${PLATFORM}`)
console.log(`  Interval: ${INTERVAL_MS}ms`)
console.log('═══════════════════════════════════════════════════')
console.log('')

// Send first ping immediately
ping()

// Then every interval
const interval = setInterval(ping, INTERVAL_MS)

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(interval)
  console.log(`\n\n📊 Session stats: ${pingCount} pings, ${errors} errors, avg ${lastLatency}ms`)
  process.exit(0)
})
