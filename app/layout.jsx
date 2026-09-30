import PwaRegister from '../components/pwa/PwaRegister'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://baixosfronteirajag.vertraweb.app'

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Baixos Fronteira | Jaguarão RS', template: '%s | Baixos Fronteira' },
  description: 'Baixos Fronteira Jaguarão — encontros automotivos, agenda oficial, galeria, patrocinadores, cultura, respeito e união.',
  applicationName: 'Baixos Fronteira',
  keywords: ['Baixos Fronteira','Jaguarão','carros baixos','encontro automotivo','Rio Grande do Sul'],
  alternates: { canonical: '/' },
  openGraph: { title: 'Baixos Fronteira | Jaguarão RS', description: 'Agenda oficial, encontros, galeria e patrocinadores da Baixos Fronteira.', url: SITE, siteName: 'Baixos Fronteira', locale: 'pt_BR', type: 'website', images: [{ url: '/assets/evento-carros.jpg', width: 1600, height: 900, alt: 'Encontro Baixos Fronteira Jaguarão' }] },
  twitter: { card: 'summary_large_image', title: 'Baixos Fronteira | Jaguarão RS', description: 'Agenda oficial, encontros, galeria e patrocinadores.', images: ['/assets/evento-carros.jpg'] },
  icons: { icon: '/assets/favicon.svg', apple: '/icons/pwa-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Baixos Fronteira' },
  formatDetection: { telephone: false }
}

export const viewport = { themeColor: '#050505', colorScheme: 'dark', viewportFit: 'cover' }

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><head><link rel="preload" href="/assets/evento-carros.jpg" as="image" fetchPriority="high"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Rubik+Dirt&display=swap" rel="stylesheet"/><meta name="mobile-web-app-capable" content="yes"/></head><body><PwaRegister/>{children}</body></html>
}
