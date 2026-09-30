import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'app/layout.jsx', 'app/manifest.js',
  'app/(site)/layout.jsx', 'app/(site)/page.jsx', 'app/(site)/SiteClient.jsx', 'app/(site)/site.css',
  'app/(site)/agenda/page.jsx', 'app/(site)/agenda/AgendaClient.jsx',
  'app/(site)/agenda/[id]/page.jsx', 'app/(site)/agenda/[id]/EventClient.jsx', 'app/(site)/e/quinta/page.jsx',
  'app/admin/layout.jsx', 'app/admin/page.jsx', 'app/admin/admin.css',
  'components/admin/AdminPanel.jsx', 'components/pwa/PwaRegister.jsx',
  'lib/supabase.js', 'lib/events.js', 'lib/client-image.js', 'public/sw.js',
  'public/icons/pwa-192.png', 'public/icons/pwa-512.png',
  'public/assets/evento-carros.jpg', 'public/assets/pista-baixos-fronteira.webp',
  'public/assets/logo-baixos-fronteira.png', 'public/assets/post-quintas-instagram.jpeg', 'public/assets/favicon.svg', 'public/assets/qr-quinta.png',
  'supabase/migrations/20260928133000_features_v4.sql',
  'supabase/migrations/20260928205500_admin_backups_locked_thursday_cover_emergency.sql',
  'supabase/migrations/20260928205600_allow_team_update_change_history_for_undo.sql',
  'supabase/migrations/20260929161039_add_sponsors_and_sponsor_media.sql',
  'supabase/migrations/20260929162255_harden_sponsors_grants.sql',
  'supabase/migrations/20260929163500_extend_sponsor_socials.sql',
  'supabase/migrations/20260929202500_v10_final_features.sql',
  'supabase/migrations/20260929210000_v10_database_hardening.sql',
  'lib/analytics.js', 'app/not-found.jsx', 'app/(site)/loading.jsx', 'app/admin/loading.jsx',
  'app/sitemap.js', 'app/robots.js', 'public/offline.html'
]
const forbidden = ['public/script.js', 'public/site-sync.js', 'public/site-config.js', 'public/assets/supabase-2.117.2.js']
const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)))
const legacy = forbidden.filter((file) => fs.existsSync(path.join(ROOT, file)))
if (missing.length || legacy.length) {
  missing.forEach((file) => console.error(`[Baixos Fronteira] Arquivo obrigatório ausente: ${file}`))
  legacy.forEach((file) => console.error(`[Baixos Fronteira] Arquivo legado proibido: ${file}`))
  process.exit(1)
}

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const site = read('app/(site)/SiteClient.jsx')
const agenda = read('app/(site)/agenda/AgendaClient.jsx')
const detail = read('app/(site)/agenda/[id]/EventClient.jsx')
const admin = read('components/admin/AdminPanel.jsx')
const manifest = read('app/manifest.js')
const sw = read('public/sw.js')
const migration = read('supabase/migrations/20260928133000_features_v4.sql')
const migrationV7 = read('supabase/migrations/20260928205500_admin_backups_locked_thursday_cover_emergency.sql')
const migrationSponsors = read('supabase/migrations/20260929161039_add_sponsors_and_sponsor_media.sql')
const migrationSponsorSocials = read('supabase/migrations/20260929163500_extend_sponsor_socials.sql')
const migrationV10 = read('supabase/migrations/20260929202500_v10_final_features.sql')
const indexJs = read('index.js')
const nextConfig = read('next.config.mjs')
const analyticsLib = read('lib/analytics.js')
const invalid = []
const requireText = (content, token, message) => { if (!content.includes(token)) invalid.push(message) }

