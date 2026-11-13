# CLAUDE.md — Construção do SaaS "C. Arias" (Gestão de Temporada)

> Lido automaticamente pelo Claude Code. Define o que construir, em que ordem e como.
> Objetivo: transformar o protótipo validado (`pms.html`) em um SaaS multiusuário na nuvem.

## Ponto de partida (muito importante)

O arquivo **`pms.html`** nesta pasta é a **especificação funcional e visual definitiva** do produto.
Ele é um app de página única, já testado com dados reais, que contém TODAS as regras de
negócio, cálculos, telas, cores e comportamentos esperados. **Antes de construir qualquer
módulo do SaaS, leia o `pms.html` e reproduza o comportamento dele fielmente.**

Documentos de apoio:
- `ARQUITETURA.md` — blueprint técnico (componentes, APIs, fluxo WhatsApp, fórmulas).
- `prisma/schema.prisma` — modelo de dados (base do banco do SaaS).
- Arquivos `*.ts` (se presentes) — implementações de referência de webhook/serviços.

## Quem conduz

O dono do projeto **não é programador**. Portanto:
- Explique cada passo em português simples; defina termos técnicos em uma linha.
- Antes de rodar comandos ou instalar coisas, diga o que aquilo faz.
- Ao fim de cada etapa, diga **como testar** e **pare para confirmação** antes de seguir.
- Não assuma conhecimento de terminal, Git, banco de dados, nuvem ou deploy.

## O que "virar SaaS" adiciona em relação ao protótipo

O protótipo guarda dados no navegador (um dispositivo). O SaaS precisa de:
1. **Login/contas** (autenticação) — cada usuário acessa o seu.
2. **Banco na nuvem** (PostgreSQL gerenciado) — dados acessíveis de qualquer dispositivo.
3. **Multi-tenant** — todo dado pertence a um usuário/organização; nunca vazar entre contas.
4. **Backend (API)** — a lógica que hoje roda no navegador passa a rodar no servidor.
5. **Armazenamento de arquivos** (comprovantes/anexos) na nuvem.
6. **Deploy/hospedagem** — o app no ar, com URL própria, acessível pelo celular e PC.
7. (Depois) **WhatsApp e leitura de anexos por IA** — conforme `ARQUITETURA.md`.

## Stack (decidida — não trocar sem avisar)

- Frontend: Next.js + React + TypeScript + Tailwind CSS + shadcn/ui (replicando o visual do `pms.html`: fontes Fraunces + Inter, paleta litorânea, marca "C. Arias").
- Backend: NestJS (TypeScript) + Prisma ORM.
- Banco: PostgreSQL (local com Docker no início; depois Supabase ou Neon).
- Auth: usar a solução mais simples e estável (ex.: Supabase Auth ou Auth.js). Sugira e explique.
- Fila assíncrona (a partir da fase de WhatsApp/anexos): BullMQ + Redis.
- IA (intenção e extração): API da Anthropic.
- WhatsApp: Meta WhatsApp Cloud API.
- Hospedagem: Vercel (frontend) + Render/Railway (backend) + Supabase/Neon (banco).

## Funcionalidades a reproduzir do protótipo (paridade obrigatória)

Reproduza exatamente, lendo o `pms.html` para os detalhes de cálculo e layout:

1. **Imóveis** — cadastro (nome, endereço, capacidade, check-in/out padrão, taxa de limpeza,
   plataformas vinculadas, custos fixos mensais, observações).
2. **Reservas** — criar/editar/excluir reserva e bloqueio; cálculo de noites e valor líquido;
   detecção de conflito de datas; cards de **receita futura contratada por imóvel e total (ambas)**.
3. **Importação Airbnb/Booking** — ver a seção "Formatos dos relatórios" abaixo antes
   de mexer em `apps/api/src/import/relatorio.parser.ts`.
   - Mapear imóvel por palavras-chave; idempotência por (plataforma, código); detectar overbooking.
   - No SaaS, fazer esse parsing **no backend** (upload do arquivo → API processa → grava).
4. **Agenda** — calendário mensal; próximos check-ins/check-outs mostrando check-in, check-out,
   nº de hóspedes e telefone; botão para **editar** a reserva a partir da agenda.
5. **Custos** — lançamentos **por mês** (sem dia de vencimento), categoria, valor, descrição,
   status de pagamento; filtros; inclui categoria **Gás**.
6. **Custos fixos** — modelos recorrentes por imóvel (categoria + valor mensal, **sem dia**);
   botão "lançar custos fixos do mês" (idempotente por mês); status "lançado no mês".
7. **Painel** — KPIs (receita líquida, custos, lucro, margem, ocupação, ADR, RevPAR, ticket,
   receita futura) com seletor de período incluindo **"Desde o início"**; gráficos; ranking de
   imóveis; **tabela "Desempenho por ano"** com todas as métricas por ano.
8. **Plataformas** — KPIs comparativos por canal (Airbnb/Booking/Direto): receita líquida,
   comissão paga e taxa efetiva, reservas, noites, ADR, ticket, estadia, cancelamentos; tabela + gráficos.
9. **Regra do líquido** — Booking: líquido = preço − comissão. Airbnb: usa "Ganhos" (já líquido),
   comissão = 0, bruto = líquido. Manter esse comportamento.

## Formatos dos relatórios (NÃO assumir nada aqui)

Airbnb e Booking exportam **vários relatórios diferentes**, com nomes de coluna e
formatos de data distintos, e mudam isso sem avisar. Toda vez que alguém assumiu um
formato fixo, a importação quebrou. Regra: **descobrir dos dados, nunca fixar.**

