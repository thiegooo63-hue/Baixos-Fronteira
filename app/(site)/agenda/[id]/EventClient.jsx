'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabase } from '../../../../lib/supabase'
import { eventStatusLabel, expandRecurringEvents } from '../../../../lib/events'
import { trackAnalytics } from '../../../../lib/analytics'

const soundLabel = (policy) => ({ allowed: 'Som liberado', not_allowed: 'Som proibido', check_updates: 'Conforme comunicado' }[policy] || 'Conforme comunicado')

function dateLong(value) {
  if (!value) return 'Data a confirmar'
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
}
function timeRange(item) {
  if (!item?.starts_at) return 'Horário a confirmar'
  const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const start = fmt.format(new Date(item.starts_at))
  const end = item.ends_at ? fmt.format(new Date(item.ends_at)) : ''
  return end ? `${start} — ${end}` : start
}

function EventCountdown({ event }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  if (!event?.starts_at) return null
  const target = new Date(event.starts_at).getTime()
  const diff = Math.max(0, target - now)
  if (diff <= 0) return <div className="detail-countdown live">O encontro já começou.</div>
  const values = [
    [Math.floor(diff / 86400000), 'dias'],
    [Math.floor((diff % 86400000) / 3600000), 'horas'],
    [Math.floor((diff % 3600000) / 60000), 'min'],
    [Math.floor((diff % 60000) / 1000), 'seg']
  ]
  return <div className="detail-countdown">{values.map(([value,label]) => <span key={label}><b>{String(value).padStart(2,'0')}</b><small>{label}</small></span>)}</div>
}

