import { useEffect, useRef } from 'react'

const UPDATE_SERVER_URL = 'https://minecraft-launcher-updates.vercel.app'
const HEARTBEAT_INTERVAL = 5_000 // 5 seconds (backup — main process sends every 1s)

/**
 * Renderer-side heartbeat hook.
 * Sends periodic heartbeats to the update server to keep it alive.
 * This is a backup — the main process (updater.ts) sends every 1s.
 */
export function useHeartbeat(version?: string) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${UPDATE_SERVER_URL}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: version || '0.1.1',
            platform: navigator.platform || 'unknown'
          })
        })
        if (res.ok) {
          const data = await res.json()
          console.debug('[heartbeat] OK', data.activeClients, 'clients')
        }
      } catch {
        // Silently ignore heartbeat errors
      }
    }

    // First heartbeat after 3 seconds
    const initialTimeout = setTimeout(sendHeartbeat, 3_000)

    // Then periodic
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [version])
}
