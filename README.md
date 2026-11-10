# BGL Group – Site institucional

Site estático da BGL Tecnologia e Soluções (www.bglgroup.com.br).

- `index.html` – página inicial
- Páginas de soluções: eletrica, ensaios, telecom, automacao, seguranca, incendio
- `plataformas.html`, `empresa.html`, `codigo-de-etica.html`, `contato.html`
- `assets/` – estilos, script e logos

Publicação: Netlify (publica a raiz do repositório, sem build). O formulário de contato usa Netlify Forms.

## Monitoramento de visitantes

- `assets/track.js` – registra página, tempo na página e origem (Google, Instagram etc.) de cada visita, sem cookies.
- `netlify/functions/track.mjs` (`/api/track`) – grava as visitas no banco Neon `bgl-site-analytics`.
- `netlify/functions/painel.mjs` (`/api/painel`) – entrega os dados do painel; exige a senha.
- `painel.html` – painel restrito (não indexado). Senha na variável `PAINEL_SENHA` do Netlify; banco em `ANALYTICS_DATABASE_URL`.
