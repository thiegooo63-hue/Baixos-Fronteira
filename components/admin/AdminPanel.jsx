'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { eventStatusLabel, expandRecurringEvents, isThursdayInSaoPaulo } from '../../lib/events'
import { compressImageFile } from '../../lib/client-image'

const supabase = getSupabase()

const AUTHORIZED_EMAIL = 'baixosfronteira@gmail.com'

const VIEWS = [
  ['dashboard', '⌁', 'Início'],
  ['agenda', '◷', 'Agenda'],
  ['gallery', '▧', 'Galeria'],
  ['sponsors', '★', 'Patrocinadores'],
  ['site', '✎', 'Site']
]

const BLANK_EVENT = { id: '', sponsor_ids: [], title: 'Encontro Baixos Fronteira', status: 'scheduled', starts_at: '', ends_at: '', location_name: 'Posto Buffon', location_address: '', description: '', sound_policy: 'check_updates', sound_message: 'A equipe informa no grupo e no Instagram.', is_public: true, featured: false, recurring_weekly: false, recurrence_weekday: 4, recurrence_until: '', locked_weekly: false, cover_storage_path: '', emergency_mode: false, emergency_message: '' }
const BLANK_NOTICE = { id: '', title: '', body: '', tone: 'info', priority: 10, active: true, featured: false, starts_at: '', ends_at: '' }
const BLANK_INSTAGRAM = { id: '', title: '', url: '', caption: '', image_url: '', published_at: '', sort_order: 0, featured: false, visible: true }
const BLANK_SPONSOR = { id: '', name: '', description: '', media_storage_path: '', media_type: 'image', social_handle: '', instagram_url: '', instagram_handle: '', tiktok_url: '', tiktok_handle: '', threads_url: '', threads_handle: '', youtube_url: '', facebook_url: '', x_url: '', website_url: '', whatsapp_url: '', sort_order: 0, featured: false, active: true }
const BLANK_CONTENT = { hero_tagline: '', story_lead: '', story_modal_intro: '', whatsapp_url: '', instagram_url: '', instagram_handle: '', tiktok_url: '', tiktok_handle: '', threads_url: '', threads_handle: '', footer_text: '' }

const toInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
const toIso = (value) => value ? new Date(value).toISOString() : null
const fmt = (value, withTime = true) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value)) : 'Sem data'
const friendlyError = (error) => {
  const message = error?.message || String(error || 'Erro inesperado.')
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme o e-mail recebido antes de entrar.',
    'User already registered': 'Este e-mail já possui cadastro. Use Entrar.',
    invite_not_found: 'Este e-mail não possui um convite ativo.',
    access_denied: 'Seu acesso à equipe está desativado.'
  }
  return map[message] || message
}
const roleName = (role) => role === 'administrator' ? 'Administrador' : 'Editor'
const cleanExternalUrl = (value) => { const raw=String(value||'').trim(); if(!raw) return null; try { const url=new URL(raw); return ['http:','https:'].includes(url.protocol) ? url.toString() : null } catch { return null } }
const noticeState = (notice) => {
  if (!notice.active) return ['Inativo', 'muted']
  const now = Date.now()
  if (notice.starts_at && new Date(notice.starts_at).getTime() > now) return ['Agendado', 'scheduled']
  if (notice.ends_at && new Date(notice.ends_at).getTime() <= now) return ['Encerrado', 'expired']
  return ['No site', 'live']
}
const sponsorHandle = (value) => String(value || '').trim().replace(/^@+/, '').replace(/\s+/g, '')
const sponsorSocialLinks = (value) => {
  const handle = sponsorHandle(value)
  if (!handle) return { handle: '', display: '', instagram: null, tiktok: null, threads: null }
  return {
    handle,
    display: `@${handle}`,
    instagram: `https://www.instagram.com/${handle}/`,
    tiktok: `https://www.tiktok.com/@${handle}`,
    threads: `https://www.threads.net/@${handle}`
  }
}

function Field({ label, children, help }) {
  return <label className="field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>
}
function Toggle({ checked, onChange, label }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><i></i><span>{label}</span></label>
}
function SectionTitle({ eyebrow, title, copy, action }) {
  return <div className="section-title"><div><p>{eyebrow}</p><h2>{title}</h2>{copy && <span>{copy}</span>}</div>{action}</div>
}