Variantes já encontradas em arquivos reais:

| Plataforma | Relatório | Datas | Particularidades |
|---|---|---|---|
| Airbnb | Reservas (histórico) | DD/MM/AAAA | tem `Status`; `Ganhos` já é líquido; `Nome do hóspede`, `Nº de noites`, `Nº de adultos` |
| Airbnb | Transações / pagamentos | **MM/DD/AAAA** | **não tem `Status`**; `Hóspede`, `Noites`, `Valor` (líquido), `Ganhos brutos`, `Taxa de serviço`; a mesma reserva aparece em **várias linhas** (uma por repasse) — somar; linhas `Payout` não são reserva |
| Booking | Reservas por período | por extenso, `31 de maio, 2026` | colunas `Chegada` / **`Partida`** / **`Estado`** (OK ou Cancelada); comissão zerada nas canceladas |
| Booking | variante antiga | `17 de maio de 2019` | colunas `Entrada` / `Saída` / `Status` |

Consequências que o parser já trata e que não podem regredir:

- **Formato de data é detectado, não assumido** (`detectarFormatoData`): se em alguma
  linha o 2º número passa de 12, o arquivo é americano; se o 1º passa, é brasileiro;
  se tudo for ambíguo, desempata pela coluna de noites. Um arquivo MM/DD lido como
  DD/MM troca dia por mês **silenciosamente** quando ambos são ≤ 12 (12/01 vira 1º de
  dezembro em vez de 12 de janeiro). É o pior erro possível aqui: não dá exceção.
- **Toda data passa por `montarData`**, que remonta e compara — assim 31/09 e 29/02 de
  ano não bissexto são recusados em vez de virar `Invalid Date` no Prisma.
- **Nomes de coluna vêm de listas de apelidos** (`COLUNAS_AIRBNB` / `COLUNAS_BOOKING`).
  Ao encontrar uma variante nova, **acrescente o apelido** — não troque o existente.
- **Status é financeiro, não cosmético.** Sem ler `Estado`/`Status`, reserva cancelada
  entra como receita. Num único relatório real isso dava R$ 84.708,24 de receita falsa
  e um alarme falso de overbooking.
- **Linha descartada tem que dizer por quê**, com linha e valor bruto, em `avisos`.
  "Ignoradas: 52" sem explicação não é diagnóstico.

Como testar uma mudança no parser: importe os dois relatórios reais e confira que
nenhuma linha vira "ignorada" sem aviso, que o total de canceladas bate com o arquivo
e que as datas conferem com o que a plataforma mostra na tela.

## Princípio de construção: incremental e testável

Não construa tudo de uma vez. Siga as fases abaixo. Ao fim de cada fase deve haver algo
que a pessoa consegue abrir e ver funcionando. Comece pelo que roda **localmente** antes de
publicar na nuvem.

### Fase A — Fundação local
Monorepo (`apps/web` Next.js, `apps/api` NestJS), Postgres local via Docker, aplicar
`schema.prisma`, autenticação básica, "olá mundo" no ar localmente. Teste: abrir o site local logado.

### Fase B — Paridade com o protótipo (sem nuvem ainda)
Reproduzir, na ordem: Imóveis → Reservas (+ bloqueios + cards de futuro) → Custos → Custos fixos
→ Agenda → Painel → Plataformas. Usar `pms.html` como referência de tela e cálculo.
Teste: cadastrar/importar dados e conferir que os números batem com o protótipo.

### Fase C — Importador no backend
Upload dos relatórios Airbnb/Booking → API faz o parsing (mesmas regras do protótipo) →
grava com idempotência. Teste: subir os mesmos 3 arquivos e ver 65 reservas, sem duplicar.

### Fase D — Nuvem (vira SaaS de fato)
Migrar banco para Supabase/Neon, deploy do frontend (Vercel) e backend (Render/Railway),
armazenamento de anexos, contas reais. Teste: acessar pelo celular e pelo PC com o mesmo login.

### Fase E — WhatsApp (texto, áudio e arquivos) + extração por IA
Webhook Meta Cloud API recebendo TRÊS tipos de entrada do operador:
- **Texto** → roteador de intenção (LLM) → lançar reserva/custo/bloqueio ou responder consultas.
- **Áudio** → baixar o áudio → transcrever (ex.: Whisper, PT-BR) → passar o texto pelo mesmo roteador de intenção.
- **Arquivos** → baixar a mídia →
    · relatórios estruturados (CSV Airbnb / XLS Booking) = importador determinístico da Fase C;
    · prints / PDFs / recibos = extração por IA de visão (campos + confiança).
Para áudio e imagens, SEMPRE confirmar os campos extraídos antes de gravar
("Confirma: Gás, Wai Wai, R$120, julho? Sim/Não"). Estado de conversa para o loop de confirmação.
Alertas proativos (fora de 24h) usam templates aprovados pela Meta. Seguir `ARQUITETURA.md`.

### Fase F — Sincronização de canais
iCal (Airbnb/Booking) e parsing de e-mail de confirmação.

## Convenções

- Multi-tenant sempre: toda query filtra pelo usuário/organização dono do dado.
- Segredos (chaves, senha do banco) em `.env`, nunca no código.
- Reservas idempotentes por (plataforma, código). Métricas calculadas sob demanda.
- Custos por mês (data = primeiro dia do mês de referência).
- Manter a identidade visual do protótipo (marca "C. Arias", fontes, paleta).

## Como pedir as coisas

A pessoa dirá, por exemplo: "vamos começar a Fase A" ou "agora a tela de Reservas".
Construa só aquilo, leia o `pms.html` para os detalhes, explique como testar e espere confirmação.
