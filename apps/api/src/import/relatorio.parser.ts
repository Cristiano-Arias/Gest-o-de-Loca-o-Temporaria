/**
 * Leitura dos relatórios do Airbnb e do Booking.
 *
 * Este arquivo NÃO fala com o banco de dados de propósito: ele só transforma
 * as linhas do arquivo em reservas. Isso permite testar a leitura sozinha,
 * com um relatório de verdade, sem gravar nada.
 *
 * O objetivo é ser tolerante a mudanças: as plataformas renomeiam colunas e
 * trocam o formato das datas sem avisar. Por isso aqui nada é fixo —
 * os nomes de coluna são procurados por uma lista de apelidos e o formato da
 * data é descoberto a partir dos próprios dados.
 */

export type NomePlataforma = 'Airbnb' | 'Booking.com';

// Uma reserva lida do relatório (ainda sem vínculo com o banco).
export type ReservaLida = {
  plataforma: NomePlataforma;
  codigo: string;
  hospedeNome: string;
  hospedeTel: string | null;
  textoImovel: string;
  checkin: string; // AAAA-MM-DD
  checkout: string; // AAAA-MM-DD
  noites: number;
  hospedes: number | null; // null = o relatório não informou
  valorBruto: number;
  taxaPlataforma: number;
  taxaLimpeza: number | null; // null = o relatório não informou
  valorLiquido: number;
  cancelada: boolean;
  linhasDoRelatorio: number; // quantas linhas do arquivo formaram esta reserva
};

export type LeituraRelatorio = {
  plataforma: NomePlataforma;
  reservas: ReservaLida[];
  ignoradas: number;
  formatoData: 'MDY' | 'DMY';
  avisos: string[];
};

// --- normalização de texto -----------------------------------------------

/**
 * Deixa o nome da coluna comparável: sem acentos, sem maiúsculas e sem
 * espaços sobrando. Assim "Código de Confirmação", "Codigo de confirmacao" e
 * "CÓDIGO DE CONFIRMAÇÃO" são tratados como a mesma coluna.
 */
export function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .replace(/[\u00ba\u00b0]/g, 'o') // "Nº" vira "no"
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove os acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// --- apelidos das colunas -------------------------------------------------

// Cada campo tem vários nomes possíveis: os do relatório novo, os do antigo e
// os em inglês. Basta um deles existir no arquivo.
const COLUNAS_AIRBNB = {
  tipo: ['tipo', 'type'],
  codigo: ['codigo de confirmacao', 'confirmation code'],
  inicio: ['data de inicio', 'start date', 'data de check-in'],
  fim: ['data de termino', 'end date', 'data de check-out'],
  noites: ['noites', 'no de noites', 'nights'],
  hospede: ['hospede', 'nome do hospede', 'guest name'],
  anuncio: ['anuncio', 'listing'],
  telefone: ['entrar em contato', 'contato', 'telefone', 'phone'],
  status: ['status'],
  // Dinheiro — relatório novo:
  valor: ['valor', 'amount'],
  ganhosBrutos: ['ganhos brutos', 'gross earnings'],
  taxaServico: ['taxa de servico', 'host service fee', 'service fee'],
  taxaLimpeza: ['taxa de limpeza', 'cleaning fee'],
  // Dinheiro — relatório antigo (já vinha líquido):
  ganhos: ['ganhos', 'earnings'],
  adultos: ['no de adultos', 'adultos', 'adults'],
  criancas: ['no de criancas', 'criancas', 'children'],
  bebes: ['no de bebes', 'bebes', 'infants'],
} as const;

const COLUNAS_BOOKING = {
  codigo: ['numero da reserva', 'numero de reserva', 'book number'],
  unidade: ['tipo de unidade', 'nome da propriedade', 'unit type', 'propriedade'],
  entrada: ['entrada', 'chegada', 'check-in', 'checkin', 'arrival'],
  saida: ['saida', 'check-out', 'checkout', 'departure'],
  hospede: [
    'nome(s) do(s) hospede(s)',
    'nomes dos hospedes',
    'reservado por',
    'nome de quem fez a reserva',
    'hospede',
    'guest name',
  ],
  telefone: ['telefone', 'phone'],
  status: ['status'],
  preco: ['preco', 'pagamento total', 'valor total', 'total', 'price'],
  comissao: ['valor da comissao', 'comissao', 'commission amount'],
  pessoas: ['pessoas', 'hospedes', 'guests'],
  duracao: ['duracao (diarias)', 'duracao', 'noites', 'nights'],
} as const;

