'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase, SUPABASE_URL } from '../../lib/supabase'
import { eventDetailUrl, eventStatusLabel, expandRecurringEvents } from '../../lib/events'
import { trackAnalytics } from '../../lib/analytics'

const FALLBACK = {
  hero: { tagline: 'Unidos pela mesma paixão, som alto e carro baixo.' },
  story: {
    lead: 'A Baixos Fronteira nasceu para unir projetos, pessoas e estilos. O que começou como resenha ganhou identidade e virou parte da cultura automotiva de Jaguarão.',
    modal_intro: 'A Baixos Fronteira representa quem transforma carro em identidade. A equipe cresceu ao redor da amizade, da admiração pelos projetos e da vontade de criar um encontro organizado para Jaguarão.'
  },
  group: {
    footer_text: 'Unidos pela mesma paixão. Som alto e carro baixo.',
    whatsapp_url: 'https://chat.whatsapp.com/FFpDyBIhcVz9F6UPy9bA5W',
    instagram_url: 'https://www.instagram.com/baixos_fronteira_jag/',
    instagram_handle: '@baixos_fronteira_jag',
    tiktok_url: 'https://www.tiktok.com/@baixos_fronteira_jag',
    tiktok_handle: '@baixos_fronteira_jag',
    threads_url: 'https://www.threads.com/@baixos_fronteira_jag',
    threads_handle: '@baixos_fronteira_jag'
  }
}

const EVENT_FALLBACK = {
  title: 'Encontro semanal',
  description: 'Chega junto, estaciona o projeto e fortalece a cena. Organização, amizade e respeito ao local.',
  location_name: 'Posto Buffon',
  location_address: 'Rua Uruguai • Boca da Ponte',
  sound_policy: 'check_updates',
  sound_message: 'A liberação ou proibição é informada no grupo e no Instagram.'
}

const soundTitles = {
  allowed: 'Som liberado',
  not_allowed: 'Som automotivo proibido',
  check_updates: 'Som conforme comunicado'
}

const noticeToneLabel = (tone) => ({
  info: 'Informação',
  warning: 'Atenção',
  urgent: 'Urgente'
}[tone] || 'Aviso')

const formatDate = (value) => {
  if (!value) return 'Nova data em breve'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(new Date(value)).replace(',', ' •')
  } catch {
    return 'Nova data em breve'
  }
}

const formatTimeRange = (item) => {
  if (!item?.starts_at) return '19:30 — 22:00'
  const format = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const start = format.format(new Date(item.starts_at))
  const end = item.ends_at ? format.format(new Date(item.ends_at)) : ''
  return end ? `${start} — ${end}` : start
}

const storagePublicUrl = (path) => {
  if (!path) return ''
  const safePath = String(path).split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/gallery/${safePath}`
}

const sponsorMediaPublicUrl = (path) => {
  if (!path) return ''
  const safePath = String(path).split('/').map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/sponsor-media/${safePath}`
}

const cleanSponsorHandle = (value) => String(value || '').trim().replace(/^@+/, '').replace(/\s+/g, '')
const sponsorPrimarySocials = (item) => {
  const handle = cleanSponsorHandle(item?.social_handle || item?.instagram_handle || item?.tiktok_handle || item?.threads_handle)
  const display = handle ? `@${handle}` : 'Abrir perfil'
  return [
    ['Instagram', item?.instagram_url || (handle ? `https://www.instagram.com/${handle}/` : ''), display],
    ['TikTok', item?.tiktok_url || (handle ? `https://www.tiktok.com/@${handle}` : ''), display],
    ['Threads', item?.threads_url || (handle ? `https://www.threads.com/@${handle}` : ''), display]
  ].filter(([, url]) => Boolean(url))
}

function useBodyLock(active, photoMode = false) {
  useEffect(() => {
    if (!active) return
    const scrollY = window.scrollY
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width
    }
    body.classList.add('modal-open')
    if (photoMode) body.classList.add('photo-viewing')
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    return () => {
      body.classList.remove('modal-open', 'photo-viewing')
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      window.scrollTo(0, scrollY)
    }
  }, [active, photoMode])
}

