const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT) || 3000
const FALLBACK_PORT = Number(process.env.BF_FALLBACK_PORT) || (PORT === 3000 ? 3010 : 3000)
const ROOT = __dirname
const BUILD_ID = path.join(ROOT, '.next', 'BUILD_ID')

process.env.NODE_ENV = 'production'
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1'

let appStatus = fs.existsSync(BUILD_ID) ? 'starting' : 'building'
let nextHandler = null
let startupError = null
let fallbackChild = null
let fallbackReady = false

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' })
  response.end(JSON.stringify(payload))
}

function proxyToFallback(request, response) {
  const proxy = http.request({ hostname: '127.0.0.1', port: FALLBACK_PORT, method: request.method, path: request.url, headers: { ...request.headers, host: `127.0.0.1:${FALLBACK_PORT}` } }, (upstream) => {
    response.writeHead(upstream.statusCode || 502, upstream.headers)
    upstream.pipe(response)
  })
  proxy.on('error', (error) => {
    console.error('[Baixos Fronteira] Proxy de emergência:', error.message)
    if (!response.headersSent) sendJson(response, 503, { status: appStatus, message: 'Site reiniciando em modo de emergência.' })
    else response.end()
  })
  request.pipe(proxy)
}

const server = http.createServer((request, response) => {
  setSecurityHeaders(response)
  if (request.url === '/health' || request.url === '/healthz') {
    sendJson(response, 200, { status: appStatus, framework: 'nextjs', site: 'Baixos Fronteira', fallback: fallbackReady })
    return
  }
  if (nextHandler) { nextHandler(request, response); return }
  sendJson(response, 200, { status: appStatus, message: appStatus === 'error' ? 'Falha ao iniciar o site. Consulte os logs.' : 'Baixos Fronteira está iniciando.' })
})

server.on('upgrade', (request, socket, head) => {
  if (!fallbackReady) return socket.destroy()
  const upstream = net.connect(FALLBACK_PORT, '127.0.0.1', () => {
    const headerLines = Object.entries(request.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headerLines}\r\n\r\n`)
    if (head?.length) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
})

function validateProjectFiles() {
  const requiredFiles = ['app/(site)/page.jsx','app/(site)/site.css','app/admin/page.jsx','components/admin/AdminPanel.jsx','public/assets/evento-carros.jpg','public/assets/pista-baixos-fronteira.webp','public/assets/logo-baixos-fronteira.png','public/assets/post-quintas-instagram.jpeg']
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(ROOT, file)))
  if (missing.length) throw new Error(`Arquivos obrigatórios ausentes: ${missing.join(', ')}`)
  const css = fs.readFileSync(path.join(ROOT, 'app', '(site)', 'site.css'), 'utf8')
  if (/url\(["']?assets\//.test(css)) throw new Error('Caminho de asset relativo inválido no site.css. Use /assets/...')
}

function nextCliPath() {
  const nextRoot = path.dirname(require.resolve('next/package.json'))
  return path.join(nextRoot, 'dist', 'bin', 'next')
}

function ensureBuild() {
  validateProjectFiles()
  if (fs.existsSync(BUILD_ID)) { console.log('[Baixos Fronteira] Build pronta encontrada.'); return Promise.resolve() }
  appStatus = 'building'
  console.log('[Baixos Fronteira] Build pronta não encontrada; iniciando compilação Next.js V10.2 em modo econômico (Webpack + 1 worker) sem bloquear a porta.')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextCliPath(), 'build', '--webpack', '--experimental-app-only'], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=640 --max-semi-space-size=32' },
      stdio: 'inherit'
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0 && fs.existsSync(BUILD_ID)) { console.log('[Baixos Fronteira] Compilação de produção concluída com sucesso.'); resolve(); return }
      reject(new Error(signal ? `Compilação do Next.js encerrada pelo sinal ${signal}.` : `Compilação do Next.js terminou com código ${code ?? 'desconhecido'}.`))
    })
  })
}

function waitForFallback() {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      const request = http.get({ hostname: '127.0.0.1', port: FALLBACK_PORT, path: '/healthz', timeout: 2500 }, (response) => { response.resume(); resolve() })
      request.on('error', () => {
        if (Date.now() - started > 90000) reject(new Error('Modo de emergência não respondeu em 90 segundos.'))
        else setTimeout(check, 900)
      })
      request.on('timeout', () => request.destroy())
    }
    check()
  })
}

async function startFallbackDev(buildError) {
  console.warn('[Baixos Fronteira] Build de produção não coube no servidor:', buildError.message)
  console.warn('[Baixos Fronteira] Ativando fallback de baixa memória por página. O site continuará online.')
  appStatus = 'fallback-starting'
  fallbackChild = spawn(process.execPath, [nextCliPath(), 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(FALLBACK_PORT)], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=512 --max-semi-space-size=24' },
    stdio: 'inherit'
  })
  fallbackChild.once('exit', (code, signal) => {
    fallbackReady = false
    nextHandler = null
    appStatus = 'error'
    console.error(`[Baixos Fronteira] Fallback encerrou (${signal || code}).`)
  })
  await waitForFallback()
  fallbackReady = true
  nextHandler = proxyToFallback
  appStatus = 'online-fallback'
  console.log(`[Baixos Fronteira] Site online em fallback de baixa memória pela porta interna ${FALLBACK_PORT}.`)
}

async function prepareNext() {
  try {
    await ensureBuild()
    appStatus = 'starting'
    const next = require('next')
    const app = next({ dev: false, hostname: HOST, port: PORT, dir: ROOT })
    await app.prepare()
    nextHandler = app.getRequestHandler()
    appStatus = 'online'
    console.log(`[Baixos Fronteira] Next.js produção online na porta ${PORT}`)
  } catch (error) {
    startupError = error
    try { await startFallbackDev(error) }
    catch (fallbackError) {
      appStatus = 'error'
      console.error('[Baixos Fronteira] Falha também no fallback:', fallbackError)
    }
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[Baixos Fronteira] Porta ${PORT} aberta. Preparando aplicação V10.2 (hotfix 1 worker)...`)
  prepareNext()
})

server.on('error', (error) => { console.error('[Baixos Fronteira] Erro no servidor HTTP:', error); process.exit(1) })

const shutdown = () => {
  if (fallbackChild && !fallbackChild.killed) fallbackChild.kill('SIGTERM')
  server.close(() => process.exit(appStatus === 'error' ? 1 : 0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
