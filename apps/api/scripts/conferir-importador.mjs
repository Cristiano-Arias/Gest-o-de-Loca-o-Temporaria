/**
 * Confere a leitura dos relatórios sem mexer no banco de dados.
 *
 * Como rodar (depois de "pnpm --filter @c-arias/api build"):
 *   node apps/api/scripts/conferir-importador.mjs [caminho-de-um-relatorio.csv]
 *
 * Sem argumento, roda só os casos de teste embutidos. Com um arquivo, mostra
 * também o que SERIA importado dele — útil para conferir um relatório novo
 * antes de subir no sistema de verdade.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const { lerRelatorio } = require(join(aqui, '../dist/import/relatorio.parser.js'));

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

let passou = 0, falhou = 0;
function conferir(oque, esperado, obtido) {
  const ok = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`  ${ok ? '✓' : '✗'} ${oque}` + (ok ? '' : `\n      esperado: ${JSON.stringify(esperado)}\n      obtido:   ${JSON.stringify(obtido)}`));
  ok ? passou++ : falhou++;
}

// --- caso 1: relatório NOVO do Airbnb (extrato, datas MM/DD, linhas repetidas)
console.log('\nAirbnb — relatório novo (extrato financeiro)');
{
  const csv = [
    'Data,Tipo,Código de Confirmação,Data de início,Data de término,Noites,Hóspede,Anúncio,Moeda,Valor,Taxa de serviço,Taxa de limpeza,Ganhos brutos',
    '09/10/2026,Payout,,,,,,,BRL,6951.91,,,',
    '08/21/2026,Reserva,HMAM94TAB8,08/14/2026,08/24/2026,10,Natasha,Studio Av. Kennedy,BRL,839.24,"186,88",0.00,1003.40',
    '08/17/2026,Reserva,HMAM94TAB8,08/14/2026,08/24/2026,10,Natasha,Studio Av. Kennedy,BRL,1025.54,"228,37",0.00,1226.18',
    '07/01/2025,Taxa de Cancelamento,HMEEPD2TRR,08/01/2025,08/03/2025,2,Luis,Wai Wai Cumbuco,BRL,-286.56,0.00,0.00,0.00',
  ].join('\n');
  const r = lerRelatorio(parseCSV(csv));
  conferir('reconhece a plataforma', 'Airbnb', r.plataforma);
  conferir('descobre que as datas são americanas', 'MDY', r.formatoData);
  conferir('ignora a linha de repasse (Payout)', 2, r.reservas.length);
  const a = r.reservas.find((x) => x.codigo === 'HMAM94TAB8');
  conferir('soma as 2 linhas da mesma reserva', 1864.78, a.valorLiquido);
  conferir('soma a comissão das 2 linhas', 415.25, a.taxaPlataforma);
  conferir('bruto = líquido + comissão', 2280.03, a.valorBruto);
  conferir('lê a data no formato certo', ['2026-08-14', '2026-08-24'], [a.checkin, a.checkout]);
  const c = r.reservas.find((x) => x.codigo === 'HMEEPD2TRR');
  conferir('só taxa de cancelamento = reserva cancelada', true, c.cancelada);
}

// --- caso 2: relatório ANTIGO do Airbnb (uma linha por reserva, datas DD/MM)
console.log('\nAirbnb — relatório antigo (continua funcionando)');
{
  const csv = [
    'Código de confirmação,Status,Nome do hóspede,Entrar em contato,Nº de adultos,Nº de crianças,Data de início,Data de término,Nº de noites,Anúncio,Ganhos',
    'HMABC12345,Confirmada,João Silva,+5511999998888,2,1,17/05/2019,20/05/2019,3,Apto Wai Wai Cumbuco,"1.320,00"',
  ].join('\n');
  const r = lerRelatorio(parseCSV(csv));
  conferir('descobre que as datas são brasileiras', 'DMY', r.formatoData);
  const a = r.reservas[0];
  conferir('data lida como dia/mês', ['2019-05-17', '2019-05-20'], [a.checkin, a.checkout]);
  conferir('valor em reais (1.320,00)', 1320, a.valorLiquido);
  conferir('sem comissão, bruto = líquido (regra do protótipo)', [0, 1320], [a.taxaPlataforma, a.valorBruto]);
  conferir('soma adultos + crianças', 3, a.hospedes);
  conferir('guarda o telefone', '+5511999998888', a.hospedeTel);
}

// --- caso 3: Booking
console.log('\nBooking');
{
  const csv = [
    'Número da reserva,Nome(s) do(s) hóspede(s),Chegada,Saída,Duração (diárias),Pessoas,Status,Preço,Valor da comissão,Tipo de unidade',
    '5204953772,Maria Souza,29/07/2027,01/08/2027,3,2,ok,"2.198,57","351,77",Studio Av. Kennedy',
    '5204953773,Ana Lima,10/01/2027,12/01/2027,2,1,cancelled,"1.000,00","160,00",Wai Wai Cumbuco',
  ].join('\n');
  const r = lerRelatorio(parseCSV(csv));
  conferir('reconhece a plataforma', 'Booking.com', r.plataforma);
  const a = r.reservas[0];
  conferir('líquido = preço − comissão', 1846.8, a.valorLiquido);
  conferir('datas brasileiras', ['2027-07-29', '2027-08-01'], [a.checkin, a.checkout]);
  conferir('marca a cancelada', true, r.reservas[1].cancelada);
}

console.log(`\n${passou} conferência(s) passaram, ${falhou} falharam.`);

// --- arquivo de verdade, se informado ------------------------------------
const arquivo = process.argv[2];
if (arquivo) {
  console.log(`\n--- ${arquivo} ---`);
  const r = lerRelatorio(parseCSV(readFileSync(arquivo, 'utf-8')));
  const soma = (f) => r.reservas.reduce((s, x) => s + f(x), 0);
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  console.log(`${r.plataforma} · datas em ${r.formatoData} · ${r.reservas.length} reserva(s) · ${r.ignoradas} linha(s) ignorada(s)`);
  console.log(`  líquido ${brl(soma((x) => x.valorLiquido))} · comissão ${brl(soma((x) => x.taxaPlataforma))} · bruto ${brl(soma((x) => x.valorBruto))} · ${soma((x) => x.noites)} noites`);
  const varias = r.reservas.filter((x) => x.linhasDoRelatorio > 1);
  if (varias.length) {
    console.log(`  ${varias.length} reserva(s) vieram em várias linhas e foram somadas:`);
    for (const x of varias) console.log(`    ${x.codigo} (${x.linhasDoRelatorio} linhas) → ${brl(x.valorLiquido)}`);
  }
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
}

process.exit(falhou ? 1 : 0);
