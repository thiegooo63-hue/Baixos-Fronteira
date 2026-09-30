export default function manifest() {
  return {
    name: 'Baixos Fronteira Jaguarão',
    short_name: 'Baixos Fronteira',
    description: 'Agenda, avisos, encontros, galeria e patrocinadores da Baixos Fronteira Jaguarão.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    orientation: 'portrait-primary',
    categories: ['social', 'lifestyle', 'automotive'],
    shortcuts: [
      { name: 'Próxima quinta', short_name: 'Quinta', url: '/e/quinta', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] },
      { name: 'Agenda', short_name: 'Agenda', url: '/agenda', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] }
    ],
    icons: [
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  }
}
