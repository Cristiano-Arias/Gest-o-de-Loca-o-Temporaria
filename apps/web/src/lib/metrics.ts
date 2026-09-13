// Cálculos do Painel — reproduzem fielmente as fórmulas do protótipo (pms.html).
// Tudo é calculado sob demanda a partir das listas que a API entrega.

export type ReservaMetrica = {
  kind: 'BOOKING' | 'BLOCK';
  status: string;
  propertyId: string;
  checkin: string; // AAAA-MM-DD
  checkout: string;
  noites: number;
  hospedes: number;
  valorBruto: number;
  valorLiquido: number;
  taxaPlataforma: number;
  plataforma: string;
};

export type CustoMetrica = {
  propertyId: string;
  data: string; // AAAA-MM-DD (1º dia do mês)
  categoria: string;
  valor: number;
};

export type ImovelMetrica = { id: string; nome: string };

const DIA = 86_400_000;

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function hojeDate(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
function addDias(dt: Date, n: number): Date {
  const x = new Date(dt);
  x.setDate(x.getDate() + n);
  return x;
}

export type PeriodoSel = 'mes' | '30' | '90' | '365' | 'ano' | 'tudo';

/**
 * Intervalo de datas do período escolhido.
 *
 * As janelas "30 / 90 / 365" olham para TRÁS (últimos N dias): indicador
 * financeiro mede o que já aconteceu. O que ainda vai acontecer aparece
 * separado, no cartão "Receita futura" e na faixa Concluída/Em andamento/Futura.
 *
 * "Este mês" e "Este ano" são o mês e o ano do calendário inteiros — incluem
 * dias que ainda não chegaram, e é justamente a faixa de situação que mostra
 * quanto daquilo já se realizou.
 */
export function periodoRange(
  periodo: PeriodoSel,
  reservas: ReservaMetrica[],
  custos: CustoMetrica[],
): [Date, Date] {
  const h = hojeDate();
  if (periodo === 'tudo') {
    const dts: number[] = [];
    reservas.forEach((r) => {
      dts.push(parseISO(r.checkin).getTime());
      dts.push(parseISO(r.checkout).getTime());
    });
    custos.forEach((c) => dts.push(parseISO(c.data).getTime()));
    if (!dts.length) return [new Date(h.getFullYear(), 0, 1), h];
    return [new Date(Math.min(...dts)), new Date(Math.max(...dts))];
  }
  if (periodo === 'mes') {
    return [
      new Date(h.getFullYear(), h.getMonth(), 1),
      new Date(h.getFullYear(), h.getMonth() + 1, 0),
    ];
  }
  if (periodo === 'ano') {
    return [new Date(h.getFullYear(), 0, 1), new Date(h.getFullYear(), 11, 31)];
  }
  return [addDias(h, -Number(periodo)), h];
}

// Data como 'DD/MM/AAAA' para mostrar ao usuário qual janela está valendo.
export function dataBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Reservas que FECHARAM dentro do período — o critério é o mês do check-out,
 * o mesmo que as plataformas usam para fechar o mês e o mesmo da tabela
 * mensal e do gráfico de receita.
 *
 * O critério anterior (qualquer reserva que "encostasse" no período, com o
 * valor inteiro) inflava os meses: uma estadia de 15/10 a 12/12 lançava a
 * receita cheia em outubro, novembro E dezembro. Somando os 12 meses do dono,
 * isso dava R$ 49 mil a mais — 34,8% de receita que não existia.
 *
 * Consequência assumida da regra: uma estadia que atravessa o período inteiro
 * (começou antes e termina depois) não entra na receita de nenhum mês do meio;
 * ela aparece no mês em que terminar. As noites dela, essas sim, continuam
 * contando na ocupação de cada mês — ocupação é sobre o calendário, não sobre
 * o fechamento.
 */
function reservasNoPeriodo(
  reservas: ReservaMetrica[],
  ini: Date,
  fim: Date,
  filtroImovel: string,
  incluirCancel: boolean,
): ReservaMetrica[] {
  return reservas.filter((r) => {
    const co = parseISO(r.checkout);
    return (
      r.kind === 'BOOKING' &&
      (incluirCancel || r.status !== 'CANCELADA') &&
      (!filtroImovel || r.propertyId === filtroImovel) &&
      co >= ini &&
      co <= fim
    );
  });
}

// Noites vendidas dentro da janela [ini, fim] (interseção).
function noitesNaJanela(r: ReservaMetrica, ini: Date, fim: Date): number {
  const a = parseISO(r.checkin) > ini ? parseISO(r.checkin) : ini;
  const b = parseISO(r.checkout) < fim ? parseISO(r.checkout) : fim;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / DIA));
}