/**
 * Localiza, no cabeçalho, a posição de cada campo. Devolve uma função que lê
 * o campo de uma linha — se a coluna não existir no arquivo, devolve ''.
 */
function criarLeitor(
  cabecalho: string[],
  apelidos: Record<string, readonly string[]>,
) {
  const normalizado = cabecalho.map(normalizar);
  const posicao = new Map<string, number>();

  for (const [campo, nomes] of Object.entries(apelidos)) {
    for (const nome of nomes) {
      const i = normalizado.indexOf(normalizar(nome));
      if (i > -1) {
        posicao.set(campo, i);
        break;
      }
    }
  }

  const ler = (linha: string[], campo: string): string => {
    const i = posicao.get(campo);
    if (i === undefined) return '';
    return String(linha[i] ?? '').trim();
  };
  const existe = (campo: string) => posicao.has(campo);
  return { ler, existe };
}

// --- números e datas ------------------------------------------------------

/**
 * Número no padrão brasileiro ou americano: "1.234,56" e "1234.56" viram
 * 1234.56. Mantém o sinal negativo (ajustes e estornos vêm negativos).
 */
export function parseNumero(valor: unknown): number {
  if (valor == null) return 0;
  let t = String(valor)
    .replace(/ /g, ' ')
    .replace(/R\$|BRL|USD|\$/gi, '')
    .trim();
  if (t === '') return 0;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[()]/g, '');
  // Com vírgula presente, ela é o separador decimal (padrão brasileiro).
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  t = t.replace(/[^0-9.]/g, '');
  const n = parseFloat(t);
  if (!isFinite(n)) return 0;
  return negativo ? -Math.abs(n) : n;
}

/**
 * Descobre se as datas do arquivo estão em DD/MM/AAAA (brasileiro) ou
 * MM/DD/AAAA (americano). A pista é simples: se em ALGUMA linha o segundo
 * número passa de 12, ele só pode ser o dia — logo o arquivo é americano.
 * Se o primeiro número passa de 12, é brasileiro.
 *
 * Quando nenhum passa de 12 (arquivo pequeno e ambíguo), usa a coluna de
 * noites como desempate: testa os dois jeitos e fica com o que faz a conta
 * de noites bater mais vezes.
 */
export function detectarFormatoData(
  amostras: Array<{ inicio: string; fim: string; noites: number }>,
): 'MDY' | 'DMY' {
  let maiorPrimeiro = 0;
  let maiorSegundo = 0;

  const partes = (s: string) => s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);

  for (const a of amostras) {
    for (const campo of [a.inicio, a.fim]) {
      const m = partes(campo);
      if (!m) continue;
      maiorPrimeiro = Math.max(maiorPrimeiro, Number(m[1]));
      maiorSegundo = Math.max(maiorSegundo, Number(m[2]));
    }
  }

  if (maiorSegundo > 12 && maiorPrimeiro <= 12) return 'MDY';
  if (maiorPrimeiro > 12 && maiorSegundo <= 12) return 'DMY';

  // Desempate pela coluna de noites.
  let acertosMDY = 0;
  let acertosDMY = 0;
  for (const a of amostras) {
    if (!a.noites) continue;
    const i = partes(a.inicio);
    const f = partes(a.fim);
    if (!i || !f) continue;
    const noitesEntre = (mes1: number, dia1: number, mes2: number, dia2: number) =>
      Math.round(
        (Date.UTC(Number(f[3]), mes2 - 1, dia2) -
          Date.UTC(Number(i[3]), mes1 - 1, dia1)) /
          86_400_000,
      );
    if (noitesEntre(+i[1], +i[2], +f[1], +f[2]) === a.noites) acertosMDY++;
    if (noitesEntre(+i[2], +i[1], +f[2], +f[1]) === a.noites) acertosDMY++;
  }
  if (acertosMDY > acertosDMY) return 'MDY';
  return 'DMY';
}

/**
 * Converte a data para AAAA-MM-DD. Aceita ISO, DD/MM/AAAA, MM/DD/AAAA,
 * "17 de maio de 2019" e o número serial do Excel.
 */
