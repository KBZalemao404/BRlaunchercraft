import { useEffect, useRef, useState } from 'react'

const UPDATE_SERVER_URL = 'https://minecraft-launcher-updates.vercel.app'
const BASE_INTERVAL = 30_000 // 30 seconds

/**
 * Renderer-side heartbeat hook.
 * Adaptive: pings faster when server is cold, slower when warm.
 * Tracks server status for the sidebar indicator.
 */
export function useHeartbeat(version?: string) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const failCountRef = useRef(0)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${UPDATE_SERVER_URL}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: version || '0.1.16',
            platform: navigator.platform || 'unknown'
          }),
          signal: AbortSignal.timeout(10_000)
        })
        if (res.ok) {
          const data = await res.json()
          console.debug('[heartbeat] OK', data.activeClients, 'clients')
          failCountRef.current = 0
          setServerOnline(true)
        } else {
          failCountRef.current++
          setServerOnline(false)
        }
      } catch {
        failCountRef.current++
        setServerOnline(false)
      }
    }

    // Adaptive interval: faster when server is cold
    const getInterval = () => {
      if (failCountRef.current >= 5) return 10_000   // 10s — server is cold, keep pinging
      if (failCountRef.current >= 2) return 15_000   // 15s — server struggling
      return BASE_INTERVAL                              // 30s — server is warm
    }

    const startAdaptive = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        sendHeartbeat()
        // Re-evaluate interval after each ping
        startAdaptive()
      }, getInterval())
    }

    // First heartbeat after 2 seconds (faster than before)
    const initialTimeout = setTimeout(() => {
      sendHeartbeat()
      startAdaptive()
    }, 2_000)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [version])

  return { serverOnline }
}