export type Metricas = {
  receitaBruta: number;
  receitaLiquida: number;
  custos: number;
  custosLancamentos: number;
  lucro: number;
  margem: number;
  ocup: number;
  adr: number;
  revpar: number;
  ticket: number;
  estadia: number;
  nReservas: number;
  noitesVend: number;
  noitesDisp: number;
};

export function calcMetricas(
  reservas: ReservaMetrica[],
  custos: CustoMetrica[],
  totalImoveis: number,
  filtroImovel: string,
  ini: Date,
  fim: Date,
): Metricas {
  const res = reservasNoPeriodo(reservas, ini, fim, filtroImovel, false);
  const receitaBruta = res.reduce((s, r) => s + r.valorBruto, 0);
  const receitaLiquida = res.reduce((s, r) => s + r.valorLiquido, 0);

  const custosArr = custos.filter(
    (c) =>
      (!filtroImovel || c.propertyId === filtroImovel) &&
      parseISO(c.data) >= ini &&
      parseISO(c.data) <= fim,
  );
  const custosTotal = custosArr.reduce((s, c) => s + c.valor, 0);

  const lucro = receitaLiquida - custosTotal;
  const margem = receitaLiquida > 0 ? (lucro / receitaLiquida) * 100 : 0;

  const numImoveis = filtroImovel ? 1 : totalImoveis;
  const dias = Math.round((fim.getTime() - ini.getTime()) / DIA) + 1;
  const noitesDisp = numImoveis * dias;

  let noitesVend = 0;
  res.forEach((r) => {
    noitesVend += noitesNaJanela(r, ini, fim);
  });

  const ocup = noitesDisp > 0 ? (noitesVend / noitesDisp) * 100 : 0;
  // Diária média = receita das reservas fechadas ÷ as noites DELAS. Dividir
  // pela noitesVend (que é do calendário) misturaria dois conjuntos e daria
  // uma diária maior que a real.
  const noitesDasReservas = res.reduce((s, r) => s + r.noites, 0);
  const adr = noitesDasReservas > 0 ? receitaBruta / noitesDasReservas : 0;
  const revpar = noitesDisp > 0 ? receitaBruta / noitesDisp : 0;
  const ticket = res.length > 0 ? receitaBruta / res.length : 0;
  const estadia =
    res.length > 0 ? res.reduce((s, r) => s + r.noites, 0) / res.length : 0;

  return {
    receitaBruta,
    receitaLiquida,
    custos: custosTotal,
    custosLancamentos: custosArr.length,
    lucro,
    margem,
    ocup,
    adr,
    revpar,
    ticket,
    estadia,
    nReservas: res.length,
    noitesVend,
    noitesDisp,
  };
}

// Receita líquida do período separada por situação (somam a receitaLiquida).
// Concluída = FINALIZADA · Em andamento = HOSPEDADO · Futura = CONFIRMADA/PENDENTE.
export type ReceitaSituacao = {
  concluida: number;
  andamento: number;
  futura: number;
};

export function receitaPorSituacao(
  reservas: ReservaMetrica[],
  filtroImovel: string,
  ini: Date,
  fim: Date,
): ReceitaSituacao {
  // Mesmo conjunto dos KPIs: reservas que fecharam no período.
  const res = reservasNoPeriodo(reservas, ini, fim, filtroImovel, false);
  let concluida = 0;
  let andamento = 0;
  let futura = 0;
  for (const r of res) {
    if (r.status === 'FINALIZADA') concluida += r.valorLiquido;
    else if (r.status === 'HOSPEDADO') andamento += r.valorLiquido;
    else futura += r.valorLiquido; // CONFIRMADA, PENDENTE
  }
  return { concluida, andamento, futura };
}