export default function EventClient({ official = false }) {
  const params = useParams()
  const supabase = useMemo(() => getSupabase(), [])
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const [eventSponsors, setEventSponsors] = useState([])

  const load = useCallback(async () => {
    let query = supabase.from('events').select('*').eq('is_public', true).neq('status', 'draft')
    query = official ? query.eq('locked_weekly', true) : query.eq('id', params.id)
    const { data, error: queryError } = await query.maybeSingle()
    if (queryError || !data) {
      setError(queryError?.message || 'Evento não encontrado.')
      setEvent(null)
      return
    }
    const at = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('at') : null
    const expanded = expandRecurringEvents([data], { now: Date.now() - 86400000, maxOccurrences: 28 })
    let selected = expanded[0] || { ...data, source_id: data.id, occurrence_id: String(data.id) }
    if (at) {
      const target = new Date(at).getTime()
      const found = expanded.find((item) => Math.abs(new Date(item.starts_at).getTime() - target) < 60000)
      if (found) selected = found
    } else {
      selected = expanded.find((item) => new Date(item.ends_at || item.starts_at).getTime() > Date.now()) || selected
    }
    setEvent(selected)
    setError('')
  }, [official, params.id, supabase])

  useEffect(() => { setCurrentUrl(window.location.href); trackAnalytics('page_view', { targetType: 'event', targetId: official ? 'quinta' : params.id }) }, [official, params.id])

  useEffect(() => {
    load()
    const channel = supabase.channel(`event-detail-${official ? 'quinta' : params.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load).subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, official, params.id, supabase])

  useEffect(() => {
    const ids = Array.isArray(event?.sponsor_ids) ? event.sponsor_ids.filter(Boolean) : []
    if (!ids.length) { setEventSponsors([]); return }
    supabase.from('sponsors').select('*').eq('active', true).in('id', ids).then(({ data }) => setEventSponsors(data || []))
  }, [event?.sponsor_ids, supabase])

  async function share() {
    if (!event) return
    trackAnalytics('event_share', { targetType: 'event', targetId: event.source_id || event.id })
    const url = window.location.href
    const text = `${event.title || 'Encontro Baixos Fronteira'} — ${dateLong(event.starts_at)} às ${timeRange(event)}.`
    try {
      if (navigator.share) await navigator.share({ title: event.title || 'Baixos Fronteira', text, url })
      else {
        await navigator.clipboard.writeText(url)
        setShareMessage('Link copiado!')
        setTimeout(() => setShareMessage(''), 1800)
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') setShareMessage('Não foi possível compartilhar.')
    }
  }

  const whatsappHref = event && currentUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${event.title || 'Encontro Baixos Fronteira'} — ${dateLong(event.starts_at)}. ${currentUrl}`)}`
    : '#'

  const mapQuery = event ? [event.location_name, event.location_address, 'Jaguarão RS'].filter(Boolean).join(', ') : 'Posto Buffon, Boca da Ponte, Jaguarão RS'
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
  const coverUrl = event?.cover_storage_path ? supabase.storage.from('gallery').getPublicUrl(event.cover_storage_path).data.publicUrl : ''

  if (error) return <main className="event-detail-page"><header className="agenda-topbar"><a className="agenda-brand" href="/"><img src="/assets/logo-baixos-fronteira.png" alt=""/><span>Baixos<br/>Fronteira</span></a><a className="agenda-back" href="/agenda">← Agenda</a></header><section className="event-detail-error"><h1>Evento não encontrado.</h1><p>{error}</p><a href="/agenda">Voltar para a agenda</a></section></main>
  if (!event) return <main className="event-detail-page"><div className="agenda-empty">Carregando evento…</div></main>

  return <main className="event-detail-page">
    <header className="agenda-topbar"><a className="agenda-brand" href="/"><img src="/assets/logo-baixos-fronteira.png" alt=""/><span>Baixos<br/>Fronteira</span></a><a className="agenda-back" href="/agenda">← Agenda completa</a></header>
    <section className={`event-detail-hero ${event.status || 'scheduled'}${event.emergency_mode ? ' emergency' : ''}`} style={coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(4,4,4,.92), rgba(4,4,4,.62)), url(${coverUrl})` } : undefined}>
      <div className="event-detail-copy">
        {event.emergency_mode && <div className="event-emergency-banner"><b>⚠ MODO EMERGÊNCIA</b><span>{event.emergency_message || 'Atenção: houve uma alteração importante neste encontro.'}</span></div>}
        <div className="event-detail-status"><span>{event.emergency_mode ? '⚠ EMERGÊNCIA' : eventStatusLabel(event.status)}</span>{event.recurring_weekly && <b>↻ Toda quinta-feira</b>}</div>
        <p className="kicker">Baixos Fronteira • Jaguarão</p>
        <h1>{event.title || 'Encontro Baixos Fronteira'}</h1>
        <p>{event.description || 'Encontro oficial da Baixos Fronteira.'}</p>
        <EventCountdown event={event} />
        <div className="event-detail-actions"><button type="button" onClick={share}>Compartilhar ↗</button><a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_whatsapp',{targetType:'event',targetId:event.source_id||event.id})}>WhatsApp ↗</a><a href={mapHref} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_map',{targetType:'event',targetId:event.source_id||event.id})}>Abrir no mapa ↗</a></div>
        {shareMessage && <small className="share-feedback">{shareMessage}</small>}
      </div>
    </section>
    <div className="event-detail-content">
      <section className="event-detail-overview" aria-labelledby="event-overview-title">
        <div className="event-detail-section-head">
          <div><small>GUIA DO ENCONTRO</small><h2 id="event-overview-title">Informações essenciais</h2></div>
          <p>Data, horário, local e regras principais reunidos em um único bloco.</p>
        </div>
        <div className="event-detail-grid">
          <article><small>DATA</small><strong>{dateLong(event.starts_at)}</strong></article>
          <article><small>HORÁRIO</small><strong>{timeRange(event)}</strong></article>
          <article><small>LOCAL</small><strong>{event.location_name || 'A confirmar'}</strong>{event.location_address && <span>{event.location_address}</span>}</article>
          <article><small>STATUS</small><strong>{eventStatusLabel(event.status)}</strong></article>
          <article className="wide"><small>REGRA DO SOM</small><strong>{soundLabel(event.sound_policy)}</strong><span>{event.sound_message || 'A equipe informa no grupo e no Instagram.'}</span></article>
        </div>
      </section>

      <section className={`event-support-grid${event.locked_weekly ? '' : ' single'}`} aria-label="Acesso ao encontro">
        <div className="event-map-section"><div><small>LOCALIZAÇÃO</small><h2>{event.location_name || 'Posto Buffon'}</h2><p>{event.location_address || 'Boca da Ponte'}</p><a href={mapHref} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_map',{targetType:'event',targetId:event.source_id||event.id})}>Abrir no Google Maps ↗</a></div><iframe title="Mapa do encontro" src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
        {event.locked_weekly && <div className="event-qr-section"><img src="/assets/qr-quinta.png" alt="QR Code do encontro de quinta"/><div><small>LINK CURTO</small><h2>/e/quinta</h2><p>Aponte a câmera para abrir a página oficial do encontro.</p><button type="button" onClick={async()=>{trackAnalytics('qr_link_copy',{targetType:'event',targetId:'quinta'});await navigator.clipboard?.writeText(`${location.origin}/e/quinta`);setShareMessage('Link curto copiado!');setTimeout(()=>setShareMessage(''),1800)}}>Copiar link</button></div></div>}
      </section>

      {eventSponsors.length ? <section className="event-sponsors" aria-labelledby="event-sponsors-title"><div className="event-detail-section-head"><div><small>APOIO DESTA NOITE</small><h2 id="event-sponsors-title">Patrocinadores do encontro</h2></div><p>Parceiros que fortalecem a Baixos Fronteira.</p></div><div className="event-sponsors-grid">{eventSponsors.map(item => { const media = item.media_storage_path ? supabase.storage.from('sponsor-media').getPublicUrl(item.media_storage_path).data.publicUrl : ''; const handle = String(item.social_handle || item.instagram_handle || '').replace(/^@/,''); const url = item.instagram_url || (handle ? `https://instagram.com/${handle}/` : item.website_url || '#'); return <a key={item.id} href={url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{source:'event'}})}><div>{media ? (item.media_type === 'video' ? <video src={media} muted playsInline preload="none" /> : <img src={media} alt={item.name} loading="lazy" />) : <img src="/assets/logo-baixos-fronteira.png" alt="" />}</div><span><b>{item.name}</b><small>{handle ? `@${handle}` : 'Patrocinador oficial'} ↗</small></span></a> })}</div></section> : null}
      <section className="event-detail-footer"><a href="/agenda">Ver outros encontros</a><button type="button" onClick={share}>Compartilhar evento</button></section>
    </div>
  </main>
}
