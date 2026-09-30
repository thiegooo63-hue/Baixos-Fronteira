'use client'

import { getSupabase } from './supabase'

const KEY = 'bf_visitor_id_v10'

function visitorId() {
  if (typeof window === 'undefined') return null
  try {
    let value = localStorage.getItem(KEY)
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `bf-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(KEY, value)
    }
    return value
  } catch {
    return null
  }
}

export async function trackAnalytics(eventType, { targetType = null, targetId = null, metadata = {} } = {}) {
  if (typeof window === 'undefined') return
  try {
    const supabase = getSupabase()
    await supabase.from('site_analytics').insert({
      visitor_id: visitorId(),
      event_type: String(eventType || '').slice(0, 80),
      target_type: targetType ? String(targetType).slice(0, 80) : null,
      target_id: targetId != null ? String(targetId).slice(0, 180) : null,
      path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      metadata
    })
  } catch {
    // Analytics nunca pode quebrar a navegação pública.
  }
}
