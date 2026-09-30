'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../../../lib/supabase'
import { eventDetailUrl, eventStatusLabel, expandRecurringEvents } from '../../../lib/events'
import { trackAnalytics } from '../../../lib/analytics'

const toneLabel = (tone) => ({ info: 'Informação', warning: 'Atenção', urgent: 'Urgente' }[tone] || 'Aviso')
const soundLabel = (policy) => ({ allowed: 'Som liberado', not_allowed: 'Som proibido', check_updates: 'Conforme comunicado' }[policy] || 'Conforme comunicado')

function dateLabel(value) {
  if (!value) return 'Data a confirmar'
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  }).format(new Date(value))
}

function timeRange(item) {
  if (!item?.starts_at) return 'Horário a confirmar'
  const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const start = fmt.format(new Date(item.starts_at))
  const end = item.ends_at ? fmt.format(new Date(item.ends_at)) : ''
  return end ? `${start} — ${end}` : start
}

export default function AgendaClient() {
  const supabase = useMemo(() => getSupabase(), [])
  useEffect(() => { trackAnalytics('page_view', { targetType: 'page', targetId: 'agenda' }) }, [])
  const [events, setEvents] = useState([])
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const now = Date.now()
    const [eventResult, noticeResult] = await Promise.all([
      supabase.from('events').select('*').eq('is_public', true).neq('status', 'draft').order('starts_at', { ascending: true }),
      supabase.from('announcements').select('*').eq('active', true).order('featured', { ascending: false }).order('priority', { ascending: false }).order('created_at', { ascending: false })
    ])

    if (eventResult.error || noticeResult.error) {
      setError(eventResult.error?.message || noticeResult.error?.message || 'Não foi possível carregar a agenda.')
      setLoading(false)
      return
    }

    const expanded = expandRecurringEvents(eventResult.data || [], { now, maxOccurrences: 20 })
    setEvents(expanded.filter((item) => {
      const starts = item.starts_at ? new Date(item.starts_at).getTime() : Infinity
      const ends = item.ends_at ? new Date(item.ends_at).getTime() : starts
      if (item.status === 'cancelled') return starts > now - 86400000
      return ends > now && item.status !== 'completed'
    }).slice(0, 24))

    setNotices((noticeResult.data || []).filter((item) => {
      const started = !item.starts_at || new Date(item.starts_at).getTime() <= now
      const notEnded = !item.ends_at || new Date(item.ends_at).getTime() > now
      return started && notEnded
    }))
    setError('')
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refresh()
    let timer
    const channel = supabase.channel('agenda-public-live-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refresh)
      .subscribe()
    timer = setInterval(refresh, 30000)
    return () => { clearInterval(timer); supabase.removeChannel(channel) }
  }, [refresh, supabase])

  return <main className="agenda-page">
    <header className="agenda-topbar">
      <a className="agenda-brand" href="/"><img src="/assets/logo-baixos-fronteira.png" alt="" /><span>Baixos<br/>Fronteira</span></a>
      <a className="agenda-back" href="/">← Voltar ao site</a>
    </header>

    <section className="agenda-hero">
      <p className="kicker">Atualizado pela equipe</p>
      <h1>Agenda <span>completa.</span></h1>
      <p>Próximos encontros, horários, locais e comunicados oficiais da Baixos Fronteira.</p>
      <div className="agenda-live"><i /> Sincronizado em tempo real</div>
    </section>

    {error && <div className="agenda-error">{error}</div>}

    <section className="agenda-block" aria-labelledby="agenda-events-title">
      <div className="agenda-heading"><div><p className="kicker">Próximos encontros</p><h2 id="agenda-events-title">Eventos</h2></div><b>{events.length}</b></div>
      <div className="agenda-event-list">
        {loading ? <div className="agenda-empty">Carregando agenda…</div> : events.length ? events.map((item) => <a href={eventDetailUrl(item)} className={`agenda-event-card ${item.status || 'scheduled'}`} key={item.occurrence_id || item.id}>
          <div className="agenda-card-head"><span>{dateLabel(item.starts_at)}</span><b>{item.emergency_mode ? '⚠ EMERGÊNCIA' : eventStatusLabel(item.status)}</b></div>
          <h3>{item.title || 'Encontro Baixos Fronteira'}</h3>
          <p>{item.description || 'Encontro oficial da Baixos Fronteira.'}</p>
          <div className="agenda-meta">
            <span><small>LOCAL</small><strong>{item.location_name || 'A confirmar'}</strong>{item.location_address && <em>{item.location_address}</em>}</span>
            <span><small>HORÁRIO</small><strong>{timeRange(item)}</strong></span>
            <span><small>SOM</small><strong>{soundLabel(item.sound_policy)}</strong>{item.sound_message && <em>{item.sound_message}</em>}</span>
          </div>
          <div className="agenda-card-foot"><span>{item.recurring_weekly ? '↻ Toda quinta-feira' : 'Evento único'}</span><strong>Ver detalhes ↗</strong></div>
        </a>) : <div className="agenda-empty">Nenhum próximo evento publicado no momento.</div>}
      </div>
    </section>

    <section className="agenda-block" aria-labelledby="agenda-notices-title">
      <div className="agenda-heading"><div><p className="kicker">Comunicados oficiais</p><h2 id="agenda-notices-title">Avisos</h2></div><b>{notices.length}</b></div>
      <div className="agenda-notice-list">
        {loading ? <div className="agenda-empty">Carregando avisos…</div> : notices.length ? notices.map((item) => <article className={`agenda-notice-card ${item.tone || 'info'}${item.featured ? ' featured' : ''}`} key={item.id}>
          <div><span>{item.featured ? '★ Destaque' : toneLabel(item.tone)}</span>{item.starts_at && <small>Desde {dateLabel(item.starts_at)}</small>}</div>
          <h3>{item.title || 'Aviso'}</h3>
          <p>{item.body}</p>
        </article>) : <div className="agenda-empty">Nenhum aviso ativo no momento.</div>}
      </div>
    </section>

    <footer className="agenda-footer"><a href="/">Baixos Fronteira</a><span>Jaguarão • RS</span></footer>
  </main>
}
