# Baixos Fronteira — V10 Final

Versão final do site oficial da **Baixos Fronteira**, com Next.js 16 + Supabase, painel administrativo em `/admin`, PWA, agenda automática da quinta-feira, galeria, patrocinadores, analytics e modo de emergência.

## Painel administrativo

O painel foi mantido simples, com cinco áreas principais:

- **Início** — próxima quinta, visitas dos últimos 30 dias, cliques, mídias, patrocinadores e histórico.
- **Agenda** — encontro oficial protegido, eventos extras, avisos, patrocinadores do encontro e modo emergência.
- **Galeria** — fotos e vídeos, compressão das imagens, destaque, visibilidade, ordem, edição e exclusão.
- **Patrocinadores** — vários parceiros com foto/vídeo, descrição, @ compartilhado por Instagram/TikTok/Threads e redes opcionais.
- **Site** — textos, links e publicações do Instagram.

A conta autorizada no painel é `baixosfronteira@gmail.com`.

## Quinta-feira oficial

O encontro oficial é protegido contra exclusão acidental e usa:

- quinta-feira;
- 19:30–22:00;
- Posto Buffon;
- Boca da Ponte;
- som automotivo proibido;
- link curto `/e/quinta`;
- QR Code, mapa, compartilhamento e status em tempo real.

## V10 — recursos finais

### Visual

- identidade automotiva preto/vermelho preservada;
- mais espaço e hierarquia entre seções;
- contador inspirado em painel automotivo;
- cards padronizados;
- linhas, glow e detalhes automotivos discretos;
- patrocinadores em carrossel com foto/vídeo dominante;
- galeria estilo exposição com lightbox, setas e swipe no celular;
- vídeos com moldura própria;
- página do encontro reorganizada;
- rodapé premium;
- microanimações com suporte a `prefers-reduced-motion`;
- estados vazios e skeletons de carregamento.

### Sistemas

- backup automático antes de alterações/exclusões;
- Histórico com **Desfazer**;
- quinta oficial travada;
- foto de capa do encontro;
- Google Maps;
- QR Code;
- modo emergência;
- PWA instalável e funcionamento básico offline;
- notificações locais do PWA/site enquanto o navegador/PWA está ativo;
- galeria com foto e vídeo (até 50 MB por mídia conforme bucket);
- compressão automática de imagens;
- vários patrocinadores;
- patrocinadores específicos por encontro;
- analytics próprio: visitas e cliques em Instagram, WhatsApp, mapa, compartilhamento e patrocinadores;
- SEO local, Open Graph, sitemap e robots;
- página 404 própria — **“Saiu da pista.”**

> As notificações atuais são notificações locais disparadas quando o site/PWA está ativo. Não há serviço de push em segundo plano com o aplicativo totalmente fechado.

## Deploy / VertraCloud

Requer **Node.js 22+**.

```bash
npm install
npm start
```

O `index.js` abre a porta da hospedagem imediatamente. Se `.next/BUILD_ID` já existir, inicia em produção. Se a build não existir:

1. tenta uma build de produção mais econômica com **Webpack**, build worker e limites de memória;
2. se o provedor matar apenas o processo de build (por exemplo `SIGKILL` por limite de RAM/CPU), entra em um **fallback de emergência** do Next para manter o site respondendo em vez de encerrar o servidor.

A build de produção continua sendo o modo preferido; o fallback existe apenas para impedir indisponibilidade quando a hospedagem não suporta o pico de memória da compilação.

Rotas principais:

- `/` — site público
- `/agenda` — agenda completa
- `/agenda/[id]` — encontro/evento
- `/e/quinta` — link curto da quinta oficial
- `/admin` — painel administrativo
- `/sitemap.xml` — sitemap
- `/robots.txt` — robots
- `/health` e `/healthz` — health check

## Supabase

O frontend usa somente a chave **publicável** e as escritas administrativas passam por Auth + RLS. Nunca coloque `service_role`, senha do banco ou outra chave secreta no frontend.

A V10 adiciona ao banco:

- `events.sponsor_ids`;
- `gallery_items.media_type`;
- tabela `site_analytics` com RLS;
- suporte a vídeo no bucket `gallery`;
- índices de apoio para histórico, backups e patrocinadores.

## Verificação

Execute:

```bash
npm run verify
npm run audit
```

`verify` valida a estrutura essencial do projeto e `audit` executa a auditoria estática específica da V10.


## V10.1 — hotfix de memória da VertraCloud

O log real da V10 mostrou que o Webpack compilava com sucesso, mas o Next abria **13 workers** em `Collecting page data`/`Generating static pages` e o sistema operacional encerrava o processo com `SIGKILL`.

A V10.1 mantém Next.js **16.3.6** e adiciona:

- `experimental.cpus: 1`;
- `staticGenerationMaxConcurrency: 1`;
- `staticGenerationMinPagesPerWorker: 1000`;
- `staticGenerationRetryCount: 1`;
- `enablePrerenderSourceMaps: false`;
- `workerThreads: false`;
- `memoryBasedWorkersCount: false`.

O objetivo é que o log da hospedagem passe a mostrar **1 worker**, não 13. Não foi feito downgrade do Next porque 16.3.6 contém correção de segurança crítica publicada em setembro de 2026.


## V10.2 — Redes oficiais

- Menu público **Redes** com abas Instagram / TikTok / Threads.
- Acessos rápidos das três redes no hero.
- Instagram: `@baixos_fronteira_jag`.
- TikTok: `@baixos_fronteira_jag`.
- Threads: `@baixos_fronteira_jag` usando o domínio atual `threads.com`.
- Links das três redes também no rodapé.
- Admin > Site permite editar URL e @ das três redes.
- Analytics registra cliques em Instagram, TikTok e Threads.
- Mantém integralmente o hotfix de memória da V10.1: `cpus: 1` e geração estática com concorrência 1.
