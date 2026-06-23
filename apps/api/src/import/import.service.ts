import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/jwt-auth.guard';

// Arquivo enviado (compatível com Express.Multer.File, sem depender do tipo).
type ArquivoUpload = {
  originalname: string;
  buffer: Buffer;
};

type LinhaResumo = { nova: number; atu: number };

type ResultadoImport = {
  importadas: number;
  atualizadas: number;
  ignoradas: number;
  porPlataforma: Record<'Airbnb' | 'Booking.com', LinhaResumo>;
  conflitos: string[];
  erros: string[];
};

// Dados de uma reserva extraídos de uma linha do relatório.
type ReservaImport = {
  plataforma: 'Airbnb' | 'Booking.com';
  codigo: string;
  hospedeNome: string;
  hospedeTel: string;
  propertyId: string;
  checkin: string; // AAAA-MM-DD
  checkout: string;
  noites: number;
  hospedes: number;
  valorBruto: number;
  taxaPlataforma: number;
  valorLiquido: number;
  status: ReservationStatus;
};

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importar(
    user: AuthUser,
    arquivos: ArquivoUpload[],
  ): Promise<ResultadoImport> {
    const resumo: ResultadoImport = {
      importadas: 0,
      atualizadas: 0,
      ignoradas: 0,
      porPlataforma: {
        Airbnb: { nova: 0, atu: 0 },
        'Booking.com': { nova: 0, atu: 0 },
      },
      conflitos: [],
      erros: [],
    };

    // Cache de imóveis criados/achados durante esta importação (por grupo).
    const cacheImovel = new Map<string, string>();

    for (const arquivo of arquivos ?? []) {
      try {
        const rows = this.lerArquivo(arquivo);
        await this.processarLinhas(user, rows, arquivo.originalname, resumo, cacheImovel);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erro ao ler';
        resumo.erros.push(`${arquivo.originalname}: ${msg}`);
      }
    }

    resumo.conflitos = await this.escanearConflitos(user);
    return resumo;
  }

  // --- leitura do arquivo (CSV texto ou XLS/XLSX binário) ----------------

  private lerArquivo(arquivo: ArquivoUpload): string[][] {
    const ehCsv = /\.csv$/i.test(arquivo.originalname);
    if (ehCsv) {
      // Lê como texto UTF-8 e preserva as datas (não deixa virar Date).
      const texto = arquivo.buffer.toString('utf-8');
      return this.parseCSV(texto);
    }
    const wb = XLSX.read(arquivo.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as string[][];
  }

  // Parser de CSV que respeita aspas, vírgulas e quebras dentro de campos.
  private parseCSV(text: string): string[][] {
    text = text.replace(/^﻿/, ''); // remove BOM
    const rows: string[][] = [];
    let row: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            q = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        q = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else if (ch === '\r') {
        // ignora
      } else {
        cur += ch;
      }
    }
    if (cur !== '' || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  // --- processamento das linhas -----------------------------------------

  private async processarLinhas(
    user: AuthUser,
    rows: string[][],
    nomeArq: string,
    resumo: ResultadoImport,
    cacheImovel: Map<string, string>,
  ) {
    if (!rows || !rows.length) {
      resumo.erros.push(`${nomeArq}: vazio`);
      return;
    }
    const head = rows[0].map((x) => String(x).trim());
    const idx = (name: string) =>
      head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const has = (name: string) => idx(name) > -1;

    let plat: 'Airbnb' | 'Booking.com' | null = null;
    if (has('Código de confirmação') || has('Anúncio') || has('Ganhos'))
      plat = 'Airbnb';
    else if (has('Número da reserva') || has('Tipo de unidade'))
      plat = 'Booking.com';
    if (!plat) {
      resumo.erros.push(`${nomeArq}: formato não reconhecido`);
      return;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => String(c).trim() === '')) continue;
      const g = (name: string) => {
        const j = idx(name);
        return j > -1 ? row[j] ?? '' : '';
      };

      let dados: ReservaImport | null = null;
      if (plat === 'Airbnb') {
        const ci = this.parseDataFlex(g('Data de início'));
        const co = this.parseDataFlex(g('Data de término'));
        if (!ci || !co) {
          resumo.ignoradas++;
          continue;
        }
        const propId = await this.mapearImovel(user, g('Anúncio'), cacheImovel);
        if (!propId) {
          resumo.ignoradas++;
          continue;
        }
        const ganho = this.parseNumBR(g('Ganhos'));
        const hospedes =
          (Number(g('Nº de adultos')) || 0) +
            (Number(g('Nº de crianças')) || 0) +
            (Number(g('Nº de bebês')) || 0) || 1;
        dados = {
          plataforma: 'Airbnb',
          codigo: String(g('Código de confirmação')).trim(),
          hospedeNome: String(g('Nome do hóspede')).trim(),
          hospedeTel: String(g('Entrar em contato')).trim(),
          propertyId: propId,
          checkin: ci,
          checkout: co,
          noites: Number(g('Nº de noites')) || this.noitesEntre(ci, co),
          hospedes,
          valorBruto: ganho,
          taxaPlataforma: 0,
          valorLiquido: ganho,
          status: this.statusPorData(String(g('Status')), ci, co),
        };
      } else {
        const ci = this.parseDataFlex(g('Entrada'));
        const co = this.parseDataFlex(g('Saída'));
        if (!ci || !co) {
          resumo.ignoradas++;
          continue;
        }
        const propId = await this.mapearImovel(
          user,
          g('Tipo de unidade'),
          cacheImovel,
        );
        if (!propId) {
          resumo.ignoradas++;
          continue;
        }
        const preco = this.parseNumBR(g('Preço'));
        const com = this.parseNumBR(g('Valor da comissão'));
        dados = {
          plataforma: 'Booking.com',
          codigo: String(g('Número da reserva')).trim(),
          hospedeNome: String(
            g('Nome(s) do(s) hóspede(s)') || g('Reservado por'),
          ).trim(),
          hospedeTel: String(g('Telefone')).trim(),
          propertyId: propId,
          checkin: ci,
          checkout: co,
          noites: Number(g('Duração (diárias)')) || this.noitesEntre(ci, co),
          hospedes: Number(g('Pessoas')) || 1,
          valorBruto: preco,
          taxaPlataforma: com,
          valorLiquido: preco - com,
          status: this.statusPorData(String(g('Status')), ci, co),
        };
      }

      await this.gravarReserva(user, dados, resumo);
    }
  }

  // Grava (ou atualiza) a reserva, com idempotência por (plataforma, código).
  private async gravarReserva(
    user: AuthUser,
    dados: ReservaImport,
    resumo: ResultadoImport,
  ) {
    const platformId = await this.resolvePlatform(dados.plataforma);

    const existente = dados.codigo
      ? await this.prisma.reservation.findFirst({
          where: {
            platformId,
            codigoReserva: dados.codigo,
            property: { userId: user.id },
          },
        })
      : null;

    const guestId = await this.syncGuest(
      existente?.guestId ?? null,
      dados.hospedeNome,
      dados.hospedeTel,
    );

    const comum = {
      propertyId: dados.propertyId,
      platformId,
      guestId,
      codigoReserva: dados.codigo || null,
      checkin: this.toDate(dados.checkin),
      checkout: this.toDate(dados.checkout),
      noites: dados.noites,
      hospedes: dados.hospedes,
      valorBruto: dados.valorBruto,
      taxaPlataforma: dados.taxaPlataforma,
      valorLiquido: dados.valorLiquido,
      status: dados.status,
    };

    if (existente) {
      await this.prisma.reservation.update({
        where: { id: existente.id },
        data: comum,
      });
      resumo.porPlataforma[dados.plataforma].atu++;
      resumo.atualizadas++;
    } else {
      await this.prisma.reservation.create({
        data: { ...comum, kind: 'BOOKING' },
      });
      resumo.porPlataforma[dados.plataforma].nova++;
      resumo.importadas++;
    }
  }

  // --- mapeamento de imóvel (palavras-chave; cria se não existir) --------

  private grupoImovel(
    texto: string,
  ): { keys: string[]; nome: string } | null {
    const t = (texto || '').toLowerCase();
    if (/wai|cumbuco|sea view/.test(t))
      return { keys: ['wai', 'cumbuco'], nome: 'Apto Wai Wai Cumbuco' };
    if (/kennedy|studio|one-bedroom|one bedroom|marco|bernardo|sbc/.test(t))
      return { keys: ['marco', 'sbc', 'bernardo', 'kennedy'], nome: 'Marco Zero SBC' };
    return null;
  }

  private async mapearImovel(
    user: AuthUser,
    texto: string,
    cache: Map<string, string>,
  ): Promise<string | null> {
    const grupo = this.grupoImovel(texto);
    if (!grupo) return null;

    const chave = grupo.keys[0];
    const emCache = cache.get(chave);
    if (emCache) return emCache;

    const imoveis = await this.prisma.property.findMany({
      where: { userId: user.id },
      select: { id: true, nome: true },
    });
    const achado = imoveis.find((p) =>
      grupo.keys.some((k) => p.nome.toLowerCase().includes(k)),
    );
    if (achado) {
      cache.set(chave, achado.id);
      return achado.id;
    }

    const novo = await this.prisma.property.create({
      data: { userId: user.id, nome: grupo.nome },
      select: { id: true },
    });
    cache.set(chave, novo.id);
    return novo.id;
  }

  // --- conflitos (possível overbooking) ----------------------------------

  private async escanearConflitos(user: AuthUser): Promise<string[]> {
    const ativ = await this.prisma.reservation.findMany({
      where: {
        property: { userId: user.id },
        kind: 'BOOKING',
        status: { not: ReservationStatus.CANCELADA },
      },
      include: { property: true, guest: true, platform: true },
    });
    const out: string[] = [];
    const curto = (d: Date) =>
      `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    for (let i = 0; i < ativ.length; i++) {
      for (let j = i + 1; j < ativ.length; j++) {
        const a = ativ[i];
        const b = ativ[j];
        if (
          a.propertyId === b.propertyId &&
          a.checkin < b.checkout &&
          a.checkout > b.checkin
        ) {
          const nomeA = a.guest?.nome || a.platform?.nome || 'reserva';
          const nomeB = b.guest?.nome || b.platform?.nome || 'reserva';
          out.push(
            `${a.property.nome}: ${nomeA} (${a.platform?.nome ?? '—'}, ${curto(a.checkin)}→${curto(a.checkout)}) × ${nomeB} (${b.platform?.nome ?? '—'}, ${curto(b.checkin)}→${curto(b.checkout)})`,
          );
        }
      }
    }
    return out;
  }

  // --- auxiliares --------------------------------------------------------

  private async resolvePlatform(nome: string): Promise<string> {
    const p = await this.prisma.platform.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    return p.id;
  }

  private async syncGuest(
    existingGuestId: string | null,
    nome: string,
    telefone: string,
  ): Promise<string | null> {
    const limpo = nome?.trim();
    const tel = telefone?.trim() || null;
    if (!limpo) return existingGuestId;
    if (existingGuestId) {
      await this.prisma.guest.update({
        where: { id: existingGuestId },
        data: { nome: limpo, telefone: tel },
      });
      return existingGuestId;
    }
    const g = await this.prisma.guest.create({
      data: { nome: limpo, telefone: tel },
    });
    return g.id;
  }

  private toDate(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private noitesEntre(ci: string, co: string): number {
    return Math.round(
      (this.toDate(co).getTime() - this.toDate(ci).getTime()) / 86_400_000,
    );
  }

  // Hoje (UTC) como AAAA-MM-DD, para comparar com as datas das reservas.
  private hojeISO(): string {
    const t = new Date();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  }

  private statusPorData(raw: string, ci: string, co: string): ReservationStatus {
    if (/cancel/i.test(raw || '')) return ReservationStatus.CANCELADA;
    const h = this.hojeISO();
    if (co <= h) return ReservationStatus.FINALIZADA;
    if (ci <= h && co > h) return ReservationStatus.HOSPEDADO;
    return ReservationStatus.CONFIRMADA;
  }

  // Número no formato brasileiro: "1.234,56" -> 1234.56.
  private parseNumBR(s: unknown): number {
    if (s == null) return 0;
    let t = String(s).replace(/ /g, ' ').replace(/R\$/i, '').replace(/BRL/i, '').trim();
    if (t === '') return 0;
    if (t.indexOf(',') > -1) t = t.replace(/\./g, '').replace(',', '.');
    t = t.replace(/[^0-9.\-]/g, '');
    return parseFloat(t) || 0;
  }

  // Datas flexíveis: ISO, DD/MM/AAAA ou serial do Excel -> AAAA-MM-DD.
  private parseDataFlex(s: unknown): string | null {
    if (s == null || s === '') return null;
    const t = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (/^\d+(\.\d+)?$/.test(t)) {
      const dt = new Date(Date.UTC(1899, 11, 30) + parseFloat(t) * 86_400_000);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
    return null;
  }
}