export function parseData(valor: unknown, formato: 'MDY' | 'DMY'): string | null {
  if (valor == null || valor === '') return null;
  const t = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);

  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const mes = formato === 'MDY' ? Number(m[1]) : Number(m[2]);
    const dia = formato === 'MDY' ? Number(m[2]) : Number(m[1]);
    let ano = Number(m[3]);
    if (ano < 100) ano += ano < 70 ? 2000 : 1900;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  const meses: Record<string, number> = {
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const porExtenso = normalizar(t).match(/^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (porExtenso) {
    const mes = meses[porExtenso[2]];
    if (mes) {
      return `${porExtenso[3]}-${String(mes).padStart(2, '0')}-${porExtenso[1].padStart(2, '0')}`;
    }
  }

  // Serial do Excel (dias desde 30/12/1899).
  if (/^\d+(\.\d+)?$/.test(t)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + parseFloat(t) * 86_400_000);
    if (!isNaN(dt.getTime())) {
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
  }
  return null;
}

function noitesEntre(inicio: string, fim: string): number {
  return Math.round(
    (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) /
      86_400_000,
  );
}

// --- identificação da plataforma ------------------------------------------

export function detectarPlataforma(cabecalho: string[]): NomePlataforma | null {
  const linha = cabecalho.map(normalizar);
  const tem = (nomes: readonly string[]) =>
    nomes.some((n) => linha.includes(normalizar(n)));

  if (tem(COLUNAS_AIRBNB.codigo) || tem(COLUNAS_AIRBNB.anuncio)) return 'Airbnb';
  if (tem(COLUNAS_BOOKING.codigo) || tem(COLUNAS_BOOKING.unidade))
    return 'Booking.com';
  return null;
}

// --- leitura principal ----------------------------------------------------

export function lerRelatorio(linhas: string[][]): LeituraRelatorio {
  if (!linhas?.length) {
    throw new Error('arquivo vazio');
  }
  const cabecalho = linhas[0].map((c) => String(c ?? '').trim());
  const plataforma = detectarPlataforma(cabecalho);
  if (!plataforma) {
    throw new Error('formato não reconhecido (não parece Airbnb nem Booking)');
  }
  const corpo = linhas
    .slice(1)
    .filter((l) => l && l.some((c) => String(c ?? '').trim() !== ''));

  return plataforma === 'Airbnb'
    ? lerAirbnb(cabecalho, corpo)
    : lerBooking(cabecalho, corpo);
}

/**
 * Airbnb. O relatório novo é um EXTRATO FINANCEIRO, não uma lista de reservas:
 *  - a coluna "Tipo" diz o que é cada linha (Reserva, Payout, Ajuste...);
 *  - as linhas "Payout" são repasses ao banco e não viram reserva;
 *  - a MESMA reserva aparece em várias linhas (uma por repasse) — os valores
 *    precisam ser SOMADOS, senão a receita fica menor do que a real.
 * O relatório antigo (uma linha por reserva) continua funcionando: sem a
 * coluna "Tipo", cada código simplesmente tem uma linha só.
 */
function lerAirbnb(cabecalho: string[], corpo: string[][]): LeituraRelatorio {
  const { ler, existe } = criarLeitor(cabecalho, COLUNAS_AIRBNB);
  const avisos: string[] = [];
  let ignoradas = 0;

  const formatoData = detectarFormatoData(
    corpo.map((l) => ({
      inicio: ler(l, 'inicio'),
      fim: ler(l, 'fim'),
      noites: Number(ler(l, 'noites')) || 0,
    })),
  );

  // Agrupa as linhas pelo código da reserva.
  const grupos = new Map<string, string[][]>();
  for (const linha of corpo) {
    const tipo = normalizar(ler(linha, 'tipo'));
    // Repasse para a conta bancária: não é reserva.
    if (tipo === 'payout' || tipo === 'pagamento') continue;

    const codigo = ler(linha, 'codigo');
    if (!codigo) {
      ignoradas++;
      continue;
    }
    const atual = grupos.get(codigo);
    if (atual) atual.push(linha);
    else grupos.set(codigo, [linha]);
  }

  const temColunaValor = existe('valor');
  const reservas: ReservaLida[] = [];

  for (const [codigo, linhasDoGrupo] of grupos) {
    // A linha "Reserva" é a que traz datas, hóspede e anúncio confiáveis.
    const linhaReserva =
      linhasDoGrupo.find((l) => normalizar(ler(l, 'tipo')) === 'reserva') ??
      (existe('tipo') ? undefined : linhasDoGrupo[0]);
    const base = linhaReserva ?? linhasDoGrupo[0];

    const checkin = parseData(ler(base, 'inicio'), formatoData);
    const checkout = parseData(ler(base, 'fim'), formatoData);
    if (!checkin || !checkout || noitesEntre(checkin, checkout) <= 0) {
      ignoradas += linhasDoGrupo.length;
      avisos.push(`${codigo}: datas ausentes ou inválidas — pulada.`);
      continue;
    }

    // Soma o dinheiro de TODAS as linhas do código (repasses, ajustes,
    // taxas de cancelamento e estornos — inclusive os negativos).
    let liquido = 0;
    let taxa = 0;
    let bruto = 0;
    let somaGanhosBrutos = 0;
    let limpeza = 0;
    for (const l of linhasDoGrupo) {
      liquido += temColunaValor
        ? parseNumero(ler(l, 'valor'))
        : parseNumero(ler(l, 'ganhos'));
      taxa += parseNumero(ler(l, 'taxaServico'));
      somaGanhosBrutos += parseNumero(ler(l, 'ganhosBrutos'));
      limpeza += parseNumero(ler(l, 'taxaLimpeza'));
    }
    // O bruto é sempre líquido + comissão, para que as três contas fechem
    // entre si (mesma regra do Booking). A coluna "Ganhos brutos" do Airbnb
    // não fecha: ela já desconta impostos e taxas que o relatório não detalha.
    // No relatório antigo não havia comissão, então bruto = líquido — que é
    // exatamente a regra do protótipo.
    bruto = liquido + taxa;
    if (bruto === 0) bruto = somaGanhosBrutos;

    const hospedes =
      (Number(ler(base, 'adultos')) || 0) +
        (Number(ler(base, 'criancas')) || 0) +
        (Number(ler(base, 'bebes')) || 0) || null;

    const statusTexto = ler(base, 'status');
    // Código sem nenhuma linha "Reserva" (só taxa de cancelamento/estorno)
    // significa reserva cancelada.
    const cancelada =
      /cancel/i.test(statusTexto) || (existe('tipo') && !linhaReserva);

    reservas.push({
      plataforma: 'Airbnb',
      codigo,
      hospedeNome: ler(base, 'hospede'),
      hospedeTel: ler(base, 'telefone') || null,
      textoImovel: ler(base, 'anuncio'),
      checkin,
      checkout,
      noites: Number(ler(base, 'noites')) || noitesEntre(checkin, checkout),
      hospedes,
      valorBruto: arredondar(bruto),
      taxaPlataforma: arredondar(taxa),
      taxaLimpeza: existe('taxaLimpeza') ? arredondar(limpeza) : null,
      valorLiquido: arredondar(liquido),
      cancelada,
      linhasDoRelatorio: linhasDoGrupo.length,
    });
  }

  return { plataforma: 'Airbnb', reservas, ignoradas, formatoData, avisos };
}

/**
 * Booking. Uma linha por reserva; o líquido é preço − comissão.
 */
function lerBooking(cabecalho: string[], corpo: string[][]): LeituraRelatorio {
  const { ler, existe } = criarLeitor(cabecalho, COLUNAS_BOOKING);
  const avisos: string[] = [];
  let ignoradas = 0;

  const formatoData = detectarFormatoData(
    corpo.map((l) => ({
      inicio: ler(l, 'entrada'),
      fim: ler(l, 'saida'),
      noites: Number(ler(l, 'duracao')) || 0,
    })),
  );

  const reservas: ReservaLida[] = [];
  for (const linha of corpo) {
    const checkin = parseData(ler(linha, 'entrada'), formatoData);
    const checkout = parseData(ler(linha, 'saida'), formatoData);
    if (!checkin || !checkout || noitesEntre(checkin, checkout) <= 0) {
      ignoradas++;
      continue;
    }
    const preco = parseNumero(ler(linha, 'preco'));
    const comissao = parseNumero(ler(linha, 'comissao'));

    reservas.push({
      plataforma: 'Booking.com',
      codigo: ler(linha, 'codigo'),
      hospedeNome: ler(linha, 'hospede'),
      hospedeTel: ler(linha, 'telefone') || null,
      textoImovel: ler(linha, 'unidade'),
      checkin,
      checkout,
      noites: Number(ler(linha, 'duracao')) || noitesEntre(checkin, checkout),
      hospedes: Number(ler(linha, 'pessoas')) || null,
      valorBruto: arredondar(preco),
      taxaPlataforma: arredondar(comissao),
      taxaLimpeza: null,
      valorLiquido: arredondar(preco - comissao),
      cancelada: /cancel/i.test(ler(linha, 'status')),
      linhasDoRelatorio: 1,
    });
  }

  void existe;
  return { plataforma: 'Booking.com', reservas, ignoradas, formatoData, avisos };
}

function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}
