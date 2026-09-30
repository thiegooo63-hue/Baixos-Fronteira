/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Next 16.3.x can spend a lot of RAM retaining prerender source-map state.
  // This site does not need production prerender source maps.
  enablePrerenderSourceMaps: false,
  experimental: {
    // VertraCloud is a low-memory environment. Force every Next build phase
    // (including "Collecting page data") to use a single worker instead of
    // auto-detecting all CPU cores.
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: false,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
    // Static generation: process one page at a time and keep all 11 routes in
    // one batch, preventing Next from spawning a worker farm.
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
    staticGenerationRetryCount: 1
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] },
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] }
    ]
  }
}
export default nextConfig
