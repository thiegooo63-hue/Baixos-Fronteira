import EventClient from '../../agenda/[id]/EventClient'

export const metadata = {
  title: 'Encontro de Quinta',
  description: 'Encontro oficial da Baixos Fronteira: toda quinta-feira, 19:30–22:00, Posto Buffon, Boca da Ponte, Jaguarão.',
  alternates: { canonical: '/e/quinta' },
  openGraph: { title: 'Toda quinta | Baixos Fronteira', description: '19:30–22:00 • Posto Buffon • Boca da Ponte • Jaguarão RS', images: ['/assets/evento-carros.jpg'] }
}

export default function ThursdayEventPage(){return <EventClient official/>}
