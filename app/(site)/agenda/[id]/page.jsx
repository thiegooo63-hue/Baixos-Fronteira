import EventClient from './EventClient'

export const metadata = {
  title: 'Encontro',
  description: 'Detalhes, horário, localização, mapa, regras e patrocinadores do encontro da Baixos Fronteira Jaguarão.',
  openGraph: { title: 'Encontro | Baixos Fronteira', description: 'Confira todos os detalhes do encontro da Baixos Fronteira em Jaguarão.', images: ['/assets/evento-carros.jpg'] },
  robots: { index: true, follow: true }
}

export default function EventPage(){return <EventClient/>}
