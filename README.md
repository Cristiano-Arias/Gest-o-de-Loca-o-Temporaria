# C. Arias — SaaS de Gestão de Locação por Temporada

Transformação do protótipo `pms.html` em um SaaS multiusuário na nuvem.
Este repositório é um **monorepo** (uma pasta-mãe com dois aplicativos dentro).

## Estrutura

```
.
├── apps/
│   ├── web/   → o site que o usuário vê (Next.js + Tailwind)
│   └── api/   → o "cérebro" / API + banco de dados (NestJS + Prisma)
├── pms.html        → protótipo (especificação visual e de regras)
├── ARQUITETURA.md  → blueprint técnico
└── apps/api/prisma/schema.prisma → modelo do banco de dados
```

## Fase A — Fundação (atual)

Esta fase entrega o "esqueleto": site + API + banco + login (Supabase Auth com
**Entrar com Google** e **link mágico por email**) e uma página de painel
protegida ("Olá, mundo").

### Pré-requisitos

- Node 20+ e **pnpm** (`npm i -g pnpm`)
- Docker (para o banco PostgreSQL local) **ou** uma conta Supabase

### Passo a passo (resumo)

1. Instalar as dependências (na raiz):
   ```bash
   pnpm install
   ```
2. Banco de dados local (opcional, se ainda não usar Supabase):
   ```bash
   docker run --name carias-db -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=carias -p 5432:5432 -d postgres:16
   ```
3. Configurar variáveis:
   - Copie `apps/api/.env.example` → `apps/api/.env`
   - Copie `apps/web/.env.local.example` → `apps/web/.env.local`
4. Criar as tabelas no banco:
   ```bash
   pnpm db:migrate
   ```
5. Rodar tudo:
   ```bash
   pnpm dev
   ```
   - Site: http://localhost:3000
   - API: http://localhost:3333/health

> As chaves do Supabase (login) e do Google são configuradas depois — o app
> sobe e mostra um aviso amigável enquanto elas não existem.

## Próximas fases

- **B** — Paridade com o protótipo (Imóveis → Reservas → Custos → Agenda → Painel → Plataformas)
- **C** — Importador de relatórios Airbnb/Booking no backend
- **D** — Nuvem (deploy) e contas reais
- **E** — WhatsApp + extração por IA
- **F** — Sincronização de canais (iCal/e-mail)