// Receita futura: reservas confirmadas/pendentes com check-in a partir de amanhã.
export function calcFutura(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): number {
  const h = hojeDate();
  return reservas
    .filter(
      (r) =>
        r.kind === 'BOOKING' &&
        (r.status === 'CONFIRMADA' || r.status === 'PENDENTE') &&
        (!filtroImovel || r.propertyId === filtroImovel) &&
        parseISO(r.checkin) > h,
    )
    .reduce((s, r) => s + r.valorLiquido, 0);
}

// Anos que têm reservas ou custos (mais recente primeiro).
export function anosComDados(
  reservas: ReservaMetrica[],
  custos: CustoMetrica[],
  filtroImovel: string,
): number[] {
  const set = new Set<number>();
  reservas.forEach((r) => {
    if ((!filtroImovel || r.propertyId === filtroImovel) && r.kind === 'BOOKING')
      set.add(parseISO(r.checkin).getFullYear());
  });
  custos.forEach((c) => {
    if (!filtroImovel || c.propertyId === filtroImovel)
      set.add(parseISO(c.data).getFullYear());
  });
  return [...set].sort((a, b) => b - a);
}

export type LinhaRanking = {
  nome: string;
  rec: number;
  lucro: number;
  res: number;
  noites: number;
};

export function ranking(
  reservas: ReservaMetrica[],
  custos: CustoMetrica[],
  imoveis: ImovelMetrica[],
  filtroImovel: string,
): LinhaRanking[] {
  return imoveis
    .filter((p) => !filtroImovel || p.id === filtroImovel)
    .map((p) => {
      const res = reservas.filter(
        (r) =>
          r.kind === 'BOOKING' &&
          r.status !== 'CANCELADA' &&
          r.propertyId === p.id,
      );
      const rec = res.reduce((s, r) => s + r.valorLiquido, 0);
      const cus = custos
        .filter((c) => c.propertyId === p.id)
        .reduce((s, c) => s + c.valor, 0);
      const noites = res.reduce((s, r) => s + r.noites, 0);
      return { nome: p.nome, rec, lucro: rec - cus, res: res.length, noites };
    })
    .sort((a, b) => b.rec - a.rec);
}

// --- séries dos gráficos ----------------------------------------------

export type Mes12 = { ano: number; mes: number; label: string };

export function ultimos12(): Mes12[] {
  const arr: Mes12[] = [];
  const h = hojeDate();
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(h.getFullYear(), h.getMonth() - i, 1);
    arr.push({
      ano: dt.getFullYear(),
      mes: dt.getMonth(),
      label: dt
        .toLocaleDateString('pt-BR', { month: 'short' })
        .replace('.', ''),
    });
  }
  return arr;
}

function reservasAtivas(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): ReservaMetrica[] {
  return reservas.filter(
    (r) =>
      r.kind === 'BOOKING' &&
      r.status !== 'CANCELADA' &&
      (!filtroImovel || r.propertyId === filtroImovel),
  );
}

export function receitaPorMes(
  reservas: ReservaMetrica[],
  filtroImovel: string,
  meses: Mes12[],
): number[] {
  const ativas = reservasAtivas(reservas, filtroImovel);
  // Agrupado pelo mês de CHECK-OUT (como as plataformas contabilizam o mês).
  return meses.map((mm) =>
    ativas
      .filter((r) => {
        const c = parseISO(r.checkout);
        return c.getFullYear() === mm.ano && c.getMonth() === mm.mes;
      })
      .reduce((s, r) => s + r.valorLiquido, 0),
  );
}

