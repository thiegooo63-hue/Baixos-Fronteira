import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const issues = []
const info = []
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules','.next','.git'].includes(entry.name)) return []
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const files = walk(ROOT)
const routeFiles = files.filter((file) => /(?:^|\/)(?:page|route)\.(?:js|jsx|mjs|ts|tsx)$/.test(file))
const routeMap = new Map()
for (const file of routeFiles) {
  let rel = path.relative(path.join(ROOT,'app'), path.dirname(file)).replaceAll('\\','/')
  rel = rel.split('/').filter((part) => part && !/^\(.+\)$/.test(part)).join('/')
  rel = '/' + rel
  rel = rel.replace(/\[\.\.\.(.+?)\]/g, ':*$1').replace(/\[(.+?)\]/g, ':$1').replace(/\/+/g,'/')
  const kind = path.basename(file).startsWith('route.') ? 'route' : 'page'
  const key = `${kind}:${rel}`
  if (routeMap.has(key)) issues.push(`Rota duplicada ${rel}: ${path.relative(ROOT,routeMap.get(key))} e ${path.relative(ROOT,file)}`)
  else routeMap.set(key,file)
}

const packageJson = JSON.parse(read('package.json'))
for (const dep of ['next','react','react-dom','@supabase/supabase-js']) {
  if (!/^\d+\.\d+\.\d+/.test(packageJson.dependencies?.[dep] || '')) issues.push(`Dependência não fixada: ${dep}`)
}
if (!String(packageJson.scripts?.build || '').includes('--webpack')) issues.push('Build não está usando Webpack de baixa memória')
if (!read('next.config.mjs').includes('webpackMemoryOptimizations: true')) issues.push('webpackMemoryOptimizations ausente')
if (!read('next.config.mjs').includes('cpus: 1')) issues.push('V10.1 não limita workers do Next a 1 CPU')
if (!read('next.config.mjs').includes('staticGenerationMaxConcurrency: 1')) issues.push('V10.1 não limita geração estática a 1 página por vez')
if (!read('next.config.mjs').includes('enablePrerenderSourceMaps: false')) issues.push('V10.1 não desativa source maps de prerender')
if (!read('index.js').includes('startFallbackDev')) issues.push('Fallback de startup ausente')

const allText = files.filter((f)=>/\.(?:js|jsx|mjs|css)$/.test(f)).map((f)=>[f,fs.readFileSync(f,'utf8')])
const assetRefs = new Set()
for (const [,text] of allText) for (const m of text.matchAll(/\/(?:assets|icons)\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|gif)/g)) assetRefs.add(m[0])
for (const ref of assetRefs) if (!exists(`public${ref}`)) issues.push(`Asset referenciado e ausente: ${ref}`)

for (const file of files) {
  const stat = fs.statSync(file)
  if (stat.size > 55 * 1024 * 1024) issues.push(`Arquivo acima de 55 MB: ${path.relative(ROOT,file)}`)
}

const mustHave = [
  ['lib/analytics.js','site_analytics'],
  ['components/admin/AdminPanel.jsx','event-sponsor-picker'],
  ['app/(site)/SiteClient.jsx','galleryStep'],
  ['app/(site)/agenda/[id]/EventClient.jsx','eventSponsors'],
  ['public/sw.js','offline.html'],
  ['app/sitemap.js','sitemap'],
  ['app/robots.js','robots'],
  ['app/not-found.jsx','Saiu da'],
]
for (const [file,token] of mustHave) if (!exists(file) || !read(file).includes(token)) issues.push(`${file}: recurso V10 ausente (${token})`)

info.push(`${files.length} arquivos verificados`)
info.push(`${routeFiles.length} arquivos de rota sem conflito`)
info.push(`${assetRefs.size} assets referenciados e conferidos`)
info.push(`Next ${packageJson.dependencies.next} / React ${packageJson.dependencies.react}`)

if (issues.length) {
  for (const issue of issues) console.error(`[V10] ERRO: ${issue}`)
  process.exit(1)
}
for (const line of info) console.log(`[V10] OK: ${line}`)
console.log('[V10] Auditoria final estática concluída sem erros.')