if (/dangerouslySetInnerHTML/.test(site)) invalid.push('SiteClient ainda contém dangerouslySetInnerHTML')
requireText(site, 'expandRecurringEvents', 'Home não expande eventos recorrentes')
requireText(site, 'countdown-premium', 'Home não contém a nova contagem regressiva')
requireText(site, 'Aviso destacado', 'Home não renderiza aviso destacado')
requireText(agenda, 'eventDetailUrl', 'Agenda não aponta para páginas individuais')
requireText(detail, 'navigator.share', 'Página individual não contém compartilhamento nativo')
requireText(detail, 'wa.me', 'Página individual não contém compartilhamento por WhatsApp')
requireText(detail, 'maps/search', 'Página individual não contém mapa/localização')
requireText(detail, '/assets/qr-quinta.png', 'Página individual não contém QR Code')
requireText(admin, 'Quinta oficial protegida', 'Admin não protege a quinta oficial')
requireText(admin, 'createBackup', 'Admin não contém backup automático')
requireText(admin, 'undoHistory', 'Admin não contém Desfazer')
requireText(admin, 'compressImageFile', 'Admin não contém compressão de imagens')
requireText(admin, 'Modo emergência', 'Admin não contém modo emergência')
requireText(admin, 'Pré-visualizar', 'Admin não contém preview antes de publicar')
requireText(admin, 'Histórico de alterações', 'Admin não contém histórico')
requireText(admin, 'Destacar este aviso', 'Admin não contém aviso destacado')
requireText(admin, 'baixosfronteira@gmail.com', 'Admin não restringe o e-mail oficial')
requireText(admin, "['sponsors', '★', 'Patrocinadores']", 'Admin não contém aba de Patrocinadores')
requireText(admin, "storage.from('sponsor-media')", 'Admin não contém upload de mídia de patrocinador')
requireText(admin, 'social_handle', 'Admin não contém @ único de patrocinador')
requireText(admin, 'threads_url', 'Admin não contém Threads de patrocinador')
requireText(admin, 'youtube_url', 'Admin não contém YouTube de patrocinador')
requireText(admin, 'facebook_url', 'Admin não contém Facebook de patrocinador')
requireText(admin, 'x_url', 'Admin não contém X/Twitter de patrocinador')
requireText(site, 'id="patrocinadores"', 'Site não contém seção pública de Patrocinadores')
requireText(site, 'sponsorMediaPublicUrl', 'Site não monta URL da mídia de patrocinador')
requireText(manifest, "display: 'standalone'", 'Manifest PWA não está em modo standalone')
requireText(sw, "self.addEventListener('fetch'", 'Service worker não possui estratégia de fetch')
requireText(sw, "self.addEventListener('notificationclick'", 'Service worker não trata clique em notificação')
requireText(site, 'Ativar notificações', 'Home não contém ativação de notificações PWA')
requireText(site, 'function SponsorCarousel', 'Home não contém carrossel funcional de patrocinadores')
requireText(site, 'exhibition-lead', 'Galeria não contém destaque estilo exposição')
requireText(site, 'sponsor-video-frame', 'Vídeos de patrocinadores não possuem moldura própria')
requireText(site, 'footer-brand-panel', 'Rodapé premium não foi aplicado')
requireText(detail, 'event-detail-content', 'Página do encontro não está reorganizada')
requireText(detail, 'event-support-grid', 'Página do encontro não contém bloco organizado de mapa e QR')
const siteCss = read('app/(site)/site.css')
for (const token of ['Visual refinement v9', 'Automotive countdown', 'Gallery exhibition', 'Sponsor carousel', 'Premium footer', 'v9 final', 'V10 FINAL', 'V10 home hierarchy']) requireText(siteCss, token, `CSS v9 não contém ${token}`)
for (const token of ['site_analytics', 'sponsor_ids', 'media_type', 'video/mp4']) requireText(migrationV10, token, `Migration V10 não contém ${token}`)
for (const token of ["'build', '--webpack', '--experimental-app-only'", 'startFallbackDev', 'online-fallback', '--max-old-space-size=640']) requireText(indexJs, token, `Startup V10 não contém ${token}`)
for (const token of ['webpackMemoryOptimizations', 'webpackBuildWorker', 'cpus: 1', 'staticGenerationMaxConcurrency: 1', 'staticGenerationMinPagesPerWorker: 1000', 'enablePrerenderSourceMaps: false']) requireText(nextConfig, token, `Next config V10.1 não contém ${token}`)
for (const token of ['trackAnalytics', 'site_analytics', 'visitor_id']) requireText(analyticsLib, token, `Analytics V10 não contém ${token}`)
for (const token of ["trackAnalytics('page_view'", 'gallery-video-frame', 'galleryStep', 'sponsor_click']) requireText(site, token, `Site V10 não contém ${token}`)
for (const token of ['eventSponsors', 'sponsor_ids', 'event-sponsors-grid', 'click_map']) requireText(detail, token, `Evento V10 não contém ${token}`)
for (const token of ['analyticsSummary', 'sponsorMetrics', 'event-sponsor-picker', "media_type: isVideo ? 'video' : 'image'"]) requireText(admin, token, `Admin V10 não contém ${token}`)
for (const token of ['recurring_weekly', 'featured boolean', 'change_history', "'postponed'::text"]) requireText(migration, token, `Migration v4 não contém ${token}`)
for (const token of ['admin_backups', 'locked_weekly', 'cover_storage_path', 'emergency_mode']) requireText(migrationV7, token, `Migration v7 não contém ${token}`)
for (const token of ['create table if not exists public.sponsors', "'sponsor-media'", 'tiktok_url', 'instagram_url', 'supabase_realtime']) requireText(migrationSponsors, token, `Migration de patrocinadores não contém ${token}`)
for (const token of ['social_handle', 'threads_url', 'youtube_url', 'facebook_url', 'x_url']) requireText(migrationSponsorSocials, token, `Migration de redes de patrocinadores não contém ${token}`)
if (invalid.length) {
  invalid.forEach((message) => console.error(`[Baixos Fronteira] ${message}`))
  process.exit(1)
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
})
const sourceFiles = walk(ROOT).filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`) && file !== path.join(ROOT, 'scripts/verify-project.mjs') && /\.(?:js|jsx|mjs|css)$/.test(file))
const assetRefs = new Set()
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/\/(?:assets|icons)\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|gif)/g)) assetRefs.add(match[0])
}
const brokenAssets = [...assetRefs].filter((ref) => !fs.existsSync(path.join(ROOT, 'public', ref.slice(1))))
if (brokenAssets.length) {
  brokenAssets.forEach((ref) => console.error(`[Baixos Fronteira] Asset inexistente: ${ref}`))
  process.exit(1)
}

const extensions = ['', '.js', '.jsx', '.mjs', '.json']
const brokenImports = []
for (const file of sourceFiles.filter((file) => /\.(?:js|jsx|mjs)$/.test(file))) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), match[1])
    const ok = extensions.some((ext) => fs.existsSync(target + ext)) || ['index.js','index.jsx'].some((name) => fs.existsSync(path.join(target, name)))
    if (!ok) brokenImports.push(`${path.relative(ROOT, file)} -> ${match[1]}`)
  }
}
if (brokenImports.length) {
  brokenImports.forEach((item) => console.error(`[Baixos Fronteira] Import local quebrado: ${item}`))
  process.exit(1)
}

for (const icon of ['public/icons/pwa-192.png', 'public/icons/pwa-512.png']) {
  if (fs.statSync(path.join(ROOT, icon)).size < 1000) {
    console.error(`[Baixos Fronteira] Ícone PWA inválido: ${icon}`)
    process.exit(1)
  }
}

const pkg = JSON.parse(read('package.json'))
for (const dependency of ['next', 'react', 'react-dom', '@supabase/supabase-js']) {
  if (!pkg.dependencies?.[dependency]) {
    console.error(`[Baixos Fronteira] Dependência obrigatória ausente: ${dependency}`)
    process.exit(1)
  }
}

console.log(`[Baixos Fronteira] Verificação pré-build OK: ${required.length} arquivos, ${assetRefs.size} assets, rotas de evento, patrocinadores, mídia foto/vídeo, backup/desfazer, quinta protegida, QR, PWA/offline, analytics, SEO, vídeo na galeria, patrocinador por encontro, compressão, preview, build econômico e histórico.`)