function useReveal(dependencies = []) {
  useEffect(() => {
    const nodes = [...document.querySelectorAll('.reveal, .reveal-left, .reveal-right')]
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' })
    nodes.forEach((node, index) => {
      node.style.transitionDelay = `${Math.min((index % 4) * 55, 165)}ms`
      observer.observe(node)
    })
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}

function useScrollFx(paused) {
  useEffect(() => {
    const progress = document.querySelector('.scroll-progress')
    const header = document.querySelector('.site-header')
    const hero = document.querySelector('.hero-photo')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const update = () => {
      frame = 0
      const top = window.scrollY
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      if (header) header.classList.toggle('scrolled', top > 28)
      if (progress) progress.style.transform = `scaleX(${Math.min(1, top / total)})`
      if (hero && !reduce && !paused && top < window.innerHeight * 1.25) {
        hero.style.translate = `0 ${top * 0.075}px`
      }
    }
    const requestUpdate = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate, { passive: true })
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [paused])
}

function useMagnetic(paused) {
  useEffect(() => {
    if (paused || !window.matchMedia('(pointer:fine)').matches) return
    const items = [...document.querySelectorAll('.magnetic')]
    const cleanups = items.map((item) => {
      const move = (event) => {
        const rect = item.getBoundingClientRect()
        item.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * 0.1}px, ${(event.clientY - rect.top - rect.height / 2) * 0.1}px)`
      }
      const leave = () => { item.style.transform = '' }
      item.addEventListener('pointermove', move)
      item.addEventListener('pointerleave', leave)
      return () => { item.removeEventListener('pointermove', move); item.removeEventListener('pointerleave', leave); item.style.transform = '' }
    })
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [paused])
}

function usePointerGlow(paused) {
  useEffect(() => {
    const glow = document.querySelector('.cursor-glow')
    if (!glow || !window.matchMedia('(pointer:fine)').matches || paused) return
    const move = (event) => {
      glow.style.left = `${event.clientX}px`
      glow.style.top = `${event.clientY}px`
      glow.style.opacity = '1'
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [paused])
}

function ModalDialog({ open, onClose, className, labelledBy, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      {children}
    </dialog>
  )
}

function Countdown({ event }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const content = useMemo(() => {
    if (!event?.starts_at) {
      return { live: false, label: 'Nova data em breve', cells: [['--', 'dias'], ['--', 'horas'], ['--', 'min'], ['--', 'seg']] }
    }
    const start = new Date(event.starts_at).getTime()
    const end = event.ends_at ? new Date(event.ends_at).getTime() : start + 2.5 * 3600000
    const isLive = event.status === 'live' || (event.status === 'scheduled' && now >= start && now < end)
    if (event.status === 'cancelled') return { live: false, label: 'Encontro cancelado', cells: [['!', 'acompanhe'], ['OS', 'avisos']] }
    if (event.status === 'postponed') return { live: false, label: 'Encontro adiado', cells: [['NOVA', 'data'], ['EM', 'breve']] }
    if (isLive) {
      const finish = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(end))
      return { live: true, label: 'Acontecendo agora', cells: [['AO', 'vivo'], ['ATÉ', finish]] }
    }
    if (now >= end || event.status === 'completed') return { live: false, label: 'Encontro encerrado', cells: [['EM', 'breve'], ['NOVA', 'data']] }
    const difference = Math.max(0, start - now)
    const days = Math.floor(difference / 86400000)
    const hours = Math.floor((difference % 86400000) / 3600000)
    const minutes = Math.floor((difference % 3600000) / 60000)
    const seconds = Math.floor((difference % 60000) / 1000)
    return {
      live: false,
      label: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(start)).replace(',', ' •'),
      cells: [[String(days).padStart(2, '0'), 'dias'], [String(hours).padStart(2, '0'), 'horas'], [String(minutes).padStart(2, '0'), 'min'], [String(seconds).padStart(2, '0'), 'seg']]
    }
  }, [event, now])

  return (
    <div className={`next-meet countdown-premium${content.live ? ' live' : ''}`} aria-live="polite">
      <div className="countdown-copy"><small>Próxima quinta</small><strong>{content.label}</strong><em>Contagem em tempo real</em></div>
      <div className="countdown">{content.cells.map(([value, label]) => <span key={`${value}-${label}`}><b>{value}</b>{label}</span>)}</div>
    </div>
  )
}

function SponsorCarousel({ sponsors }) {
  const trackRef = useRef(null)
  const [paused, setPaused] = useState(false)

  const move = useCallback((direction = 1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('.sponsor-card')
    const distance = (card?.getBoundingClientRect().width || track.clientWidth * .84) + 18
    track.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (sponsors.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      const track = trackRef.current
      if (!track) return
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 32
      if (atEnd) track.scrollTo({ left: 0, behavior: 'smooth' })
      else move(1)
    }, 5600)
    return () => clearInterval(id)
  }, [move, paused, sponsors.length])

  if (!sponsors.length) return <p className="updates-empty gallery-state">Os patrocinadores oficiais serão anunciados aqui.</p>

  return <div className="sponsors-carousel-shell reveal">
    <div className="sponsors-carousel-note">
      <span>{sponsors.length} {sponsors.length === 1 ? 'parceiro oficial' : 'parceiros oficiais'}</span>
      <div className="sponsors-carousel-controls" aria-label="Controles do carrossel de patrocinadores">
        <button type="button" onClick={() => move(-1)} aria-label="Patrocinador anterior">←</button>
        <button type="button" onClick={() => move(1)} aria-label="Próximo patrocinador">→</button>
      </div>
    </div>
    <div
      ref={trackRef}
      className="sponsors-carousel"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {sponsors.map((item) => <article className={`sponsor-card reveal${item.featured ? ' featured' : ''}`} key={item.id}>
        <div className={`sponsor-media ${item.media_type || 'image'}`}>
          {item.publicUrl ? (item.media_type === 'video'
            ? <div className="sponsor-video-frame"><video src={item.publicUrl} controls playsInline preload="none" /></div>
            : <img src={item.publicUrl} alt={item.name || 'Patrocinador da Baixos Fronteira'} loading="lazy" decoding="async" />)
            : <div className="sponsor-media-placeholder"><img src="/assets/logo-baixos-fronteira.png" alt="" /></div>}
        </div>
        <div className="sponsor-body"><small>{item.featured ? '★ Patrocinador destaque' : 'Patrocinador oficial'}</small><h3>{item.name}</h3>{item.description ? <p>{item.description}</p> : null}<div className="sponsor-socials">{sponsorPrimarySocials(item).map(([label,url,display]) => <a href={url} target="_blank" rel="noopener noreferrer" key={`${item.id}-${label}`} onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:label,name:item.name}})}><b>{label}</b><span>{display} ↗</span></a>)}{item.youtube_url ? <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:'YouTube',name:item.name}})}><b>YouTube</b><span>Abrir canal ↗</span></a> : null}{item.facebook_url ? <a href={item.facebook_url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:'Facebook',name:item.name}})}><b>Facebook</b><span>Abrir página ↗</span></a> : null}{item.x_url ? <a href={item.x_url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:'X',name:item.name}})}><b>X / Twitter</b><span>Abrir perfil ↗</span></a> : null}{item.website_url ? <a href={item.website_url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:'Site',name:item.name}})}><b>Site</b><span>Abrir ↗</span></a> : null}{item.whatsapp_url ? <a href={item.whatsapp_url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('sponsor_click',{targetType:'sponsor',targetId:item.id,metadata:{network:'WhatsApp',name:item.name}})}><b>WhatsApp</b><span>Conversar ↗</span></a> : null}</div></div>
      </article>)}
    </div>
  </div>
}

export default function SiteClient() {
  const supabase = useMemo(() => getSupabase(), [])
  const [content, setContent] = useState(FALLBACK)
  const [events, setEvents] = useState([])
  const [notices, setNotices] = useState([])
  const [gallery, setGallery] = useState([])
  const [instagram, setInstagram] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [galleryError, setGalleryError] = useState('')
  const [dataReady, setDataReady] = useState(false)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [updatesTab, setUpdatesTab] = useState('events')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [socialTab, setSocialTab] = useState('instagram')
  const swipeStartRef = useRef(null)

  useEffect(() => { trackAnalytics('page_view', { targetType: 'page', targetId: 'home' }) }, [])

  const galleryStep = useCallback((direction) => {
    if (!selectedPhoto || !gallery.length) return
    const index = gallery.findIndex((item) => String(item.id) === String(selectedPhoto.id))
    const next = gallery[(index + direction + gallery.length) % gallery.length]
    if (next) { setSelectedPhoto(next); trackAnalytics('gallery_open',{targetType:'gallery',targetId:next.id,metadata:{media_type:next.media_type||'image',via:'navigation'}}) }
  }, [gallery, selectedPhoto])

  useEffect(() => {
    if (!selectedPhoto) return
    const key = (event) => { if (event.key === 'ArrowLeft') galleryStep(-1); if (event.key === 'ArrowRight') galleryStep(1) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [galleryStep, selectedPhoto])

  const modalOpen = updatesOpen || historyOpen || Boolean(selectedPhoto)
  useBodyLock(modalOpen, Boolean(selectedPhoto))
  useScrollFx(modalOpen)
  usePointerGlow(modalOpen)
  useMagnetic(modalOpen)
  useReveal([events.length, notices.length, gallery.length, instagram.length, sponsors.length])

  const refresh = useCallback(async () => {
    const now = Date.now()
    const tasks = await Promise.allSettled([
      supabase.from('events').select('*').eq('is_public', true).neq('status', 'draft').order('starts_at', { ascending: true }),
      supabase.from('announcements').select('*').eq('active', true).order('featured', { ascending: false }).order('priority', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('site_content').select('key,content').eq('is_public', true),
      supabase.from('gallery_items').select('*').eq('visible', true).order('featured', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('instagram_links').select('*').eq('visible', true).order('featured', { ascending: false }).order('sort_order', { ascending: true }).order('published_at', { ascending: false }),
      supabase.from('sponsors').select('*').eq('active', true).order('featured', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: false })
    ])

    const unwrap = (result, index) => {
      if (result.status === 'rejected') throw result.reason
      if (result.value.error) throw result.value.error
      return result.value.data || []
    }

    try {
      const rows = unwrap(tasks[0], 0)
      const expanded = expandRecurringEvents(rows, { now, maxOccurrences: 18 })
      setEvents(expanded.filter((item) => {
        const start = new Date(item.starts_at).getTime()
        const end = item.ends_at ? new Date(item.ends_at).getTime() : start
        if (item.status === 'cancelled') return start > now - 86400000
        return end > now && item.status !== 'completed'
      }).slice(0, 16))
    } catch (error) {
      console.error('[BF] Eventos:', error)
    }

    try {
      const rows = unwrap(tasks[1], 1)
      setNotices(rows.filter((item) => {
        const started = !item.starts_at || new Date(item.starts_at).getTime() <= now
        const notEnded = !item.ends_at || new Date(item.ends_at).getTime() > now
        return started && notEnded
      }).slice(0, 12))
    } catch (error) {
      console.error('[BF] Avisos:', error)
    }

    try {
      const rows = unwrap(tasks[2], 2)
      const loaded = Object.fromEntries(rows.map((row) => [row.key, row.content || {}]))
      setContent({
        hero: { ...FALLBACK.hero, ...(loaded.hero || {}) },
        story: { ...FALLBACK.story, ...(loaded.story || {}) },
        group: { ...FALLBACK.group, ...(loaded.group || {}) }
      })
    } catch (error) {
      console.error('[BF] Conteúdo:', error)
    }

    try {
      const rows = unwrap(tasks[3], 3)
      setGallery(rows.map((item) => ({ ...item, publicUrl: storagePublicUrl(item.storage_path) })))
      setGalleryError('')
    } catch (error) {
      console.error('[BF] Galeria:', error)
      setGalleryError('Não foi possível carregar a galeria agora.')
    }

    try {
      setInstagram(unwrap(tasks[4], 4))
    } catch (error) {
      console.error('[BF] Instagram:', error)
    }

    try {
      setSponsors(unwrap(tasks[5], 5).map((item) => ({ ...item, publicUrl: sponsorMediaPublicUrl(item.media_storage_path) })))
    } catch (error) {
      console.error('[BF] Patrocinadores:', error)
    }
    setDataReady(true)
  }, [supabase])

  useEffect(() => {
    refresh()
    let timer
    const channel = supabase.channel('public-site-react-v1')
    ;['events', 'announcements', 'gallery_items', 'site_content', 'instagram_links', 'sponsors'].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer)
        timer = setTimeout(refresh, 140)
      })
    })
    channel.subscribe()
    const poll = setInterval(() => { if (!document.hidden) refresh() }, 20000)
    const visible = () => { if (!document.hidden) refresh() }
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', visible)
      supabase.removeChannel(channel)
    }
  }, [refresh, supabase])

  const nextEvent = events[0] || null
  const event = nextEvent || EVENT_FALLBACK
  const timeRange = nextEvent ? formatTimeRange(nextEvent) : '19:30 — 22:00'
  const latestNotice = notices[0] || null
  const instagramUrl = content.group.instagram_url || FALLBACK.group.instagram_url
  const tiktokUrl = content.group.tiktok_url || FALLBACK.group.tiktok_url
  const threadsUrl = content.group.threads_url || FALLBACK.group.threads_url
  const socialHandle = content.group.instagram_handle || FALLBACK.group.instagram_handle
  const whatsappUrl = content.group.whatsapp_url || FALLBACK.group.whatsapp_url
  const socialNetworks = [
    { id: 'instagram', label: 'Instagram', url: instagramUrl, handle: socialHandle, metric: 'click_instagram', copy: 'Fotos, vídeos e avisos oficiais da Baixos Fronteira.' },
    { id: 'tiktok', label: 'TikTok', url: tiktokUrl, handle: content.group.tiktok_handle || socialHandle, metric: 'click_tiktok', copy: 'Vídeos curtos, carros e momentos dos encontros.' },
    { id: 'threads', label: 'Threads', url: threadsUrl, handle: content.group.threads_handle || socialHandle, metric: 'click_threads', copy: 'Atualizações rápidas e conversas da Baixos Fronteira.' }
  ]
  const activeSocial = socialNetworks.find(item => item.id === socialTab) || socialNetworks[0]

  const showPwaNotification = useCallback(async (title, body, url = '/e/quinta') => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      const registration = await navigator.serviceWorker?.ready
      if (registration) await registration.showNotification(title, { body, icon: '/icons/pwa-192.png', badge: '/icons/pwa-192.png', data: { url }, tag: 'baixos-fronteira-evento' })
      else new Notification(title, { body, icon: '/icons/pwa-192.png' })
    } catch (error) { console.warn('[BF] Notificação:', error) }
  }, [])

  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    const enabled = permission === 'granted'
    setNotificationsEnabled(enabled)
    localStorage.setItem('bf_notifications', enabled ? '1' : '0')
    if (enabled) await showPwaNotification('Baixos Fronteira', 'Notificações ativadas. Você receberá avisos importantes do encontro.')
  }, [showPwaNotification])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const enabled = 'Notification' in window && localStorage.getItem('bf_notifications') === '1' && Notification.permission === 'granted'
    setNotificationsEnabled(enabled)
  }, [])

  useEffect(() => {
    if (!nextEvent || !notificationsEnabled) return
    const signature = JSON.stringify({ id: nextEvent.source_id || nextEvent.id, at: nextEvent.starts_at, status: nextEvent.status, emergency: nextEvent.emergency_mode, message: nextEvent.emergency_message })
    const previous = localStorage.getItem('bf_event_signature')
    if (previous && previous !== signature) {
      const body = nextEvent.emergency_mode ? (nextEvent.emergency_message || 'Alteração importante no encontro.') : `Status atualizado: ${eventStatusLabel(nextEvent.status)}.`
      showPwaNotification(nextEvent.emergency_mode ? '⚠ Baixos Fronteira — emergência' : 'Baixos Fronteira — encontro atualizado', body)
    }
    localStorage.setItem('bf_event_signature', signature)
    const start = new Date(nextEvent.starts_at).getTime()
    const distance = start - Date.now()
    const reminderKey = `bf_reminder_${nextEvent.starts_at}`
    if (distance > 0 && distance <= 6 * 60 * 60 * 1000 && !localStorage.getItem(reminderKey)) {
      localStorage.setItem(reminderKey, '1')
      showPwaNotification('Hoje tem Baixos Fronteira', `Encontro às ${formatTimeRange(nextEvent)} no ${nextEvent.location_name || 'Posto Buffon'}. Som automotivo proibido.`)
    }
  }, [nextEvent, notificationsEnabled, showPwaNotification])

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />
      <div className="cursor-glow" aria-hidden="true" />

      <header className="site-header" id="top">
        <a className="brand" href="#top" aria-label="Baixos Fronteira — início">
          <img src="/assets/logo-baixos-fronteira.png" alt="" />
          <span>Baixos<br />Fronteira</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="/agenda">Agenda</a><a href="#evento">Eventos</a><a href="#avisos">Avisos</a><a href="#fotos">Galeria</a><a href="#patrocinadores">Patrocinadores</a><a href="#historia">História</a><a href="#redes">Redes</a>
        </nav>
        <a className="top-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_whatsapp',{targetType:'group',targetId:'header'})}><span className="live-dot" /> Entrar no grupo</a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-photo" aria-hidden="true" />
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero-lines" aria-hidden="true" />
          <div className="hero-center">
            <img className="hero-logo" src="/assets/logo-baixos-fronteira.png" alt="Logo oficial Baixos Fronteira Jaguarão RS" />
            <p className="location-tag"><span /> Jaguarão • RS</p>
            <h1 id="hero-title"><span className="graffiti-word" data-text="BAIXOS">BAIXOS</span><span className="frontier-word">FRONTEIRA</span></h1>
            <p className="hero-copy">{content.hero.tagline}</p>
            <a className="hero-updates" href="/agenda"><span className="live-dot" /> Agenda & avisos <i>↗</i></a>
            <div className="hero-social-tabs" aria-label="Redes sociais oficiais">{socialNetworks.map(item => <a key={`hero-${item.id}`} href={item.url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics(item.metric,{targetType:'social',targetId:`hero-${item.id}`})}><b>{item.label}</b><span>{item.handle} ↗</span></a>)}</div>
          </div>
          <div className="hero-stamp" aria-hidden="true">JAGUARÃO<br />RIO GRANDE DO SUL</div>
          <a className="scroll-down" href="#evento" aria-label="Ver próximo encontro"><span /> Descer</a>
        </section>

        <div className="ticker" aria-hidden="true"><div className="ticker-track">
          {[0, 1].map((copy) => <span className="ticker-copy" key={copy}><span>TODAS AS QUINTAS</span><i>✦</i><span>CARRO BAIXO</span><i>✦</i><span>RESPEITO AO LOCAL</span><i>✦</i><span>JAGUARÃO RS</span><i>✦</i></span>)}
        </div></div>

        <section className="updates-hub section" id="agenda" aria-labelledby="agenda-title">
          <div className="updates-hub-inner">
            <div className="updates-intro reveal-left"><p className="kicker">Central da equipe</p><h2 id="agenda-title">Agenda <span>& avisos.</span></h2><p>O que a equipe publica no painel aparece aqui automaticamente: próximos encontros, mudanças, comunicados e informações importantes.</p><a className="updates-open" href="/agenda">Ver agenda completa <span>↗</span></a></div>
            <div className="updates-preview reveal-right">
              {nextEvent ? <a className="update-preview event-preview preview-link" href={eventDetailUrl(nextEvent)}><div className="update-preview-top"><span>Próximo evento</span><b>{eventStatusLabel(nextEvent.status)}</b></div><strong>{formatDate(nextEvent.starts_at)}</strong><h3>{nextEvent.title || 'Baixos Fronteira'}</h3><p>{`${nextEvent.location_name || 'Local a confirmar'} • ${formatTimeRange(nextEvent)}`}</p><i>Ver detalhes ↗</i></a> : <article className="update-preview event-preview"><div className="update-preview-top"><span>Próximo evento</span><b>Agenda</b></div><strong>Nova data em breve</strong><h3>Baixos Fronteira</h3><p>Acompanhe a agenda oficial da equipe.</p></article>}
              <article className="update-preview notice-preview"><div className="update-preview-top"><span>Aviso da equipe</span><b>{notices.length} {notices.length === 1 ? 'ativo' : 'ativos'}</b></div><h3>{latestNotice?.title || 'Nenhum aviso no momento'}</h3><p>{latestNotice?.body || 'Quando a equipe publicar um comunicado, ele aparece aqui na hora.'}</p></article>
            </div>
          </div>
        </section>

        <section className="public-notices section" id="avisos" aria-labelledby="public-notices-title">
          <div className="dynamic-section-head reveal"><div><p className="kicker">Comunicados oficiais</p><h2 id="public-notices-title">Avisos da<br /><span>equipe.</span></h2></div><p>Informações publicadas no painel administrativo aparecem aqui automaticamente enquanto estiverem ativas.</p></div>
          <div className="public-notices-list">
            {!dataReady ? <div className="section-loading-row"><i/><i/><i/></div> : notices.length ? notices.map((item) => <article className={`public-notice-card ${item.tone || 'info'}${item.featured ? ' featured' : ''} reveal`} key={item.id}><div className="public-notice-top"><span>{item.featured ? '★ Aviso destacado' : noticeToneLabel(item.tone)}</span><b>Publicado pela equipe</b></div><h3>{item.title || 'Aviso'}</h3><p>{item.body || ''}</p></article>) : <p className="updates-empty">Nenhum aviso ativo no momento.</p>}
          </div>
        </section>

        <section className="event-section section" id="evento">
          <div className="event-background-word" aria-hidden="true">QUINTA</div>
          <div className="event-layout">
            <div className="event-copy reveal-left">
              <p className="kicker">{event.title || EVENT_FALLBACK.title}</p>
              <h2>Toda <span>quinta</span><br />a fronteira se encontra.</h2>
              <p className="event-lead">{event.description || EVENT_FALLBACK.description}</p>
              <Countdown event={nextEvent} />
              <div className="event-facts">
                <div className="fact"><small>Horário</small><strong>{timeRange}</strong></div>
                <div className="fact"><small>Local</small><strong>{event.location_name || EVENT_FALLBACK.location_name}</strong><span>{event.location_address || EVENT_FALLBACK.location_address}</span></div>
                <div className="fact warning"><small>Aviso da equipe</small><strong>{soundTitles[event.sound_policy] || soundTitles.check_updates}</strong><span>{event.sound_message || EVENT_FALLBACK.sound_message}</span></div>
              </div>
              {nextEvent?.emergency_mode && <div className="site-emergency-alert"><b>⚠ MODO EMERGÊNCIA</b><span>{nextEvent.emergency_message || 'Atenção: houve uma alteração importante neste encontro.'}</span></div>}
              <div className="event-actions-row">{nextEvent && <a className="event-details magnetic" href={eventDetailUrl(nextEvent)} onClick={()=>trackAnalytics('open_event',{targetType:'event',targetId:nextEvent.source_id||nextEvent.id})}>Ver encontro <span>↗</span></a>}<a className="event-whatsapp magnetic" href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_whatsapp',{targetType:'group',targetId:'event-section'})}>Entrar no grupo <span>↗</span></a><button type="button" className="event-notify magnetic" onClick={enableNotifications}>{notificationsEnabled ? 'Notificações ativas ✓' : 'Ativar notificações'}</button></div>
            </div>
            <a className="post-card reveal-right" href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Ver o Instagram da Baixos Fronteira"><div className="post-top"><div><img src="/assets/logo-baixos-fronteira.png" alt="" /><span><b>baixos_fronteira_jag</b><small>Post oficial</small></span></div><span>•••</span></div><div className="post-viewport"><img src="/assets/post-quintas-instagram.jpeg" alt="Post oficial do encontro da Baixos Fronteira" /></div><div className="post-bottom"><span>♡</span><span>◯</span><span>↗</span><b>Ver no Instagram</b></div></a>
          </div>
        </section>

        <section className="story section" id="historia">
          <div className="section-head reveal"><p className="kicker">Nossa história</p><h2>Da rua para uma<br /><span>família inteira.</span></h2><div className="story-side"><p>{content.story.lead}</p><button className="history-open" type="button" onClick={() => setHistoryOpen(true)}>Conhecer a história completa <span>＋</span></button></div></div>
          <div className="roadmap">
            {[['01','O início','Uma ideia entre amigos','Um ponto de encontro para quem vive carro baixo, projetos e a cena da fronteira.'],['02','Os encontros','A rua ganhou movimento','Mais carros, novas amizades e uma equipe cada vez mais presente em Jaguarão.'],['03','A comunidade','Respeito virou regra','Organização, segurança e cuidado com o local para o encontro continuar crescendo.'],['04','Hoje','Toda quinta tem Baixos','A fronteira se encontra, compartilha projetos e mantém a cultura viva.']].map(([n,s,t,p]) => <article className="road-item reveal" key={n}><span className="road-number">{n}</span><div><small>{s}</small><h3>{t}</h3><p>{p}</p></div></article>)}
          </div>
        </section>

        <section className="manifesto section"><div className="manifesto-mark" aria-hidden="true">BF</div><div className="manifesto-title reveal"><p className="kicker">Nosso jeito</p><h2>Baixo no chão.<br /><span>Alto no respeito.</span></h2></div><div className="values">{[['01','Cultura','Cada carro carrega identidade. Aqui, projeto diferente soma.'],['02','União','A resenha vira amizade e a amizade fortalece a equipe.'],['03','Respeito','Evento bom é organizado, seguro e consciente.']].map(([n,t,p]) => <article className="value reveal" key={n}><b>{n}</b><h3>{t}</h3><p>{p}</p></article>)}</div></section>

        <section className="track-section" id="pista" aria-labelledby="track-title"><div className="track-image" aria-hidden="true" /><div className="track-shade" aria-hidden="true" /><div className="track-scan" aria-hidden="true"><span /></div><div className="track-content reveal"><p className="kicker">Linha vermelha</p><h2 id="track-title">Cada quinta,<br /><span>uma nova volta.</span></h2><div className="track-panel"><div><small>Ponto de encontro</small><strong>{event.location_name || EVENT_FALLBACK.location_name}</strong></div><div><small>Janela da noite</small><strong>{timeRange}</strong></div><div><small>Direção</small><strong>Respeito sempre</strong></div></div></div><div className="track-index" aria-hidden="true">BF / 053</div></section>

        <section className="club-life section" id="galeria"><div className="club-head reveal"><p className="kicker">Toda quinta</p><h2>Mais que carros.<br /><span>Uma experiência.</span></h2><p>O encontro é feito de detalhes: chegar, rever a galera, conhecer projetos e fortalecer a cultura com responsabilidade.</p></div><div className="experience-grid">{[['19:30','Chegada','Os projetos ocupam seus lugares e a resenha começa com calma.','01'],['Conexão','Troca de ideias','Suspensão, rodas, estética e histórias de cada construção.','02'],['Conteúdo','Registros da noite','Fotos, vídeos e destaques que mantêm a cena viva no Instagram.','03'],['22:00','Encerramento','O local fica organizado e a próxima quinta já começa a ser esperada.','04']].map(([tag,title,text,n]) => <article className="experience-card reveal" key={n}><span>{tag}</span><b>{title}</b><p>{text}</p><i>{n}</i></article>)}</div></section>

        <section className="dynamic-gallery section" id="fotos">
          <div className="dynamic-section-head reveal"><div><p className="kicker">Galeria da equipe</p><h2>Registros da<br /><span>fronteira.</span></h2></div><p>Fotos e vídeos adicionados no painel aparecem aqui automaticamente, com carregamento otimizado e sem reiniciar o site.</p></div>
          <div className="dynamic-gallery-grid">
            {!dataReady ? <div className="section-loading-row gallery-loading"><i/><i/><i/></div> : galleryError ? <p className="updates-empty gallery-state">{galleryError}</p> : gallery.length ? gallery.map((item, index) => <button type="button" className={`dynamic-photo reveal${item.featured ? ' featured' : ''}${index === 0 ? ' exhibition-lead' : ''}${item.media_type === 'video' ? ' video-item' : ''}`} key={item.id} onClick={() => { setSelectedPhoto(item); trackAnalytics('gallery_open',{targetType:'gallery',targetId:item.id,metadata:{media_type:item.media_type||'image'}}) }}>{item.media_type === 'video' ? <div className="gallery-video-frame"><video src={item.publicUrl} muted playsInline preload="metadata" /><i>▶</i></div> : <img src={item.publicUrl} alt={item.alt_text || 'Foto da Baixos Fronteira'} loading="lazy" decoding="async" />}<span>{item.caption || 'Baixos Fronteira'}</span></button>) : <p className="updates-empty gallery-state">A galeria ainda não tem fotos públicas.</p>}
          </div>
        </section>

        <section className="sponsors-section section" id="patrocinadores">
          <div className="dynamic-section-head reveal"><div><p className="kicker">Quem fortalece a cena</p><h2>Nossos<br /><span>patrocinadores.</span></h2></div><p>Parceiros que apoiam a Baixos Fronteira e ajudam a manter a cultura automotiva viva.</p></div>
          {dataReady ? <SponsorCarousel sponsors={sponsors} /> : <div className="section-loading-row"><i/><i/><i/></div>}
        </section>

        <section className="instagram-section social-section section" id="redes">
          <div className="dynamic-section-head reveal"><div><p className="kicker">Redes oficiais</p><h2>A fronteira<br /><span>também é online.</span></h2></div><p>Siga a Baixos Fronteira nas três redes e acompanhe encontros, carros, avisos e bastidores.</p></div>
          <div className="social-tabs" role="tablist" aria-label="Redes sociais da Baixos Fronteira">{socialNetworks.map(item => <button key={`social-tab-${item.id}`} type="button" role="tab" aria-selected={socialTab===item.id} className={socialTab===item.id?'active':''} onClick={()=>setSocialTab(item.id)}><b>{item.label}</b><span>{item.handle}</span></button>)}</div>
          <div className="social-profile-panel reveal">
            <div className="social-profile-brand"><img src="/assets/logo-baixos-fronteira.png" alt="" /><div><small>BAIXOS FRONTEIRA • REDE OFICIAL</small><h3>{activeSocial.label}</h3><p>{activeSocial.copy}</p></div></div>
            <a className="social-profile-open" href={activeSocial.url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics(activeSocial.metric,{targetType:'social',targetId:`social-section-${activeSocial.id}`})}><span>{activeSocial.handle}</span><b>Abrir {activeSocial.label} ↗</b></a>
          </div>
          {socialTab === 'instagram' ? <div className="instagram-links-grid">
            {!dataReady ? <div className="section-loading-row"><i/><i/><i/></div> : instagram.length ? instagram.map((item) => <a className={`instagram-link-card reveal${item.image_url ? ' has-image' : ''}`} style={item.image_url ? { backgroundImage: `url(${item.image_url})` } : undefined} href={item.url} target="_blank" rel="noopener noreferrer" key={item.id} onClick={()=>trackAnalytics('click_instagram',{targetType:'instagram_post',targetId:item.id})}><small>{item.featured ? 'Destaque' : 'Instagram'}</small><h3>{item.title || 'Instagram'}</h3><p>{item.caption || 'Veja a publicação completa no Instagram.'}</p><span>Abrir publicação ↗</span></a>) : <p className="updates-empty gallery-state">Nenhuma publicação adicionada ainda.</p>}
          </div> : <div className="social-network-showcase">
            <article><small>{activeSocial.label}</small><h3>{activeSocial.handle}</h3><p>{activeSocial.copy}</p><a href={activeSocial.url} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics(activeSocial.metric,{targetType:'social',targetId:`social-card-${activeSocial.id}`})}>Seguir no {activeSocial.label} ↗</a></article>
            <div className={`social-network-mark ${activeSocial.id}`} aria-hidden="true">{activeSocial.label === 'Instagram' ? 'IG' : activeSocial.label === 'TikTok' ? 'TT' : 'TH'}</div>
          </div>}
        </section>

        <section className="code-section section"><div className="code-title reveal"><p className="kicker">Código da pista</p><h2>Atitude baixa.<br /><span>Consciência alta.</span></h2></div><div className="code-list">{[['01','Respeite o local','O espaço precisa ficar tão organizado quanto estava antes do encontro.'],['02','Som conforme aviso','A equipe informa no grupo e no Instagram quando o som estiver liberado ou proibido.'],['03','Sem manobras perigosas','Segurança vem antes de qualquer demonstração.'],['04','Projeto diferente soma','Original, baixo, antigo ou personalizado: respeito sempre.']].map(([n,t,p]) => <article className="code-item reveal" key={n}><strong>{n}</strong><div><h3>{t}</h3><p>{p}</p></div><span>↗</span></article>)}</div></section>
      </main>

      <footer className="site-footer"><div className="footer-spray" aria-hidden="true">BAIXOS</div><div className="footer-top"><div className="footer-brand-panel"><img src="/assets/logo-baixos-fronteira.png" alt="Baixos Fronteira Jaguarão RS" /><div><p>{content.group.footer_text}</p><div className="footer-meet-pill"><span>Toda quinta</span><b>19:30 — 22:00 • Posto Buffon</b></div></div></div><div className="footer-links-panel"><div><small>Navegação</small><a href="/agenda">Agenda completa ↗</a><a href="#fotos">Galeria</a><a href="#patrocinadores">Patrocinadores</a></div><div><small>Redes oficiais</small><a href={instagramUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_instagram',{targetType:'social',targetId:'footer'})}>Instagram ↗</a><a href={tiktokUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_tiktok',{targetType:'social',targetId:'footer'})}>TikTok ↗</a><a href={threadsUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_threads',{targetType:'social',targetId:'footer'})}>Threads ↗</a><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_whatsapp',{targetType:'group',targetId:'footer'})}>WhatsApp ↗</a></div><div><small>Patrocinadores</small>{sponsors.slice(0, 3).length ? sponsors.slice(0, 3).map((item) => <span key={`footer-sponsor-${item.id}`}>{item.name}</span>) : <span>Em breve</span>}</div></div></div><div className="footer-graffiti">Fronteira <span>vive.</span></div><div className="footer-bottom"><span>Jaguarão • Rio Grande do Sul</span><div><a href={instagramUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_instagram',{targetType:'social',targetId:'footer-bottom'})}>Instagram ↗</a><a href={tiktokUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_tiktok',{targetType:'social',targetId:'footer-bottom'})}>TikTok ↗</a><a href={threadsUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackAnalytics('click_threads',{targetType:'social',targetId:'footer-bottom'})}>Threads ↗</a></div><a href="#top">Voltar ao topo ↑</a></div></footer>

      <ModalDialog open={updatesOpen} onClose={() => setUpdatesOpen(false)} className="ios-modal updates-modal" labelledBy="updates-modal-title">
        <div className="modal-glow" aria-hidden="true" /><div className="modal-chrome"><span /><p>Central da Fronteira</p><button type="button" onClick={() => setUpdatesOpen(false)} aria-label="Fechar agenda e avisos">×</button></div>
        <div className="modal-scroll updates-modal-scroll"><div className="updates-modal-head"><div><p className="kicker">Atualizado pela equipe</p><h2 id="updates-modal-title">Agenda <span>& avisos.</span></h2></div><span className="updates-live"><i /> Ao vivo</span></div><div className="updates-tabs" role="tablist" aria-label="Agenda e avisos"><button className={updatesTab === 'events' ? 'active' : ''} type="button" role="tab" aria-selected={updatesTab === 'events'} onClick={() => setUpdatesTab('events')}>Próximos eventos <span>{events.length}</span></button><button className={updatesTab === 'notices' ? 'active' : ''} type="button" role="tab" aria-selected={updatesTab === 'notices'} onClick={() => setUpdatesTab('notices')}>Avisos <span>{notices.length}</span></button></div>
        <div className="updates-panel active" role="tabpanel"><div className="updates-list">{updatesTab === 'events' ? (events.length ? events.map((item) => <a href={eventDetailUrl(item)} className={`updates-event-card ${item.status || 'scheduled'}`} key={item.occurrence_id || item.id}><div className="updates-card-top"><span>{formatDate(item.starts_at)}</span><b>{eventStatusLabel(item.status)}</b></div><h3>{item.title || 'Encontro Baixos Fronteira'}</h3><p>{item.description || 'Encontro oficial da Baixos Fronteira.'}</p><div className="updates-card-meta"><span>⌖ {item.location_name || 'Local a confirmar'}</span><span>◷ {formatTimeRange(item)}</span></div></a>) : <p className="updates-empty">Nenhum próximo evento publicado pela equipe.</p>) : (notices.length ? notices.map((item) => <article className={`updates-notice-card ${item.tone || 'info'}${item.featured ? ' featured' : ''}`} key={item.id}><div className="updates-card-top"><span>Comunicado da equipe</span><b>{noticeToneLabel(item.tone)}</b></div><h3>{item.title || 'Aviso'}</h3><p>{item.body || ''}</p></article>) : <p className="updates-empty">Nenhum aviso ativo no momento.</p>)}</div></div>
        <div className="updates-modal-foot"><p>Alterações feitas pela equipe no painel administrativo são sincronizadas automaticamente.</p><a href={whatsappUrl} target="_blank" rel="noopener noreferrer">Entrar no grupo ↗</a></div></div>
      </ModalDialog>

      <ModalDialog open={historyOpen} onClose={() => setHistoryOpen(false)} className="ios-modal" labelledBy="history-modal-title">
        <div className="modal-glow" aria-hidden="true" /><div className="modal-chrome"><span /><p>Baixos Fronteira</p><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar história">×</button></div><div className="modal-scroll"><div className="modal-hero"><img src="/assets/logo-baixos-fronteira.png" alt="" /><p>Jaguarão • Rio Grande do Sul</p><h2 id="history-modal-title">Uma história<br />feita na <span>rua.</span></h2></div><p className="modal-intro">{content.story.modal_intro}</p><div className="modal-timeline">{[['01','O ponto de partida','Amigos e a mesma paixão','As conversas sobre carros viraram encontros. Cada projeto novo trouxe também uma nova amizade.'],['02','A identidade','A fronteira ganhou nome','Baixos Fronteira passou a representar uma cena local com estilo próprio e orgulho de Jaguarão.'],['03','A responsabilidade','Crescer sem perder o respeito','Organização, segurança e cuidado com o espaço se tornaram parte da cultura da equipe.'],['04','O presente','Uma história toda quinta','O encontro semanal mantém a comunidade próxima e abre espaço para novos projetos fazerem parte.']].map(([n,s,t,p]) => <article key={n}><b>{n}</b><div><small>{s}</small><h3>{t}</h3><p>{p}</p></div></article>)}</div><div className="modal-quote">“Quem chega com respeito,<br /><span>chega em casa.</span>”</div></div>
      </ModalDialog>

      <ModalDialog open={Boolean(selectedPhoto)} onClose={() => setSelectedPhoto(null)} className="photo-lightbox" labelledBy="photo-lightbox-caption">
        <button type="button" onClick={() => setSelectedPhoto(null)} aria-label="Fechar foto">×</button>
        {selectedPhoto ? <><div className="lightbox-media" onTouchStart={e=>{swipeStartRef.current=e.changedTouches?.[0]?.clientX??null}} onTouchEnd={e=>{const start=swipeStartRef.current;const end=e.changedTouches?.[0]?.clientX;if(start!=null&&end!=null&&Math.abs(end-start)>55)galleryStep(end<start?1:-1);swipeStartRef.current=null}}>{selectedPhoto.media_type === 'video' ? <div className="lightbox-video-frame"><video src={selectedPhoto.publicUrl} controls autoPlay playsInline preload="metadata" /></div> : <img src={selectedPhoto.publicUrl} alt={selectedPhoto.alt_text || 'Foto da Baixos Fronteira'} />} {gallery.length>1&&<><button type="button" className="lightbox-nav prev" onClick={()=>galleryStep(-1)} aria-label="Mídia anterior">←</button><button type="button" className="lightbox-nav next" onClick={()=>galleryStep(1)} aria-label="Próxima mídia">→</button></>}</div><p id="photo-lightbox-caption">{selectedPhoto.caption || selectedPhoto.alt_text || 'Baixos Fronteira'}</p></> : null}
      </ModalDialog>
    </>
  )
}
