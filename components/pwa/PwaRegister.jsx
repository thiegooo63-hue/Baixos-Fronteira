'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let registration
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage({ type: 'SKIP_WAITING' }) })
        })
        registration.update().catch(() => {})
      } catch (error) {
        console.warn('[Baixos Fronteira] Service worker não registrado:', error)
      }
    }
    const onOnline = () => registration?.update?.().catch(() => {})
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('load', register); window.removeEventListener('online', onOnline) }
  }, [])
  return null
}
