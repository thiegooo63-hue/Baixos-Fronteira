export default function Loading() {
  return <main className="site-skeleton" aria-label="Carregando Baixos Fronteira"><div className="skeleton-hero"><div className="skeleton-logo"/><div className="skeleton-line wide"/><div className="skeleton-line"/></div><div className="skeleton-grid">{Array.from({length:6}).map((_,i)=><div className="skeleton-card" key={i}/>)}</div></main>
}
