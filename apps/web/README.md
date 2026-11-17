# Web (Next.js 14, App Router)

Telas da versão mínima (construídas em 17/11/2026):

- `/` — apresentação do TutorPass e links para as telas.
- `/login` — login da equipe contra `POST /api/auth/login` (a API usa o
  prefixo global `api`), com o fluxo de 2FA (`POST /api/auth/2fa/verify`)
  quando a API pede o código. O access token (15 min) fica em
  `sessionStorage`; o refresh token nunca passa pelo web (cookie httpOnly
  da API). Se a API estiver fora do ar, a tela mostra o erro sem travar.
- `/portaria` — fila de saída em tempo real pelo namespace Socket.io
  `/pickup` (eventos `queue.entry.created`, `queue.entry.status_changed`,
  `student.called`), com indicador de conexão e estado vazio amigável.
- `/telao` — telão/TV: colunas "Pronto para retirada" e "A caminho",
  letras grandes, mesmos dados da portaria.

## Rodar local

```bash
# na raiz do monorepo (pnpm) — ou `npm run dev` dentro de apps/web
pnpm --filter @tutorpass/web dev
```

Variável obrigatória (ver `.env.example` deste diretório):

- `NEXT_PUBLIC_API_URL` — origem da API, sem `/api` no fim
  (dev: `http://localhost:3333`).

## Deploy (Vercel)

1. Importar o repositório na Vercel.
2. **Root Directory: `apps/web`** (framework Next.js, detectado pelo
   `vercel.json` deste diretório).
3. Cadastrar `NEXT_PUBLIC_API_URL` com a URL pública da API
   (Railway/Render) **antes** do primeiro build — variável `NEXT_PUBLIC_*`
   é embutida no build; mudou, precisa rebuildar.
4. Deploy. Depois, colocar a URL final do web em `CORS_ORIGINS` na API e
   reiniciar o serviço da API.
