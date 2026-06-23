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

// Intervalo de datas do período selecionado (espelha periodoRange()).
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
  return [h, addDias(h, Number(periodo))];
}

function reservasNoPeriodo(
  reservas: ReservaMetrica[],
  ini: Date,
  fim: Date,
  filtroImovel: string,
  incluirCancel: boolean,
): ReservaMetrica[] {
  return reservas.filter(
    (r) =>
      r.kind === 'BOOKING' &&
      (incluirCancel || r.status !== 'CANCELADA') &&
      (!filtroImovel || r.propertyId === filtroImovel) &&
      parseISO(r.checkin) <= fim &&
      parseISO(r.checkout) >= ini,
  );
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
  const adr = noitesVend > 0 ? receitaBruta / noitesVend : 0;
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
  return meses.map((mm) =>
    ativas
      .filter((r) => {
        const c = parseISO(r.checkin);
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