export default function AdminPanel() {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [authMessage, setAuthMessage] = useState('')
  const [view, setView] = useState('dashboard')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [events, setEvents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [gallery, setGallery] = useState([])
  const [instagram, setInstagram] = useState([])
  const [sponsors, setSponsors] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [eventForm, setEventForm] = useState(BLANK_EVENT)
  const [noticeForm, setNoticeForm] = useState(BLANK_NOTICE)
  const [noticeTiming, setNoticeTiming] = useState('now')
  const [instagramForm, setInstagramForm] = useState(BLANK_INSTAGRAM)
  const [sponsorForm, setSponsorForm] = useState(BLANK_SPONSOR)
  const [sponsorFile, setSponsorFile] = useState(null)
  const [sponsorPreview, setSponsorPreview] = useState('')
  const [contentForm, setContentForm] = useState(BLANK_CONTENT)
  const [photoEdit, setPhotoEdit] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoPreviewIsVideo, setPhotoPreviewIsVideo] = useState(false)
  const [coverPreview, setCoverPreview] = useState('')
  const [history, setHistory] = useState([])
  const [preview, setPreview] = useState(null)
  const realtimeRef = useRef(null)

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() })
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])
  useEffect(() => () => {
    if (sponsorPreview?.startsWith('blob:')) URL.revokeObjectURL(sponsorPreview)
  }, [sponsorPreview])

  const loadAll = useCallback(async (currentMember = member) => {
    const requests = [
      supabase.from('events').select('*').order('starts_at', { ascending: false }),
      supabase.from('announcements').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('gallery_items').select('*').order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('site_content').select('*'),
      supabase.from('instagram_links').select('*').order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('change_history').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('sponsors').select('*').order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }),
      supabase.from('site_analytics').select('*').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(1200)
    ]
    const results = await Promise.all(requests)
    const firstError = results.find(r => r.error)?.error
    if (firstError) throw firstError
    setEvents(results[0].data || [])
    setAnnouncements(results[1].data || [])
    setGallery(results[2].data || [])
    const content = Object.fromEntries((results[3].data || []).map(row => [row.key, row.content || {}]))
    setContentForm({
      hero_tagline: content.hero?.tagline || '', story_lead: content.story?.lead || '', story_modal_intro: content.story?.modal_intro || '',
      whatsapp_url: content.group?.whatsapp_url || '', instagram_url: content.group?.instagram_url || '', instagram_handle: content.group?.instagram_handle || '', tiktok_url: content.group?.tiktok_url || 'https://www.tiktok.com/@baixos_fronteira_jag', tiktok_handle: content.group?.tiktok_handle || '@baixos_fronteira_jag', threads_url: content.group?.threads_url || 'https://www.threads.com/@baixos_fronteira_jag', threads_handle: content.group?.threads_handle || '@baixos_fronteira_jag', footer_text: content.group?.footer_text || ''
    })
    setInstagram(results[4].data || [])
    setHistory(results[5].data || [])
    setSponsors(results[6].data || [])
    setAnalytics(results[7].data || [])
  }, [member])

  const boot = useCallback(async (nextSession) => {
    if (!nextSession?.user) { setSession(null); setMember(null); return }
    const signedEmail = String(nextSession.user.email || '').trim().toLowerCase()
    if (signedEmail !== AUTHORIZED_EMAIL) {
      await supabase.auth.signOut()
      setAuthMessage('Este e-mail não está autorizado a acessar o painel.')
      setSession(null); setMember(null)
      return
    }
    try {
      await supabase.rpc('claim_team_invite')
      const { data, error } = await supabase.from('team_members').select('*').eq('user_id', nextSession.user.id).maybeSingle()
      if (error) throw error
      if (!data?.active) throw new Error('access_denied')
      setSession(nextSession)
      setMember(data)
      await loadAll(data)
    } catch (error) {
      await supabase.auth.signOut()
      setAuthMessage(friendlyError(error))
      setSession(null); setMember(null)
    }
  }, [loadAll])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && boot(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') { setSession(null); setMember(null) }
      if (event === 'SIGNED_IN' && nextSession && !session) boot(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [boot])

  useEffect(() => {
    if (!member) return
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)
    let timer
    const channel = supabase.channel('admin-next-live')
    ;['events','announcements','gallery_items','site_content','instagram_links','change_history','sponsors'].forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer); timer = setTimeout(() => loadAll(member).catch(() => {}), 180)
      })
    })
    channel.subscribe()
    realtimeRef.current = channel
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [member, loadAll])

  async function handleAuth(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (!password) return
    setBusy(true); setAuthMessage('Conectando…')
    try {
      let result = await supabase.auth.signInWithPassword({ email: AUTHORIZED_EMAIL, password })
      if (result.error?.message === 'Invalid login credentials') {
        const created = await supabase.auth.signUp({
          email: AUTHORIZED_EMAIL,
          password,
          options: { data: { display_name: 'Baixos Fronteira' } }
        })
        if (created.error) throw created.error
        if (created.data.user && Array.isArray(created.data.user.identities) && created.data.user.identities.length === 0) {
          setAuthMessage('Senha incorreta.')
          return
        }
        if (created.data.session) {
          await boot(created.data.session)
          setAuthMessage('')
          return
        }
        setAuthMessage('Primeiro acesso criado. Confirme o e-mail recebido em baixosfronteira@gmail.com e depois entre novamente.')
        return
      }
      if (result.error) throw result.error
      await boot(result.data.session)
    } catch (error) { setAuthMessage(friendlyError(error)) }
    finally { setBusy(false) }
  }

  async function createBackup(entityType, entityId, operation, snapshot) {
    if (!session?.user || !member?.active) return null
    const { data, error } = await supabase.from('admin_backups').insert({
      user_id: session.user.id,
      actor_email: session.user.email || member.email || AUTHORIZED_EMAIL,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      operation,
      snapshot: snapshot || {}
    }).select('id').single()
    if (error) throw error
    return data?.id || null
  }

  async function logChange(action, entityType, entityId, summary, details = {}, backupId = null) {
    if (!session?.user || !member?.active) return
    const { error } = await supabase.from('change_history').insert({
      user_id: session.user.id,
      actor_email: session.user.email || member.email || AUTHORIZED_EMAIL,
      action,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      summary,
      details,
      backup_id: backupId
    })
    if (error) console.warn('[Baixos Fronteira] Histórico:', error.message)
  }

  async function undoHistory(item) {
    if (!item?.backup_id || item.undone_at) return
    if (!confirm(`Desfazer: ${item.summary}?`)) return
    setBusy(true)
    try {
      const { data: backup, error } = await supabase.from('admin_backups').select('*').eq('id', item.backup_id).single()
      if (error || !backup) throw error || new Error('Backup não encontrado.')
      const snapshot = backup.snapshot || {}
      const id = backup.entity_id

      if (backup.entity_type === 'event') {
        if (backup.operation === 'create') {
          const current = events.find(x => String(x.id) === String(id))
          if (current?.locked_weekly) throw new Error('O encontro oficial de quinta não pode ser removido.')
          const result = await supabase.from('events').delete().eq('id', id)
          if (result.error) throw result.error
        } else {
          const result = await supabase.from('events').upsert(snapshot)
          if (result.error) throw result.error
        }
      } else if (backup.entity_type === 'announcement') {
        const result = backup.operation === 'create'
          ? await supabase.from('announcements').delete().eq('id', id)
          : await supabase.from('announcements').upsert(snapshot)
        if (result.error) throw result.error
      } else if (backup.entity_type === 'gallery') {
        const result = backup.operation === 'create'
          ? await supabase.from('gallery_items').delete().eq('id', id)
          : await supabase.from('gallery_items').upsert(snapshot)
        if (result.error) throw result.error
      } else if (backup.entity_type === 'instagram') {
        const result = backup.operation === 'create'
          ? await supabase.from('instagram_links').delete().eq('id', id)
          : await supabase.from('instagram_links').upsert(snapshot)
        if (result.error) throw result.error
      } else if (backup.entity_type === 'sponsor') {
        const result = backup.operation === 'create'
          ? await supabase.from('sponsors').delete().eq('id', id)
          : await supabase.from('sponsors').upsert(snapshot)
        if (result.error) throw result.error
      } else if (backup.entity_type === 'site_content') {
        const rows = Array.isArray(snapshot.rows) ? snapshot.rows : []
        if (!rows.length) throw new Error('Backup de conteúdo vazio.')
        const result = await supabase.from('site_content').upsert(rows, { onConflict: 'key' })
        if (result.error) throw result.error
      } else {
        throw new Error('Este tipo de alteração ainda não pode ser desfeito.')
      }

      const mark = await supabase.from('change_history').update({ undone_at: new Date().toISOString(), undone_by: session.user.id }).eq('id', item.id)
      if (mark.error) throw mark.error
      await logChange('undo', backup.entity_type, id, `Desfez: ${item.summary}`, { history_id: item.id })
      notify('Alteração desfeita e restaurada pelo backup.')
      await loadAll(member)
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleEmergency() {
    const official = events.find(x => x.locked_weekly)
    if (!official) return notify('Encontro oficial não encontrado.', 'error')
    const activating = !official.emergency_mode
    const message = activating ? (prompt('Mensagem de emergência:', official.emergency_message || 'Atenção: houve uma alteração importante no encontro de quinta.') || '').trim() : ''
    if (activating && !message) return
    setBusy(true)
    try {
      const backupId = await createBackup('event', official.id, 'update', official)
      const { error } = await supabase.from('events').update({ emergency_mode: activating, emergency_message: message }).eq('id', official.id)
      if (error) throw error
      await logChange('update', 'event', official.id, activating ? 'Ativou o modo emergência da quinta' : 'Desativou o modo emergência da quinta', { emergency_mode: activating }, backupId)
      notify(activating ? 'Modo emergência ativado no site.' : 'Modo emergência desativado.')
      await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function saveEvent(event) {
    event.preventDefault()
    const locked = Boolean(eventForm.locked_weekly)
    if (!eventForm.starts_at || !eventForm.ends_at) return notify('Defina início e fim do evento.', 'error')
    if (new Date(eventForm.ends_at) <= new Date(eventForm.starts_at)) return notify('O fim precisa ser depois do início.', 'error')
    if (!locked && eventForm.recurring_weekly && !isThursdayInSaoPaulo(toIso(eventForm.starts_at))) return notify('Para “Toda quinta”, escolha uma quinta-feira como data inicial.', 'error')

    const existing = eventForm.id ? events.find(x => String(x.id) === String(eventForm.id)) : null
    const backupId = existing ? await createBackup('event', existing.id, 'update', existing) : null
    const payload = {
      ...eventForm,
      id: undefined,
      starts_at: toIso(eventForm.starts_at),
      ends_at: toIso(eventForm.ends_at),
      location_address: eventForm.location_address.trim() || null,
      recurrence_weekday: 4,
      recurrence_until: eventForm.recurring_weekly && eventForm.recurrence_until ? eventForm.recurrence_until : null
    }

    if (!locked) {
      payload.recurring_weekly = false
      payload.recurrence_weekday = 4
      payload.recurrence_until = null
    }

    if (locked) {
      Object.assign(payload, {
        title: 'Encontro Baixos Fronteira',
        location_name: 'Posto Buffon',
        location_address: 'Boca da Ponte',
        sound_policy: 'not_allowed',
        sound_message: 'Som automotivo proibido.',
        is_public: true,
        featured: true,
        recurring_weekly: true,
        recurrence_weekday: 4,
        recurrence_until: null,
        locked_weekly: true,
        starts_at: existing?.starts_at || payload.starts_at,
        ends_at: existing?.ends_at || payload.ends_at
      })
    }

    setBusy(true)
    try {
      const query = eventForm.id
        ? supabase.from('events').update(payload).eq('id', eventForm.id).select().single()
        : supabase.from('events').insert({ ...payload, created_by: session.user.id }).select().single()
      let { data, error } = await query
      if (error) throw error

      const coverInput = event.currentTarget.elements.namedItem('event_cover')
      const coverFile = coverInput?.files?.[0]
      if (coverFile && data?.id) {
        const compressed = await compressImageFile(coverFile, { maxWidth: 1800, maxHeight: 1200, quality: 0.84 })
        const path = `covers/${data.id}/${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}.webp`
        const upload = await supabase.storage.from('gallery').upload(path, compressed, { cacheControl: '3600', upsert: false, contentType: compressed.type })
        if (upload.error) throw upload.error
        const updated = await supabase.from('events').update({ cover_storage_path: path }).eq('id', data.id).select().single()
        if (updated.error) throw updated.error
        data = updated.data
        setCoverPreview('')
      }

      const finalBackupId = eventForm.id ? backupId : await createBackup('event', data.id, 'create', data)
      await logChange(eventForm.id ? 'update' : 'create', 'event', data?.id || eventForm.id, `${eventForm.id ? 'Atualizou' : 'Criou'} o evento “${payload.title}”`, { status: payload.status, locked_weekly: locked }, finalBackupId)
      notify(locked ? 'Encontro oficial atualizado. Horário, local e som continuam protegidos.' : 'Evento salvo e sincronizado com o site.')
      await loadAll(member)
      if (data?.id) setEventForm({ ...data, starts_at: toInput(data.starts_at), ends_at: toInput(data.ends_at) })
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function deleteEvent(id) {
    const item = events.find(x => x.id === id)
    if (item?.locked_weekly) return notify('O encontro oficial de quinta é protegido e não pode ser excluído.', 'error')
    if (!confirm('Excluir este evento?')) return
    try {
      const backupId = await createBackup('event', id, 'delete', item)
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
      await logChange('delete', 'event', id, `Excluiu o evento “${item?.title || id}”`, {}, backupId)
      notify('Evento excluído. Você pode desfazer pelo Histórico.'); setEventForm(BLANK_EVENT); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
  }

  function resetNotice() {
    setNoticeForm({ ...BLANK_NOTICE })
    setNoticeTiming('now')
  }

  function editNotice(item) {
    setNoticeForm({ ...item, starts_at: toInput(item.starts_at), ends_at: toInput(item.ends_at) })
    setNoticeTiming(item.starts_at || item.ends_at ? 'schedule' : 'now')
  }

  async function saveNotice(event) {
    event.preventDefault()
    if (!noticeForm.title.trim() || !noticeForm.body.trim()) return notify('Título e mensagem são obrigatórios.', 'error')
    if (noticeTiming === 'schedule' && !noticeForm.starts_at) return notify('Escolha quando o aviso deve começar.', 'error')
    if (noticeTiming === 'schedule' && noticeForm.ends_at && new Date(noticeForm.ends_at) <= new Date(noticeForm.starts_at)) return notify('A data de encerramento precisa ser depois do início.', 'error')

    const payload = {
      title: noticeForm.title.trim(), body: noticeForm.body.trim(), tone: noticeForm.tone,
      priority: Number(noticeForm.priority) || 0, active: Boolean(noticeForm.active), featured: Boolean(noticeForm.featured),
      starts_at: noticeTiming === 'schedule' ? toIso(noticeForm.starts_at) : null,
      ends_at: noticeTiming === 'schedule' ? toIso(noticeForm.ends_at) : null
    }

    setBusy(true)
    try {
      const existing = noticeForm.id ? announcements.find(x => String(x.id) === String(noticeForm.id)) : null
      const backupId = existing ? await createBackup('announcement', existing.id, 'update', existing) : null
      const query = noticeForm.id
        ? supabase.from('announcements').update(payload).eq('id', noticeForm.id).select().single()
        : supabase.from('announcements').insert({ ...payload, created_by: session.user.id }).select().single()
      const { data, error } = await query
      if (error) throw error
      if (!data) throw new Error('O banco não confirmou a gravação do aviso.')
      const finalBackupId = noticeForm.id ? backupId : await createBackup('announcement', data.id, 'create', data)
      await logChange(noticeForm.id ? 'update' : 'create', 'announcement', data.id, `${noticeForm.id ? 'Atualizou' : 'Publicou'} o aviso “${payload.title}”`, { featured: payload.featured, tone: payload.tone }, finalBackupId)
      notify(noticeForm.id ? 'Aviso atualizado no site.' : noticeTiming === 'schedule' ? 'Aviso agendado com sucesso.' : 'Aviso publicado no site agora.')
      resetNotice(); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function deleteNotice(id) {
    if (!confirm('Excluir este aviso?')) return
    const item = announcements.find(x => x.id === id)
    try {
      const backupId = await createBackup('announcement', id, 'delete', item)
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
      await logChange('delete', 'announcement', id, `Excluiu o aviso “${item?.title || id}”`, {}, backupId)
      notify('Aviso excluído. Você pode desfazer pelo Histórico.'); resetNotice(); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
  }

  async function uploadPhoto(event) {
    event.preventDefault()
    const form = event.currentTarget
    const mediaInput = form.elements.namedItem('image')
    const file = mediaInput?.files?.[0]
    const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
    if (!file) return notify('Escolha uma foto ou vídeo.', 'error')
    const isVideo = videoTypes.has(file.type)
    if (!imageTypes.has(file.type) && !isVideo) return notify('Use JPG, PNG, WEBP, GIF, MP4, WEBM ou MOV.', 'error')
    if (file.size > 50 * 1024 * 1024) return notify('O arquivo precisa ter no máximo 50 MB.', 'error')

    const formData = new FormData(form)
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setBusy(true)
    try {
      const optimized = isVideo ? file : await compressImageFile(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 })
      const originalExt = file.name?.split('.').pop()?.toLowerCase() || ''
      const ext = isVideo ? (originalExt || (file.type === 'video/webm' ? 'webm' : 'mp4')) : (optimized.type === 'image/gif' ? 'gif' : 'webp')
      const path = `${session.user.id}/${Date.now()}-${token}.${ext}`
      const upload = await supabase.storage.from('gallery').upload(path, optimized, { cacheControl: '3600', upsert: false, contentType: optimized.type || file.type })
      if (upload.error) throw upload.error

      const { data, error } = await supabase.from('gallery_items').insert({
        storage_path: path,
        media_type: isVideo ? 'video' : 'image',
        caption: String(formData.get('caption') || '').trim(),
        alt_text: String(formData.get('alt_text') || '').trim() || (isVideo ? 'Vídeo da Baixos Fronteira' : 'Foto da Baixos Fronteira'),
        sort_order: Number(formData.get('sort_order')) || 0,
        featured: formData.get('featured') === 'on', visible: formData.get('visible') === 'on', created_by: session.user.id
      }).select().single()
      if (error) { await supabase.storage.from('gallery').remove([path]); throw error }
      const backupId = await createBackup('gallery', data.id, 'create', data)
      await logChange('create', 'gallery', data.id, `Publicou ${isVideo ? 'um vídeo' : 'uma foto'} na galeria`, { caption: data.caption, original_bytes: file.size, optimized_bytes: optimized.size, media_type: data.media_type }, backupId)
      form.reset(); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(''); setPhotoPreviewIsVideo(false)
      const saved = !isVideo && file.size > 0 ? Math.max(0, Math.round((1 - optimized.size / file.size) * 100)) : 0
      notify(isVideo ? 'Vídeo publicado na Galeria.' : saved > 0 ? `Foto publicada e comprimida (${saved}% menor).` : 'Foto publicada na Galeria.')
      await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function patchPhoto(item, changes, { quiet = false } = {}) {
    try {
      const backupId = await createBackup('gallery', item.id, 'update', item)
      const { error } = await supabase.from('gallery_items').update(changes).eq('id', item.id)
      if (error) throw error
      await logChange('update', 'gallery', item.id, `Atualizou a foto “${item.caption || item.id}”`, changes, backupId)
      if (!quiet) notify('Foto atualizada.')
      await loadAll(member)
      return true
    } catch (error) { notify(friendlyError(error), 'error'); return false }
  }

  async function deletePhoto(item) {
    if (!confirm('Excluir esta foto da galeria? Ela poderá ser restaurada pelo Histórico.')) return
    setBusy(true)
    try {
      const backupId = await createBackup('gallery', item.id, 'delete', item)
      const { error } = await supabase.from('gallery_items').delete().eq('id', item.id)
      if (error) throw error
      if (photoEdit?.id === item.id) setPhotoEdit(null)
      await logChange('delete', 'gallery', item.id, `Excluiu a foto “${item.caption || item.id}”`, { storage_path: item.storage_path }, backupId)
      notify('Foto removida do site. O arquivo foi preservado para permitir Desfazer.')
      await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function savePhotoEdit(event) {
    event.preventDefault()
    if (!photoEdit) return
    const ok = await patchPhoto(photoEdit, { caption: photoEdit.caption.trim(), alt_text: photoEdit.alt_text.trim() || 'Foto da Baixos Fronteira', sort_order: Number(photoEdit.sort_order) || 0, featured: photoEdit.featured, visible: photoEdit.visible })
    if (ok) setPhotoEdit(null)
  }

  async function saveContent(event) {
    event.preventDefault()
    const { data: previousRows, error: previousError } = await supabase.from('site_content').select('*')
    if (previousError) return notify(friendlyError(previousError), 'error')
    const rows = [
      { key: 'hero', label: 'Capa do site', content: { tagline: contentForm.hero_tagline.trim() }, is_public: true, updated_by: session.user.id },
      { key: 'story', label: 'História', content: { lead: contentForm.story_lead.trim(), modal_intro: contentForm.story_modal_intro.trim() }, is_public: true, updated_by: session.user.id },
      { key: 'group', label: 'Informações do grupo', content: { whatsapp_url: contentForm.whatsapp_url.trim(), instagram_url: contentForm.instagram_url.trim(), instagram_handle: contentForm.instagram_handle.trim(), tiktok_url: contentForm.tiktok_url.trim(), tiktok_handle: contentForm.tiktok_handle.trim(), threads_url: contentForm.threads_url.trim(), threads_handle: contentForm.threads_handle.trim(), footer_text: contentForm.footer_text.trim() }, is_public: true, updated_by: session.user.id }
    ]
    setBusy(true)
    try {
      const backupId = await createBackup('site_content', 'site', 'update', { rows: previousRows || [] })
      const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'key' })
      if (error) throw error
      await logChange('update', 'site_content', 'site', 'Atualizou os textos e links do site', {}, backupId)
      notify('Conteúdo atualizado no site.'); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
    finally { setBusy(false) }
  }

  async function saveInstagram(event) {
    event.preventDefault()
    const safeInstagramUrl = cleanExternalUrl(instagramForm.url); if (!safeInstagramUrl) return notify('Use um link http:// ou https:// válido para a publicação.', 'error')
    const safeImageUrl = String(instagramForm.image_url||'').trim() ? cleanExternalUrl(instagramForm.image_url) : null; if (String(instagramForm.image_url||'').trim() && !safeImageUrl) return notify('A imagem de capa precisa usar http:// ou https://.', 'error')
    const payload = { title: instagramForm.title.trim(), url: safeInstagramUrl, caption: instagramForm.caption.trim(), image_url: safeImageUrl, published_at: toIso(instagramForm.published_at), sort_order: Number(instagramForm.sort_order) || 0, featured: instagramForm.featured, visible: instagramForm.visible }
    try {
      const existing = instagramForm.id ? instagram.find(x => String(x.id) === String(instagramForm.id)) : null
      const backupId = existing ? await createBackup('instagram', existing.id, 'update', existing) : null
      const query = instagramForm.id
        ? supabase.from('instagram_links').update(payload).eq('id', instagramForm.id).select().single()
        : supabase.from('instagram_links').insert({ ...payload, created_by: session.user.id }).select().single()
      const { data, error } = await query
      if (error) throw error
      const finalBackupId = instagramForm.id ? backupId : await createBackup('instagram', data.id, 'create', data)
      await logChange(instagramForm.id ? 'update' : 'create', 'instagram', data?.id || instagramForm.id, `${instagramForm.id ? 'Atualizou' : 'Adicionou'} o link “${payload.title}”`, {}, finalBackupId)
      notify('Publicação do Instagram salva.'); setInstagramForm(BLANK_INSTAGRAM); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
  }

  async function deleteInstagram(id) {
    if (!confirm('Excluir este link?')) return
    const item = instagram.find(x => x.id === id)
    try {
      const backupId = await createBackup('instagram', id, 'delete', item)
      const { error } = await supabase.from('instagram_links').delete().eq('id', id)
      if (error) throw error
      await logChange('delete', 'instagram', id, `Excluiu o link “${item?.title || id}”`, {}, backupId)
      notify('Link excluído. Você pode desfazer pelo Histórico.'); setInstagramForm(BLANK_INSTAGRAM); await loadAll(member)
    } catch (error) { notify(friendlyError(error), 'error') }
  }


  const sponsorMediaUrl = useCallback((path) => {
    if (!path) return ''
    return supabase.storage.from('sponsor-media').getPublicUrl(path).data.publicUrl || ''
  }, [])

  function resetSponsor() {
    if (sponsorPreview?.startsWith('blob:')) URL.revokeObjectURL(sponsorPreview)
    setSponsorForm({ ...BLANK_SPONSOR })
    setSponsorFile(null)
    setSponsorPreview('')
  }

  function editSponsor(item) {
    if (sponsorPreview?.startsWith('blob:')) URL.revokeObjectURL(sponsorPreview)
    const recoveredHandle = sponsorHandle(item.social_handle || item.instagram_handle || item.tiktok_handle || item.threads_handle)
    setSponsorForm({ ...BLANK_SPONSOR, ...item, social_handle: recoveredHandle })
    setSponsorFile(null)
    setSponsorPreview(item.media_storage_path ? sponsorMediaUrl(item.media_storage_path) : '')
  }

  function pickSponsorMedia(file) {
    if (sponsorPreview?.startsWith('blob:')) URL.revokeObjectURL(sponsorPreview)
    if (!file) {
      setSponsorFile(null)
      setSponsorPreview(sponsorForm.media_storage_path ? sponsorMediaUrl(sponsorForm.media_storage_path) : '')
      return
    }
    const isImage = file.type?.startsWith('image/')
    const isVideo = file.type?.startsWith('video/')
    if (!isImage && !isVideo) {
      notify('Escolha uma foto ou vídeo compatível.', 'error')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      notify('O arquivo do patrocinador precisa ter no máximo 50 MB.', 'error')
      return
    }
    setSponsorFile(file)
    setSponsorForm(current => ({ ...current, media_type: isVideo ? 'video' : 'image' }))
    setSponsorPreview(URL.createObjectURL(file))
  }

  async function saveSponsor(event) {
    event.preventDefault()
    const name = sponsorForm.name.trim()
    if (!name) return notify('Informe o nome do patrocinador.', 'error')
    setBusy(true)
    try {
      const existing = sponsorForm.id ? sponsors.find(x => String(x.id) === String(sponsorForm.id)) : null
      const backupId = existing ? await createBackup('sponsor', existing.id, 'update', existing) : null
      let mediaPath = sponsorForm.media_storage_path || null
      let mediaType = sponsorForm.media_type || 'image'

      if (sponsorFile) {
        const isImage = sponsorFile.type?.startsWith('image/')
        const uploadFile = isImage
          ? await compressImageFile(sponsorFile, { maxWidth: 1800, maxHeight: 1400, quality: 0.84 })
          : sponsorFile
        mediaType = isImage ? 'image' : 'video'
        const originalExt = sponsorFile.name?.split('.').pop()?.toLowerCase() || ''
        const ext = isImage ? (uploadFile.type === 'image/gif' ? 'gif' : 'webp') : (originalExt || (uploadFile.type === 'video/webm' ? 'webm' : 'mp4'))
        const token = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
        const path = `${session.user.id}/${Date.now()}-${token}.${ext}`
        const upload = await supabase.storage.from('sponsor-media').upload(path, uploadFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadFile.type || sponsorFile.type
        })
        if (upload.error) throw upload.error
        mediaPath = path
      }

      const social = sponsorSocialLinks(sponsorForm.social_handle)
      for (const [label, raw] of [['YouTube',sponsorForm.youtube_url],['Facebook',sponsorForm.facebook_url],['X/Twitter',sponsorForm.x_url],['Site',sponsorForm.website_url],['WhatsApp',sponsorForm.whatsapp_url]]) { if (String(raw||'').trim() && !cleanExternalUrl(raw)) throw new Error(`${label}: use um link http:// ou https:// válido.`) }
      const payload = {
        name,
        description: sponsorForm.description.trim(),
        media_storage_path: mediaPath,
        media_type: mediaType,
        social_handle: social.handle || null,
        instagram_url: social.instagram,
        instagram_handle: social.display || null,
        tiktok_url: social.tiktok,
        tiktok_handle: social.display || null,
        threads_url: social.threads,
        threads_handle: social.display || null,
        youtube_url: cleanExternalUrl(sponsorForm.youtube_url),
        facebook_url: cleanExternalUrl(sponsorForm.facebook_url),
        x_url: cleanExternalUrl(sponsorForm.x_url),
        website_url: cleanExternalUrl(sponsorForm.website_url),
        whatsapp_url: cleanExternalUrl(sponsorForm.whatsapp_url),
        sort_order: Number(sponsorForm.sort_order) || 0,
        featured: Boolean(sponsorForm.featured),
        active: Boolean(sponsorForm.active),
        updated_at: new Date().toISOString()
      }
      const query = sponsorForm.id
        ? supabase.from('sponsors').update(payload).eq('id', sponsorForm.id).select().single()
        : supabase.from('sponsors').insert({ ...payload, created_by: session.user.id }).select().single()
      const { data, error } = await query
      if (error) throw error

      const finalBackupId = sponsorForm.id ? backupId : await createBackup('sponsor', data.id, 'create', data)
      await logChange(sponsorForm.id ? 'update' : 'create', 'sponsor', data.id, `${sponsorForm.id ? 'Atualizou' : 'Adicionou'} o patrocinador “${name}”`, { media_type: mediaType, featured: payload.featured, active: payload.active }, finalBackupId)
      notify('Patrocinador salvo e sincronizado com o site.')
      resetSponsor()
      await loadAll(member)
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSponsor(item) {
    if (!confirm(`Excluir o patrocinador “${item.name}”? O arquivo será preservado para permitir Desfazer.`)) return
    setBusy(true)
    try {
      const backupId = await createBackup('sponsor', item.id, 'delete', item)
      const { error } = await supabase.from('sponsors').delete().eq('id', item.id)
      if (error) throw error
      await logChange('delete', 'sponsor', item.id, `Excluiu o patrocinador “${item.name}”`, { media_storage_path: item.media_storage_path }, backupId)
      if (String(sponsorForm.id) === String(item.id)) resetSponsor()
      notify('Patrocinador removido. Você pode desfazer pelo Histórico.')
      await loadAll(member)
    } catch (error) {
      notify(friendlyError(error), 'error')
    } finally {
      setBusy(false)
    }
  }


  const upcoming = useMemo(() => expandRecurringEvents(events, { now: Date.now(), maxOccurrences: 8 }).filter(x => new Date(x.ends_at).getTime() > Date.now() && !['draft','completed','cancelled'].includes(x.status))[0], [events])
  const liveNotices = useMemo(() => announcements.filter(x => noticeState(x)[1] === 'live'), [announcements])
  const analyticsSummary = useMemo(() => { const count=(type)=>analytics.filter(x=>x.event_type===type).length; const sponsorClicks=analytics.filter(x=>x.event_type==='sponsor_click').reduce((acc,x)=>{const key=String(x.target_id||'');acc[key]=(acc[key]||0)+1;return acc},{}); const topSponsor=sponsors.map(x=>({...x,clicks:sponsorClicks[String(x.id)]||0})).sort((a,b)=>b.clicks-a.clicks)[0]; return { views:count('page_view'), instagram:count('click_instagram'), tiktok:count('click_tiktok'), threads:count('click_threads'), whatsapp:count('click_whatsapp'), maps:count('click_map'), shares:count('event_share'), sponsorClicks:count('sponsor_click'), topSponsor } }, [analytics, sponsors])
  const sponsorMetrics = useMemo(() => analytics.filter(x=>x.event_type==='sponsor_click').reduce((acc,x)=>{const key=String(x.target_id||'');acc[key]=(acc[key]||0)+1;return acc},{}), [analytics])

  if (!member) {
    return <div className="admin-root auth-root">
      <div className="ambient"></div>
      <a className="back-link" href="/">← Voltar ao site</a>
      <section className="auth-card glass">
        <img src="/assets/logo-baixos-fronteira.png" alt="Baixos Fronteira" />
        <p className="eyebrow">Área da equipe</p>
        <h1>Painel<br/><span>Fronteira.</span></h1>
        <p className="auth-copy">Painel simplificado para atualizar agenda, avisos, fotos, patrocinadores e informações do site.</p>
        <div className="authorized-account"><small>CONTA AUTORIZADA</small><strong>{AUTHORIZED_EMAIL}</strong></div>
        <form onSubmit={handleAuth}>
          <Field label="Senha"><input name="password" type="password" minLength="6" autoComplete="current-password" required autoFocus /></Field>
          <button className="primary wide" disabled={busy}>{busy ? 'Conectando…' : 'Entrar no painel ↗'}</button>
        </form>
        {authMessage && <p className="auth-message">{authMessage}</p>}
      </section>
    </div>
  }

  const displayName = member.display_name || member.email?.split('@')[0] || 'Equipe'

  return <div className="admin-root">
    <div className="admin-shell">
      <aside className="sidebar glass">
        <a className="brand" href="/"><img src="/assets/logo-baixos-fronteira.png" alt=""/><span>Baixos<br/>Fronteira</span></a>
        <nav>{VIEWS.map(([key, icon, label]) => <button key={key} className={view===key?'active':''} onClick={()=>setView(key)}><i>{icon}</i><span>{label}</span></button>)}</nav>
        <div className="profile"><b>{displayName.slice(0,2).toUpperCase()}</b><div><strong>{displayName}</strong><small>{roleName(member.role)}</small></div></div>
        <button className="logout" onClick={async()=>{await supabase.auth.signOut(); location.reload()}}>Sair</button>
      </aside>

      <main className="admin-main">
        <header className="topbar"><div><p>PAINEL NEXT.JS</p><h1>{VIEWS.find(x=>x[0]===view)?.[2]}</h1></div><div className="top-actions"><span className={busy?'sync busy':'sync'}><i></i>{busy?'Salvando…':'Sincronizado'}</span><a href="/" target="_blank">Ver site ↗</a></div></header>

        {view === 'dashboard' && <section className="view-panel">
          <div className="hero-admin glass"><div><p className="eyebrow">Baixos Fronteira • Jaguarão</p><h2>Agora cada coisa<br/><span>no seu lugar.</span></h2><p>A V10 reúne Agenda, Galeria, Patrocinadores e Site em um único painel. Tudo sincroniza automaticamente com a página pública.</p></div><span className="live-badge">AO VIVO</span></div>
          <div className="stats v10-stats"><article><small>Próximo evento</small><b>{upcoming ? fmt(upcoming.starts_at, false) : 'A definir'}</b><span>{upcoming?.location_name || 'Nenhum agendado'}</span></article><article><small>Visitas • 30 dias</small><b>{analyticsSummary.views}</b><span>{analytics.length} interações registradas</span></article><article><small>Mídias públicas</small><b>{gallery.filter(x=>x.visible).length}</b><span>{gallery.filter(x=>x.media_type==='video').length} vídeos • {gallery.filter(x=>x.media_type!=='video').length} fotos</span></article><article><small>Patrocinadores</small><b>{sponsors.filter(x=>x.active).length}</b><span>{analyticsSummary.sponsorClicks} cliques • 30 dias</span></article></div><div className="analytics-strip card"><div><small>Instagram</small><b>{analyticsSummary.instagram}</b></div><div><small>TikTok</small><b>{analyticsSummary.tiktok}</b></div><div><small>Threads</small><b>{analyticsSummary.threads}</b></div><div><small>WhatsApp</small><b>{analyticsSummary.whatsapp}</b></div><div><small>Mapa</small><b>{analyticsSummary.maps}</b></div><div><small>Compartilhamentos</small><b>{analyticsSummary.shares}</b></div><div><small>Patrocinador + acessado</small><b>{analyticsSummary.topSponsor?.name || '—'}</b><span>{analyticsSummary.topSponsor?.clicks || 0} cliques</span></div></div>
          <div className="quick-actions"><button onClick={()=>setView('agenda')}><b>◷ Abrir agenda</b><span>Eventos e avisos →</span></button><button onClick={()=>setView('gallery')}><b>▧ Adicionar foto</b><span>Galeria pública →</span></button><button onClick={()=>setView('sponsors')}><b>★ Patrocinadores</b><span>Parceiros e redes →</span></button><button onClick={()=>setView('site')}><b>✎ Editar site</b><span>Textos e Instagram →</span></button></div><div className={`emergency-admin ${events.find(x=>x.locked_weekly)?.emergency_mode?'active':''}`}><div><b>⚠ Modo emergência</b><span>{events.find(x=>x.locked_weekly)?.emergency_mode ? (events.find(x=>x.locked_weekly)?.emergency_message || 'Ativo no site') : 'Use apenas para cancelamento, mudança urgente ou aviso crítico da quinta.'}</span></div><button type="button" onClick={toggleEmergency}>{events.find(x=>x.locked_weekly)?.emergency_mode?'Desativar emergência':'Ativar emergência'}</button></div>
          <div className="history-card card"><div className="list-head"><div><b>Histórico de alterações</b><span>Backup automático antes de editar ou excluir</span></div><em>{history.length}</em></div><div className="history-list">{history.length ? history.slice(0,12).map(item=><article key={item.id}><span className={`history-icon ${item.action}`}>{item.action==='delete'?'−':item.action==='create'?'+':item.action==='undo'?'↶':'↻'}</span><div><b>{item.summary}</b><small>{item.actor_email || 'Equipe'} • {fmt(item.created_at)}{item.undone_at?' • DESFEITO':''}</small></div>{item.backup_id && !item.undone_at && item.action!=='undo' ? <button type="button" className="undo-btn" onClick={()=>undoHistory(item)}>Desfazer</button> : null}</article>) : <p className="empty">O histórico começa a ser registrado a partir desta versão.</p>}</div></div>
        </section>}

        {view === 'agenda' && <section className="view-panel">
          <SectionTitle eyebrow="Agenda pública" title="Eventos" copy="A quinta oficial é protegida. Você pode editar descrição, capa, status e emergência; horário, local e regra do som ficam travados." action={<a className="secondary" href="/agenda" target="_blank">Ver agenda completa ↗</a>} />
          {events.find(x=>x.locked_weekly) && <div className="locked-event-card card"><div><b>🔒 Quinta oficial protegida</b><span>19:30–22:00 • Posto Buffon • Boca da Ponte • Som proibido</span></div><button type="button" className="secondary" onClick={()=>{const item=events.find(x=>x.locked_weekly);setEventForm({...item,starts_at:toInput(item.starts_at),ends_at:toInput(item.ends_at)})}}>Editar capa/status</button></div>}
          <div className="editor-grid"><form className="card form-card" onSubmit={saveEvent}>
            <div className="form-head"><div><b>{eventForm.locked_weekly?'🔒 Quinta oficial':eventForm.id?'Editando evento':'Novo evento'}</b><span>{eventForm.locked_weekly?'Campos principais protegidos':eventForm.id ? `Registro #${eventForm.id}` : 'Preencha e publique'}</span></div><button type="button" className="ghost" onClick={()=>{setEventForm(BLANK_EVENT);setCoverPreview('')}}>Limpar</button></div>
            <div className="grid two"><Field label="Título"><input value={eventForm.title} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,title:e.target.value})} required /></Field><Field label="Status"><select value={eventForm.status} onChange={e=>setEventForm({...eventForm,status:e.target.value})}><option value="scheduled">Agendado</option><option value="live">Ao vivo</option><option value="postponed">Adiado</option><option value="cancelled">Cancelado</option><option value="completed">Encerrado</option><option value="draft">Rascunho</option></select></Field></div>
            <div className="grid two"><Field label="Início"><input type="datetime-local" value={eventForm.starts_at} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})} required /></Field><Field label="Fim"><input type="datetime-local" value={eventForm.ends_at} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})} required /></Field></div>
            <div className="grid two"><Field label="Local"><input value={eventForm.location_name} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,location_name:e.target.value})} required /></Field><Field label="Endereço"><input value={eventForm.location_address || ''} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,location_address:e.target.value})} /></Field></div>
            <Field label="Descrição"><textarea rows="4" value={eventForm.description || ''} onChange={e=>setEventForm({...eventForm,description:e.target.value})} /></Field><div className="event-sponsor-picker"><span>PATROCINADORES DESTE ENCONTRO</span><div>{sponsors.filter(x=>x.active).length?sponsors.filter(x=>x.active).map(item=><label key={`event-sponsor-${item.id}`}><input type="checkbox" checked={Array.isArray(eventForm.sponsor_ids)&&eventForm.sponsor_ids.map(String).includes(String(item.id))} onChange={e=>{const current=Array.isArray(eventForm.sponsor_ids)?eventForm.sponsor_ids.map(Number):[];setEventForm({...eventForm,sponsor_ids:e.target.checked?[...new Set([...current,Number(item.id)])]:current.filter(id=>String(id)!==String(item.id))})}}/><b>{item.name}</b></label>):<small>Nenhum patrocinador ativo cadastrado.</small>}</div></div>
            <div className="grid two"><Field label="Regra do som"><select value={eventForm.sound_policy} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,sound_policy:e.target.value})}><option value="check_updates">Conforme comunicado</option><option value="allowed">Liberado</option><option value="not_allowed">Proibido</option></select></Field><Field label="Visibilidade"><select value={String(eventForm.is_public)} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,is_public:e.target.value==='true'})}><option value="true">Público</option><option value="false">Oculto</option></select></Field></div>
            <Field label="Mensagem sobre o som"><textarea rows="3" value={eventForm.sound_message || ''} disabled={eventForm.locked_weekly} onChange={e=>setEventForm({...eventForm,sound_message:e.target.value})} /></Field>
            {eventForm.id && <div className="event-cover-box"><Field label="Foto de capa do encontro" help="A imagem é comprimida automaticamente antes do upload."><input name="event_cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(coverPreview)URL.revokeObjectURL(coverPreview);setCoverPreview(file?URL.createObjectURL(file):'')}} /></Field>{coverPreview?<img src={coverPreview} alt="Prévia da capa"/>:eventForm.cover_storage_path?<img src={supabase.storage.from('gallery').getPublicUrl(eventForm.cover_storage_path).data.publicUrl} alt="Capa atual"/>:null}</div>}
            {eventForm.locked_weekly && <div className={`emergency-inline ${eventForm.emergency_mode?'active':''}`}><Toggle checked={Boolean(eventForm.emergency_mode)} onChange={emergency_mode=>setEventForm({...eventForm,emergency_mode})} label="Modo emergência" /><Field label="Mensagem de emergência"><textarea rows="3" value={eventForm.emergency_message || ''} placeholder="Ex.: Encontro cancelado devido ao mau tempo." onChange={e=>setEventForm({...eventForm,emergency_message:e.target.value})}/></Field></div>}
            <div className="form-actions"><button type="button" className="secondary preview-btn" onClick={()=>setPreview({type:'event',data:{...eventForm}})}>Pré-visualizar</button><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar evento ✓'}</button>{eventForm.id && !eventForm.locked_weekly && <button type="button" className="danger" onClick={()=>deleteEvent(eventForm.id)}>Excluir</button>}</div>
          </form><div className="card list-card"><div className="list-head"><div><b>Eventos cadastrados</b><span>{events.length} registros</span></div><button className="ghost" onClick={()=>setEventForm(BLANK_EVENT)}>＋ Novo extra</button></div><div className="records">{events.length===0?<p className="empty">Nenhum evento cadastrado.</p>:events.map(item=><button key={item.id} className="record" onClick={()=>setEventForm({...item,starts_at:toInput(item.starts_at),ends_at:toInput(item.ends_at)})}><div><b>{item.locked_weekly?'🔒 ':''}{item.title}</b><span>{fmt(item.starts_at)} • {item.location_name}{item.locked_weekly?' • Quinta oficial':item.recurring_weekly?' • Toda quinta':''}</span></div><em className={`pill ${item.status}`}>{eventStatusLabel(item.status)}</em></button>)}</div></div></div>
        </section>}

        {view === 'agenda' && <section className="view-panel">
          <SectionTitle eyebrow="Comunicados públicos" title="Avisos" copy="Publique na hora ou agende um comunicado. O painel mostra claramente quando ele está no ar, agendado, inativo ou encerrado." action={<a className="secondary" href="/#avisos" target="_blank">Ver avisos ↗</a>} />
          <div className="notice-help card"><b>Fluxo simplificado:</b><span>use “Publicar agora” para entrar no site imediatamente. Só escolha “Agendar” quando realmente quiser uma data futura.</span></div>
          <div className="editor-grid"><form className="card form-card" onSubmit={saveNotice}>
            <div className="form-head"><div><b>{noticeForm.id?'Editando aviso':'Novo aviso'}</b><span>{noticeForm.id?`Registro #${noticeForm.id}`:noticeTiming==='now'?'Vai aparecer assim que salvar':'Será publicado no horário escolhido'}</span></div><button type="button" className="ghost" onClick={resetNotice}>Limpar</button></div>
            <Field label="Título"><input placeholder="Atenção para esta quinta" value={noticeForm.title} onChange={e=>setNoticeForm({...noticeForm,title:e.target.value})} required /></Field>
            <Field label="Mensagem"><textarea rows="5" placeholder="Escreva o comunicado completo…" value={noticeForm.body} onChange={e=>setNoticeForm({...noticeForm,body:e.target.value})} required /></Field>
            <div className="grid two"><Field label="Tipo"><select value={noticeForm.tone} onChange={e=>setNoticeForm({...noticeForm,tone:e.target.value})}><option value="info">Informação</option><option value="warning">Atenção</option><option value="urgent">Urgente</option></select></Field><Field label="Prioridade" help="Maior aparece primeiro"><input type="number" min="0" max="100" value={noticeForm.priority} onChange={e=>setNoticeForm({...noticeForm,priority:e.target.value})} /></Field></div>
            <div className="timing-switch" role="group" aria-label="Momento da publicação">
              <button type="button" className={noticeTiming==='now'?'active':''} onClick={()=>{setNoticeTiming('now');setNoticeForm({...noticeForm,starts_at:'',ends_at:''})}}><b>Publicar agora</b><span>Entra no site ao salvar</span></button>
              <button type="button" className={noticeTiming==='schedule'?'active':''} onClick={()=>setNoticeTiming('schedule')}><b>Agendar</b><span>Escolher data e hora</span></button>
            </div>
            {noticeTiming === 'schedule' && <div className="grid two"><Field label="Começar em"><input type="datetime-local" value={noticeForm.starts_at} onChange={e=>setNoticeForm({...noticeForm,starts_at:e.target.value})} required /></Field><Field label="Encerrar em" help="Opcional"><input type="datetime-local" value={noticeForm.ends_at} onChange={e=>setNoticeForm({...noticeForm,ends_at:e.target.value})} /></Field></div>}
            <div className="toggle-row"><Toggle checked={noticeForm.active} onChange={active=>setNoticeForm({...noticeForm,active})} label="Aviso ativo e permitido no site" /><Toggle checked={Boolean(noticeForm.featured)} onChange={featured=>setNoticeForm({...noticeForm,featured})} label="Destacar este aviso" /></div>
            <div className="form-actions"><button type="button" className="secondary preview-btn" onClick={()=>setPreview({type:'notice',data:{...noticeForm}})}>Pré-visualizar</button><button className="primary" disabled={busy}>{busy?'Salvando…':noticeForm.id?'Atualizar aviso ✓':noticeTiming==='schedule'?'Agendar aviso ✓':'Publicar aviso ✓'}</button>{noticeForm.id && <button type="button" className="danger" onClick={()=>deleteNotice(noticeForm.id)}>Excluir</button>}</div>
          </form><div className="card list-card"><div className="list-head"><div><b>Avisos cadastrados</b><span>{liveNotices.length} aparecendo agora • {announcements.length} no total</span></div><button className="ghost" onClick={resetNotice}>＋ Novo</button></div><div className="records">{announcements.length===0?<p className="empty">Nenhum aviso cadastrado.</p>:announcements.map(item=>{const [label,status]=noticeState(item);return <button key={item.id} className="record notice-record" onClick={()=>editNotice(item)}><div><b>{item.title}</b><span>{item.body}</span><small>{item.starts_at?`Início: ${fmt(item.starts_at)}`:'Publicação imediata'}</small></div><em className={`pill ${status}`}>{item.featured?'★ Destaque':label}</em></button>})}</div></div></div>
        </section>}

        {view === 'gallery' && <section className="view-panel">
          <SectionTitle eyebrow="Galeria pública" title="Fotos & vídeos" copy="Envie fotos ou vídeos, escolha destaque, oculte e edite quando quiser. Imagens são comprimidas automaticamente." action={<a className="secondary" href="/#fotos" target="_blank">Ver galeria ↗</a>} />
          <form className="card upload-card" onSubmit={uploadPhoto}><Field label="Escolher foto ou vídeo"><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" required onChange={e=>{const file=e.target.files?.[0];if(photoPreview)URL.revokeObjectURL(photoPreview);setPhotoPreview(file?URL.createObjectURL(file):'');setPhotoPreviewIsVideo(Boolean(file?.type?.startsWith('video/')))}} /></Field>{photoPreview&&<div className="upload-preview">{photoPreviewIsVideo?<video src={photoPreview} controls playsInline preload="metadata"/>:<img src={photoPreview} alt="Prévia da mídia"/>}<span>Prévia antes de publicar</span></div>}<div className="grid two"><Field label="Legenda"><input name="caption" placeholder="Encontro de quinta" /></Field><Field label="Texto alternativo"><input name="alt_text" defaultValue="Foto da Baixos Fronteira" /></Field></div><div className="grid two"><Field label="Ordem"><input name="sort_order" type="number" defaultValue="0" /></Field><div className="upload-toggles"><label><input name="featured" type="checkbox" /> Destaque</label><label><input name="visible" type="checkbox" defaultChecked /> Visível no site</label></div></div><button className="primary" disabled={busy}>{busy?'Enviando…':'Publicar foto ✓'}</button></form>
          <div className="gallery-grid">{gallery.map(item=>{const url=supabase.storage.from('gallery').getPublicUrl(item.storage_path).data.publicUrl;return <article className="photo-card" key={item.id}>{item.media_type==='video'?<video src={url} controls playsInline preload="metadata"/>:<img src={url} alt={item.alt_text}/>} {item.featured&&<b className="featured">DESTAQUE</b>}<div><strong>{item.caption||'Sem legenda'}</strong><span>{item.visible?'Visível no site':'Oculta'}</span><div className="photo-actions"><button onClick={()=>setPhotoEdit({...item})}>Editar</button><button onClick={()=>patchPhoto(item,{featured:!item.featured})}>{item.featured?'Tirar destaque':'Destacar'}</button><button onClick={()=>patchPhoto(item,{visible:!item.visible})}>{item.visible?'Ocultar':'Mostrar'}</button><button className="danger-mini" onClick={()=>deletePhoto(item)}>Excluir</button></div></div></article>})}</div>
          {gallery.length===0&&<p className="empty card">Nenhuma foto cadastrada. Use o formulário acima para publicar a primeira.</p>}
          {photoEdit && <form className="card inline-editor" onSubmit={savePhotoEdit}><div className="form-head"><div><b>Editar foto #{photoEdit.id}</b><span>Legenda, ordem e visibilidade</span></div><button className="ghost" type="button" onClick={()=>setPhotoEdit(null)}>Fechar</button></div><div className="grid two"><Field label="Legenda"><input value={photoEdit.caption} onChange={e=>setPhotoEdit({...photoEdit,caption:e.target.value})}/></Field><Field label="Texto alternativo"><input value={photoEdit.alt_text} onChange={e=>setPhotoEdit({...photoEdit,alt_text:e.target.value})}/></Field></div><Field label="Ordem"><input type="number" value={photoEdit.sort_order} onChange={e=>setPhotoEdit({...photoEdit,sort_order:e.target.value})}/></Field><div className="toggle-row"><Toggle checked={photoEdit.featured} onChange={featured=>setPhotoEdit({...photoEdit,featured})} label="Destaque"/><Toggle checked={photoEdit.visible} onChange={visible=>setPhotoEdit({...photoEdit,visible})} label="Visível no site"/></div><button className="primary">Salvar alterações ✓</button></form>}
        </section>}

        {view === 'sponsors' && <section className="view-panel">
          <SectionTitle eyebrow="Parceiros da Baixos Fronteira" title="Patrocinadores" copy="Cadastre quantos patrocinadores quiser. Cada um pode ter foto ou vídeo, apresentação e todas as redes oficiais." action={<a className="secondary" href="/#patrocinadores" target="_blank">Ver no site ↗</a>} />
          <div className="editor-grid sponsor-editor-grid">
            <form className="card form-card" onSubmit={saveSponsor}>
              <div className="form-head"><div><b>{sponsorForm.id ? 'Editar patrocinador' : 'Novo patrocinador'}</b><span>Foto ou vídeo + nome + descrição + redes</span></div><button type="button" className="ghost" onClick={resetSponsor}>Limpar</button></div>
              <Field label="Nome do patrocinador"><input required value={sponsorForm.name} onChange={e=>setSponsorForm({...sponsorForm,name:e.target.value})} placeholder="Nome da empresa ou parceiro" /></Field>
              <Field label="Sobre o patrocinador"><textarea rows="4" value={sponsorForm.description} onChange={e=>setSponsorForm({...sponsorForm,description:e.target.value})} placeholder="Fale um pouco sobre a empresa, o que faz, cidade e parceria com a Baixos Fronteira..." /></Field>
              <Field label="Foto ou vídeo" help="JPG, PNG, WEBP, GIF, MP4, WEBM ou MOV. Até 50 MB. Fotos são comprimidas automaticamente."><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>pickSponsorMedia(e.target.files?.[0])} /></Field>
              {sponsorPreview && <div className="sponsor-admin-preview">{sponsorForm.media_type === 'video' ? <video src={sponsorPreview} controls playsInline preload="metadata" /> : <img src={sponsorPreview} alt={`Prévia de ${sponsorForm.name || 'patrocinador'}`} />}<span>Prévia da mídia</span></div>}
              <div className="sponsor-social-handle-box">
                <Field label="@ das redes" help="Use só um @. O mesmo usuário será usado automaticamente no Instagram, TikTok e Threads."><input value={sponsorForm.social_handle || ''} onChange={e=>setSponsorForm({...sponsorForm,social_handle:e.target.value})} placeholder="@empresa" autoCapitalize="none" autoCorrect="off" /></Field>
                {sponsorHandle(sponsorForm.social_handle) && <div className="social-auto-preview"><span>Instagram: @{sponsorHandle(sponsorForm.social_handle)}</span><span>TikTok: @{sponsorHandle(sponsorForm.social_handle)}</span><span>Threads: @{sponsorHandle(sponsorForm.social_handle)}</span></div>}
              </div>
              <div className="grid two">
                <Field label="YouTube"><input type="url" value={sponsorForm.youtube_url || ''} onChange={e=>setSponsorForm({...sponsorForm,youtube_url:e.target.value})} placeholder="https://youtube.com/@..." /></Field>
                <Field label="Facebook"><input type="url" value={sponsorForm.facebook_url || ''} onChange={e=>setSponsorForm({...sponsorForm,facebook_url:e.target.value})} placeholder="https://facebook.com/..." /></Field>
                <Field label="X / Twitter"><input type="url" value={sponsorForm.x_url || ''} onChange={e=>setSponsorForm({...sponsorForm,x_url:e.target.value})} placeholder="https://x.com/..." /></Field>
                <Field label="WhatsApp"><input type="url" value={sponsorForm.whatsapp_url || ''} onChange={e=>setSponsorForm({...sponsorForm,whatsapp_url:e.target.value})} placeholder="https://wa.me/..." /></Field>
                <Field label="Site"><input type="url" value={sponsorForm.website_url || ''} onChange={e=>setSponsorForm({...sponsorForm,website_url:e.target.value})} placeholder="https://..." /></Field>
              </div>
              <Field label="Ordem"><input type="number" value={sponsorForm.sort_order} onChange={e=>setSponsorForm({...sponsorForm,sort_order:e.target.value})} /></Field>
              <div className="toggle-row"><Toggle checked={sponsorForm.featured} onChange={featured=>setSponsorForm({...sponsorForm,featured})} label="Destaque"/><Toggle checked={sponsorForm.active} onChange={active=>setSponsorForm({...sponsorForm,active})} label="Visível no site"/></div>
              <div className="form-actions"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar patrocinador ✓'}</button>{sponsorForm.id && <button type="button" className="danger" onClick={()=>deleteSponsor(sponsorForm)}>Excluir</button>}</div>
            </form>
            <div className="card list-card">
              <div className="list-head"><div><b>Patrocinadores cadastrados</b><span>{sponsors.length} registros</span></div><button className="ghost" onClick={resetSponsor}>＋ Novo</button></div>
              <div className="records">{sponsors.length === 0 ? <p className="empty">Nenhum patrocinador cadastrado ainda.</p> : sponsors.map(item=><button className="record sponsor-record" key={item.id} onClick={()=>editSponsor(item)}><div><b>{item.name}</b><span>{item.social_handle ? `@${sponsorHandle(item.social_handle)}` : (item.instagram_handle || item.tiktok_handle || item.threads_handle || item.website_url || 'Sem rede cadastrada')}</span><small>{item.media_type === 'video' ? 'Vídeo' : 'Foto'}{item.featured ? ' • Destaque' : ''} • {sponsorMetrics[String(item.id)] || 0} cliques / 30 dias</small></div><em className={`pill ${item.active?'live':'muted'}`}>{item.active?'No site':'Oculto'}</em></button>)}</div>
            </div>
          </div>
        </section>}

        {view === 'site' && <section className="view-panel"><SectionTitle eyebrow="Textos públicos" title="Conteúdo" copy="Cada bloco abaixo alimenta uma área específica da página inicial." action={<a className="secondary" href="/" target="_blank">Ver site ↗</a>} /><form className="content-grid" onSubmit={saveContent}><article className="card form-card"><small>CAPA</small><h3>Hero</h3><Field label="Frase principal"><textarea rows="4" value={contentForm.hero_tagline} onChange={e=>setContentForm({...contentForm,hero_tagline:e.target.value})}/></Field></article><article className="card form-card"><small>HISTÓRIA</small><h3>Sobre o grupo</h3><Field label="Resumo"><textarea rows="5" value={contentForm.story_lead} onChange={e=>setContentForm({...contentForm,story_lead:e.target.value})}/></Field><Field label="Texto do modal"><textarea rows="5" value={contentForm.story_modal_intro} onChange={e=>setContentForm({...contentForm,story_modal_intro:e.target.value})}/></Field></article><article className="card form-card"><small>RODAPÉ E REDES</small><h3>Links</h3><Field label="WhatsApp"><input type="url" value={contentForm.whatsapp_url} onChange={e=>setContentForm({...contentForm,whatsapp_url:e.target.value})}/></Field><Field label="Instagram"><input type="url" value={contentForm.instagram_url} onChange={e=>setContentForm({...contentForm,instagram_url:e.target.value})}/></Field><Field label="@ do Instagram"><input value={contentForm.instagram_handle} onChange={e=>setContentForm({...contentForm,instagram_handle:e.target.value})}/></Field><Field label="TikTok"><input type="url" value={contentForm.tiktok_url} onChange={e=>setContentForm({...contentForm,tiktok_url:e.target.value})}/></Field><Field label="@ do TikTok"><input value={contentForm.tiktok_handle} onChange={e=>setContentForm({...contentForm,tiktok_handle:e.target.value})}/></Field><Field label="Threads"><input type="url" value={contentForm.threads_url} onChange={e=>setContentForm({...contentForm,threads_url:e.target.value})}/></Field><Field label="@ do Threads"><input value={contentForm.threads_handle} onChange={e=>setContentForm({...contentForm,threads_handle:e.target.value})}/></Field><Field label="Texto do rodapé"><textarea rows="3" value={contentForm.footer_text} onChange={e=>setContentForm({...contentForm,footer_text:e.target.value})}/></Field></article><button className="primary save-content" disabled={busy}>Publicar conteúdo ✓</button></form></section>}

        {view === 'site' && <section className="view-panel"><SectionTitle eyebrow="Publicações públicas" title="Instagram" copy="Cadastre links de posts para aparecerem na seção de Instagram do site." action={<a className="secondary" href="/#instagram-posts" target="_blank">Ver seção ↗</a>} /><div className="editor-grid"><form className="card form-card" onSubmit={saveInstagram}><div className="form-head"><div><b>{instagramForm.id?'Editar link':'Novo link'}</b><span>Instagram oficial</span></div><button type="button" className="ghost" onClick={()=>setInstagramForm(BLANK_INSTAGRAM)}>Limpar</button></div><Field label="Título"><input required value={instagramForm.title} onChange={e=>setInstagramForm({...instagramForm,title:e.target.value})}/></Field><Field label="Link da publicação"><input type="url" required value={instagramForm.url} onChange={e=>setInstagramForm({...instagramForm,url:e.target.value})}/></Field><Field label="Legenda"><textarea rows="4" value={instagramForm.caption} onChange={e=>setInstagramForm({...instagramForm,caption:e.target.value})}/></Field><Field label="Imagem de capa (URL)"><input value={instagramForm.image_url} onChange={e=>setInstagramForm({...instagramForm,image_url:e.target.value})}/></Field><div className="grid two"><Field label="Data"><input type="datetime-local" value={instagramForm.published_at} onChange={e=>setInstagramForm({...instagramForm,published_at:e.target.value})}/></Field><Field label="Ordem"><input type="number" value={instagramForm.sort_order} onChange={e=>setInstagramForm({...instagramForm,sort_order:e.target.value})}/></Field></div><div className="toggle-row"><Toggle checked={instagramForm.featured} onChange={featured=>setInstagramForm({...instagramForm,featured})} label="Destaque"/><Toggle checked={instagramForm.visible} onChange={visible=>setInstagramForm({...instagramForm,visible})} label="Visível"/></div><div className="form-actions"><button className="primary">Salvar link ✓</button>{instagramForm.id&&<button type="button" className="danger" onClick={()=>deleteInstagram(instagramForm.id)}>Excluir</button>}</div></form><div className="card list-card"><div className="list-head"><div><b>Links cadastrados</b><span>{instagram.length} registros</span></div></div><div className="records">{instagram.map(item=><button className="record" key={item.id} onClick={()=>setInstagramForm({...item,published_at:toInput(item.published_at)})}><div><b>{item.title}</b><span>{item.url}</span></div><em className={`pill ${item.visible?'live':'muted'}`}>{item.visible?(item.featured?'Destaque':'Visível'):'Oculto'}</em></button>)}</div></div></div></section>}


      </main>
    </div>
    {preview && <div className="preview-overlay" role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)setPreview(null)}}><div className="preview-shell card"><div className="preview-head"><div><small>PRÉ-VISUALIZAÇÃO</small><b>Assim vai aparecer no site</b></div><button type="button" onClick={()=>setPreview(null)}>×</button></div>{preview.type==='event'?<article className={`preview-event ${preview.data.status || 'scheduled'}`}><div><span>{eventStatusLabel(preview.data.status)}</span>{preview.data.recurring_weekly&&<b>↻ Toda quinta-feira</b>}</div><h2>{preview.data.title||'Encontro Baixos Fronteira'}</h2><p>{preview.data.description||'Sem descrição.'}</p><dl><div><dt>Data</dt><dd>{preview.data.starts_at?fmt(toIso(preview.data.starts_at)):'A confirmar'}</dd></div><div><dt>Local</dt><dd>{preview.data.location_name||'A confirmar'}</dd></div><div><dt>Som</dt><dd>{preview.data.sound_message||'Conforme comunicado'}</dd></div></dl></article>:<article className={`preview-notice ${preview.data.tone || 'info'}${preview.data.featured?' featured':''}`}><span>{preview.data.featured?'★ AVISO DESTACADO':'COMUNICADO'}</span><h2>{preview.data.title||'Título do aviso'}</h2><p>{preview.data.body||'Mensagem do aviso.'}</p></article>}<button type="button" className="primary wide" onClick={()=>setPreview(null)}>Voltar a editar</button></div></div>}
    {toast && <div key={toast.key} className={`toast ${toast.type}`}>{toast.message}</div>}
  </div>
}