export function receitaPorPlataforma(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): { label: string; valor: number }[] {
  const ativas = reservasAtivas(reservas, filtroImovel);
  const mapa = new Map<string, number>();
  ativas.forEach((r) => {
    const k = r.plataforma || 'Outra';
    mapa.set(k, (mapa.get(k) ?? 0) + r.valorLiquido);
  });
  return [...mapa.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function custosPorCategoria(
  custos: CustoMetrica[],
  filtroImovel: string,
): { categoria: string; valor: number }[] {
  const mapa = new Map<string, number>();
  custos
    .filter((c) => !filtroImovel || c.propertyId === filtroImovel)
    .forEach((c) =>
      mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.valor),
    );
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function ocupacaoPorMes(
  reservas: ReservaMetrica[],
  totalImoveis: number,
  filtroImovel: string,
  meses: Mes12[],
): number[] {
  const ativas = reservasAtivas(reservas, filtroImovel);
  const numImoveis = filtroImovel ? 1 : Math.max(totalImoveis, 1);
  return meses.map((mm) => {
    const diasMes = new Date(mm.ano, mm.mes + 1, 0).getDate();
    const ini = new Date(mm.ano, mm.mes, 1);
    const fim = new Date(mm.ano, mm.mes + 1, 0);
    let vend = 0;
    ativas.forEach((r) => {
      vend += noitesNaJanela(r, ini, fim);
    });
    return Math.min(100, (vend / (numImoveis * diasMes)) * 100);
  });
}

// --- Plataformas (KPIs por canal de venda) ----------------------------

// Cor de cada canal (espelha COR_PLAT do protótipo).
export const COR_PLAT: Record<string, string> = {
  Airbnb: '#e07a5f',
  'Booking.com': '#28727c',
  Direto: '#2f9e6f',
  Outra: '#e9a13b',
};

// Canais presentes nas reservas, na ordem Airbnb → Booking → Direto → Outra.
export function plataformasPresentes(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): string[] {
  const set = new Set<string>();
  reservas.forEach((r) => {
    if (r.kind === 'BOOKING' && (!filtroImovel || r.propertyId === filtroImovel))
      set.add(r.plataforma || 'Outra');
  });
  const ordem = ['Airbnb', 'Booking.com', 'Direto', 'Outra'];
  return [...set].sort((a, b) => {
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export type MetricasPlataforma = {
  plat: string;
  bruta: number;
  liquida: number;
  comissao: number;
  noites: number;
  reservas: number;
  adr: number;
  ticket: number;
  estadia: number;
  taxaEf: number;
  cancel: number;
  taxaCancel: number;
};

export function metricasPlataforma(
  reservas: ReservaMetrica[],
  plat: string,
  filtroImovel: string,
  ini: Date,
  fim: Date,
): MetricasPlataforma {
  const dentro = (r: ReservaMetrica) =>
    r.kind === 'BOOKING' &&
    (r.plataforma || 'Outra') === plat &&
    (!filtroImovel || r.propertyId === filtroImovel) &&
    parseISO(r.checkin) <= fim &&
    parseISO(r.checkout) >= ini;

  const res = reservas.filter((r) => dentro(r) && r.status !== 'CANCELADA');
  const bruta = res.reduce((s, r) => s + r.valorBruto, 0);
  const liquida = res.reduce((s, r) => s + r.valorLiquido, 0);
  const comissao = res.reduce((s, r) => s + r.taxaPlataforma, 0);

  let noites = 0;
  res.forEach((r) => {
    noites += noitesNaJanela(r, ini, fim);
  });

  const nReservas = res.length;
  const adr = noites > 0 ? bruta / noites : 0;
  const ticket = nReservas > 0 ? bruta / nReservas : 0;
  const estadia =
    nReservas > 0 ? res.reduce((s, r) => s + r.noites, 0) / nReservas : 0;
  const taxaEf = bruta > 0 ? (comissao / bruta) * 100 : 0;

  const cancel = reservas.filter(
    (r) => dentro(r) && r.status === 'CANCELADA',
  ).length;
  const taxaCancel =
    nReservas + cancel > 0 ? (cancel / (nReservas + cancel)) * 100 : 0;

  return {
    plat,
    bruta,
    liquida,
    comissao,
    noites,
    reservas: nReservas,
    adr,
    ticket,
    estadia,
    taxaEf,
    cancel,
    taxaCancel,
  };
}

// --- Desempenho mês a mês ---------------------------------------------

export type LinhaMes = {
  chave: string; // 'AAAA-MM'
  ano: number;
  mes: number; // 0-11
  reservas: number;
  porPlataforma: Record<string, number>; // nome do canal -> nº de reservas
  noites: number; // noites efetivamente dentro do mês (base da ocupação)
  noitesDisp: number; // noites disponíveis: imóveis × dias do mês
  noitesReservas: number; // soma das noites das reservas que fecharam no mês
  estadia: number; // média de noites das reservas do mês
  ocup: number; // % do mês ocupado
  receitaLiquida: number;
  comissao: number;
  custos: number;
  lucro: number;
};

/**
 * Uma linha por mês, do mais recente para o mais antigo, dentro da janela
 * escolhida. Duas contagens diferentes convivem aqui, de propósito:
 *
 *  - Reservas, receita e comissão entram no mês do CHECK-OUT, que é como as
 *    plataformas fecham o mês (e é o mesmo critério do gráfico de receita).
 *  - Noites e ocupação contam as noites que caíram DENTRO do mês, senão uma
 *    estadia de 58 noites inflaria um mês só.
 */
export function tabelaPorMes(
  reservas: ReservaMetrica[],
  custos: CustoMetrica[],
  totalImoveis: number,
  filtroImovel: string,
  ini: Date,
  fim: Date,
): LinhaMes[] {
  const ativas = reservasAtivas(reservas, filtroImovel);
  const numImoveis = filtroImovel ? 1 : Math.max(totalImoveis, 1);

  // Meses cobertos pela janela (do primeiro dia do mês de início ao fim).
  const linhas: LinhaMes[] = [];
  const cursor = new Date(ini.getFullYear(), ini.getMonth(), 1);
  while (cursor <= fim) {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth();
    const primeiro = new Date(ano, mes, 1);
    // Fim do mês como o PRIMEIRO DIA DO MÊS SEGUINTE (limite aberto). Usar o
    // último dia perderia a noite da virada: uma estadia de 28/01 a 03/02
    // contaria 3 noites em janeiro e 2 em fevereiro — 5 em vez de 6.
    const proximo = new Date(ano, mes + 1, 1);

    // Reservas cujo check-out caiu neste mês (e dentro da janela).
    const doMes = ativas.filter((r) => {
      const co = parseISO(r.checkout);
      return (
        co.getFullYear() === ano &&
        co.getMonth() === mes &&
        co >= ini &&
        co <= fim
      );
    });

    const porPlataforma: Record<string, number> = {};
    for (const r of doMes) {
      const canal = r.plataforma || 'Outra';
      porPlataforma[canal] = (porPlataforma[canal] ?? 0) + 1;
    }

    // Noites efetivamente dentro do mês (recorta a janela escolhida).
    const de = primeiro > ini ? primeiro : ini;
    const ate = proximo < fim ? proximo : fim;
    let noites = 0;
    ativas.forEach((r) => {
      noites += noitesNaJanela(r, de, ate);
    });

    const diasNaJanela = Math.round((ate.getTime() - de.getTime()) / DIA);
    const custosMes = custos
      .filter((c) => {
        const d = parseISO(c.data);
        return (
          (!filtroImovel || c.propertyId === filtroImovel) &&
          d.getFullYear() === ano &&
          d.getMonth() === mes
        );
      })
      .reduce((s, c) => s + c.valor, 0);

    const receitaLiquida = doMes.reduce((s, r) => s + r.valorLiquido, 0);
    const comissao = doMes.reduce((s, r) => s + r.taxaPlataforma, 0);

    linhas.push({
      chave: `${ano}-${String(mes + 1).padStart(2, '0')}`,
      ano,
      mes,
      reservas: doMes.length,
      porPlataforma,
      noites,
      noitesDisp: numImoveis * diasNaJanela,
      noitesReservas: doMes.reduce((s, r) => s + r.noites, 0),
      estadia: doMes.length
        ? doMes.reduce((s, r) => s + r.noites, 0) / doMes.length
        : 0,
      ocup:
        diasNaJanela > 0
          ? (noites / (numImoveis * diasNaJanela)) * 100
          : 0,
      receitaLiquida,
      comissao,
      custos: custosMes,
      lucro: receitaLiquida - custosMes,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Do mês mais recente para o mais antigo, escondendo meses totalmente vazios.
  return linhas
    .filter((l) => l.reservas > 0 || l.noites > 0 || l.custos !== 0)
    .reverse();
}

// --- Reservas futuras, mês a mês --------------------------------------

export type LinhaFuturo = {
  chave: string; // 'AAAA-MM'
  ano: number;
  mes: number; // 0-11
  reservas: number;
  porPlataforma: Record<string, number>;
  noites: number;
  receitaLiquida: number;
};

/**
 * O que já está contratado e ainda não começou, separado por mês de CHECK-IN
 * (é a pergunta "quem chega quando e quanto isso rende"). Não depende do
 * período escolhido no Painel: futuro é futuro.
 *
 * A soma da receita bate com o cartão "Receita futura", que usa o mesmo
 * critério: reservas confirmadas ou pendentes com check-in a partir de amanhã.
 */
export function futuroPorMes(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): LinhaFuturo[] {
  const h = hojeDate();
  const futuras = reservas.filter(
    (r) =>
      r.kind === 'BOOKING' &&
      (r.status === 'CONFIRMADA' || r.status === 'PENDENTE') &&
      (!filtroImovel || r.propertyId === filtroImovel) &&
      parseISO(r.checkin) > h,
  );

  const mapa = new Map<string, LinhaFuturo>();
  for (const r of futuras) {
    const ci = parseISO(r.checkin);
    const chave = `${ci.getFullYear()}-${String(ci.getMonth() + 1).padStart(2, '0')}`;
    let linha = mapa.get(chave);
    if (!linha) {
      linha = {
        chave,
        ano: ci.getFullYear(),
        mes: ci.getMonth(),
        reservas: 0,
        porPlataforma: {},
        noites: 0,
        receitaLiquida: 0,
      };
      mapa.set(chave, linha);
    }
    const canal = r.plataforma || 'Outra';
    linha.reservas += 1;
    linha.porPlataforma[canal] = (linha.porPlataforma[canal] ?? 0) + 1;
    linha.noites += r.noites;
    linha.receitaLiquida += r.valorLiquido;
  }

  // Do mês mais próximo para o mais distante.
  return [...mapa.values()].sort((a, b) => (a.chave < b.chave ? -1 : 1));
}

// --- Os três tempos: passado, mês atual, futuro -----------------------

export type Tempo = {
  receitaLiquida: number;
  reservas: number;
  noites: number;
};

export type TresTempos = {
  realizado: Tempo; // check-out antes deste mês
  atual: Tempo; // check-out dentro do mês corrente
  futuro: Tempo; // check-out depois deste mês
  mesAtualLabel: string;
};

/**
 * A leitura de cinco segundos do Painel, sempre pelo mesmo critério do resto
 * da tela: a reserva pertence ao mês em que ela TERMINA (check-out).
 * Não depende do período escolhido — são os três tempos do negócio.
 */
export function tresTempos(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): TresTempos {
  const h = hojeDate();
  const inicioMes = new Date(h.getFullYear(), h.getMonth(), 1);
  const fimMes = new Date(h.getFullYear(), h.getMonth() + 1, 0);

  const ativas = reservasAtivas(reservas, filtroImovel);
  const vazio = (): Tempo => ({ receitaLiquida: 0, reservas: 0, noites: 0 });
  const somar = (alvo: Tempo, r: ReservaMetrica) => {
    alvo.receitaLiquida += r.valorLiquido;
    alvo.reservas += 1;
    alvo.noites += r.noites;
  };

  const realizado = vazio();
  const atual = vazio();
  const futuro = vazio();
  for (const r of ativas) {
    const co = parseISO(r.checkout);
    if (co < inicioMes) somar(realizado, r);
    else if (co <= fimMes) somar(atual, r);
    else somar(futuro, r);
  }

  return {
    realizado,
    atual,
    futuro,
    mesAtualLabel: inicioMes.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    }),
  };
}

// --- Régua mensal agrupada por ano ------------------------------------

export type TotaisPeriodo = {
  reservas: number;
  porPlataforma: Record<string, number>;
  noites: number;
  noitesDisp: number;
  noitesReservas: number;
  estadia: number;
  ocup: number;
  receitaLiquida: number;
  comissao: number;
  custos: number;
  lucro: number;
};

export type BlocoAno = {
  ano: number;
  meses: LinhaMes[]; // em ordem cronológica
  total: TotaisPeriodo;
};

/**
 * Soma um conjunto de meses. Ocupação e estadia são RECALCULADAS a partir dos
 * denominadores — somar percentuais ou médias daria número errado.
 */
export function somarMeses(linhas: LinhaMes[]): TotaisPeriodo {
  const t: TotaisPeriodo = {
    reservas: 0,
    porPlataforma: {},
    noites: 0,
    noitesDisp: 0,
    noitesReservas: 0,
    estadia: 0,
    ocup: 0,
    receitaLiquida: 0,
    comissao: 0,
    custos: 0,
    lucro: 0,
  };
  for (const l of linhas) {
    t.reservas += l.reservas;
    for (const [canal, n] of Object.entries(l.porPlataforma)) {
      t.porPlataforma[canal] = (t.porPlataforma[canal] ?? 0) + n;
    }
    t.noites += l.noites;
    t.noitesDisp += l.noitesDisp;
    t.noitesReservas += l.noitesReservas;
    t.receitaLiquida += l.receitaLiquida;
    t.comissao += l.comissao;
    t.custos += l.custos;
    t.lucro += l.lucro;
  }
  t.estadia = t.reservas > 0 ? t.noitesReservas / t.reservas : 0;
  t.ocup = t.noitesDisp > 0 ? (t.noites / t.noitesDisp) * 100 : 0;
  return t;
}

// Agrupa a régua por ano, do ano mais recente para o mais antigo.
export function agruparPorAno(linhas: LinhaMes[]): BlocoAno[] {
  const mapa = new Map<number, LinhaMes[]>();
  for (const l of linhas) {
    const arr = mapa.get(l.ano);
    if (arr) arr.push(l);
    else mapa.set(l.ano, [l]);
  }
  return [...mapa.entries()]
    .map(([ano, meses]) => {
      const ordenados = [...meses].sort((a, b) => a.mes - b.mes);
      return { ano, meses: ordenados, total: somarMeses(ordenados) };
    })
    .sort((a, b) => b.ano - a.ano);
}

// --- Série do gráfico: 6 meses para trás, o atual e 6 para frente ------

export type PontoReceita = {
  label: string; // 'set/26'
  valor: number;
  tempo: 'passado' | 'atual' | 'futuro';
};

const MES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/**
 * Receita líquida por mês de check-out, de 6 meses atrás até 6 meses à frente.
 * O mês atual fica no meio e vem marcado, para a leitura ser imediata:
 * o que já entrou à esquerda, o que está contratado à direita.
 */
export function serieReceita6x6(
  reservas: ReservaMetrica[],
  filtroImovel: string,
): PontoReceita[] {
  const h = hojeDate();
  const ativas = reservasAtivas(reservas, filtroImovel);
  const pontos: PontoReceita[] = [];

  for (let i = -6; i <= 6; i++) {
    const dt = new Date(h.getFullYear(), h.getMonth() + i, 1);
    const ano = dt.getFullYear();
    const mes = dt.getMonth();
    const valor = ativas
      .filter((r) => {
        const co = parseISO(r.checkout);
        return co.getFullYear() === ano && co.getMonth() === mes;
      })
      .reduce((s, r) => s + r.valorLiquido, 0);
    pontos.push({
      label: `${MES_CURTO[mes]}/${String(ano).slice(2)}`,
      valor,
      tempo: i < 0 ? 'passado' : i === 0 ? 'atual' : 'futuro',
    });
  }
  return pontos;
}
