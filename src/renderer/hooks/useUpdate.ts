import { useState, useEffect, useCallback } from 'react'
import type { UpdateState } from '../../shared/types'

const defaultState: UpdateState = {
  status: 'idle',
  currentVersion: '0.1.5'
}

export function useUpdate() {
  const [state, setState] = useState<UpdateState>(defaultState)

  useEffect(() => {
    // Get initial state
    window.electronAPI?.getUpdateState?.().then((s: UpdateState | null) => {
      if (s) setState(s)
    })

    // Listen for state changes
    const listener = (s: UpdateState) => setState(s)
    window.electronAPI?.onUpdateState?.(listener)

    return () => {
      window.electronAPI?.removeAllListeners?.('update:state')
    }
  }, [])

  const checkForUpdates = useCallback(async () => {
    try {
      await window.electronAPI?.checkForUpdates?.()
    } catch (e) {
      console.error('Failed to check for updates:', e)
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    try {
      await window.electronAPI?.downloadUpdate?.()
    } catch (e) {
      console.error('Failed to download update:', e)
      throw e
    }
  }, [])

  const installUpdate = useCallback(async () => {
    try {
      await window.electronAPI?.installUpdate?.()
    } catch (e) {
      console.error('Failed to install update:', e)
      throw e
    }
  }, [])

  const cancelUpdate = useCallback(async () => {
    try {
      await window.electronAPI?.cancelUpdate?.()
    } catch (e) {
      console.error('Failed to cancel update:', e)
    }
  }, [])

  return {
    state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelUpdate,
    isChecking: state.status === 'checking',
    isDownloading: state.status === 'downloading',
    isDownloaded: state.status === 'downloaded',
    isAvailable: state.status === 'available',
    hasError: state.status === 'error',
    isNewVersion: state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded'
  }
}
