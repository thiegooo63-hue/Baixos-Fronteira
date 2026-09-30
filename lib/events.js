const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function expandRecurringEvents(rows = [], { now = Date.now(), maxOccurrences = 16 } = {}) {
  const expanded = []

  for (const row of rows || []) {
    if (!row?.starts_at) continue
    const baseStart = new Date(row.starts_at).getTime()
    if (!Number.isFinite(baseStart)) continue
    const baseEnd = row.ends_at ? new Date(row.ends_at).getTime() : baseStart + (2.5 * 60 * 60 * 1000)
    const duration = Math.max(15 * 60 * 1000, baseEnd - baseStart)

    if (!row.recurring_weekly) {
      expanded.push({ ...row, source_id: row.id, occurrence_id: String(row.id), recurring_instance: false })
      continue
    }

    const until = row.recurrence_until
      ? new Date(`${row.recurrence_until}T23:59:59-03:00`).getTime()
      : now + (26 * WEEK_MS)

    let start = baseStart
    while (start + duration < now - WEEK_MS) start += WEEK_MS

    let count = 0
    while (start <= until && count < maxOccurrences) {
      expanded.push({
        ...row,
        source_id: row.id,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + duration).toISOString(),
        occurrence_id: `${row.id}-${start}`,
        recurring_instance: true
      })
      start += WEEK_MS
      count += 1
    }
  }

  return expanded.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
}

export function eventDetailUrl(item) {
  if (!item) return '/agenda'
  if (item.locked_weekly) return '/e/quinta'
  const id = item.source_id ?? item.id
  const at = item.starts_at ? `?at=${encodeURIComponent(item.starts_at)}` : ''
  return `/agenda/${id}${at}`
}

export function isThursdayInSaoPaulo(value) {
  if (!value) return false
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
  return weekday === 'Thu'
}

export function eventStatusLabel(status) {
  return ({ scheduled: 'Confirmado', live: 'Ao vivo', postponed: 'Adiado', cancelled: 'Cancelado', completed: 'Encerrado', draft: 'Rascunho' })[status] || 'Evento'
}
