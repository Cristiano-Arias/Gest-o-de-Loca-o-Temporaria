import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/jwt-auth.guard';
import {
  LeituraRelatorio,
  NomePlataforma,
  ReservaLida,
  lerRelatorio,
  normalizar,
} from './relatorio.parser';

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
  porPlataforma: Record<NomePlataforma, LinhaResumo>;
  conflitos: string[];
  erros: string[];
  avisos: string[];
};

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

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
      avisos: [],
    };

    // Cache de imóveis achados/criados durante esta importação.
    const cacheImovel = new Map<string, string | null>();

    for (const arquivo of arquivos ?? []) {
      try {
        const linhas = this.lerArquivo(arquivo);
        const leitura = lerRelatorio(linhas);

        this.logger.log(
          `${arquivo.originalname}: ${leitura.plataforma}, ` +
            `${leitura.reservas.length} reserva(s), datas em ${leitura.formatoData}.`,
        );
        resumo.ignoradas += leitura.ignoradas;
        for (const aviso of leitura.avisos) {
          resumo.avisos.push(`${arquivo.originalname}: ${aviso}`);
        }
        await this.gravarLeitura(user, leitura, arquivo.originalname, resumo, cacheImovel);
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
      // Lê como texto e preserva as datas (não deixa virar Date).
      return this.parseCSV(arquivo.buffer.toString('utf-8'));
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

  // --- gravação ----------------------------------------------------------

  private async gravarLeitura(
    user: AuthUser,
    leitura: LeituraRelatorio,
    nomeArq: string,
    resumo: ResultadoImport,
    cacheImovel: Map<string, string | null>,
  ) {
    for (const reserva of leitura.reservas) {
      try {
        const propertyId = await this.mapearImovel(
          user,
          reserva.textoImovel,
          cacheImovel,
        );
        if (!propertyId) {
          resumo.ignoradas++;
          resumo.avisos.push(
            `${nomeArq}: não identifiquei o imóvel "${reserva.textoImovel}" ` +
              `(reserva ${reserva.codigo}).`,
          );
          continue;
        }
        await this.gravarReserva(user, reserva, propertyId, resumo);
      } catch (e) {
        // Uma reserva com problema não pode derrubar o resto do arquivo.
        const msg = e instanceof Error ? e.message : String(e);
        resumo.ignoradas++;
        resumo.avisos.push(`${nomeArq}: reserva ${reserva.codigo} — ${msg}`);
      }
    }
  }

  // Grava (ou atualiza) a reserva, com idempotência por (plataforma, código).
  private async gravarReserva(
    user: AuthUser,
    dados: ReservaLida,
    propertyId: string,
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

    const comum: Prisma.ReservationUncheckedUpdateInput = {
      propertyId,
      platformId,
      guestId,
      codigoReserva: dados.codigo || null,
      checkin: this.toDate(dados.checkin),
      checkout: this.toDate(dados.checkout),
      noites: dados.noites,
      valorBruto: dados.valorBruto,
      taxaPlataforma: dados.taxaPlataforma,
      valorLiquido: dados.valorLiquido,
      status: this.status(dados),
    };

    // Campos que o relatório pode não informar: só sobrescreve quando vieram,
    // para não apagar o que já estava certo no sistema.
    if (dados.hospedes != null) comum.hospedes = dados.hospedes;
    if (dados.taxaLimpeza != null) comum.taxaLimpeza = dados.taxaLimpeza;

    if (existente) {
      await this.prisma.reservation.update({
        where: { id: existente.id },
        data: comum,
      });
      resumo.porPlataforma[dados.plataforma].atu++;
      resumo.atualizadas++;
    } else {
      await this.prisma.reservation.create({
        data: {
          ...(comum as Prisma.ReservationUncheckedCreateInput),
          hospedes: dados.hospedes ?? 1,
          kind: 'BOOKING',
        },
      });
      resumo.porPlataforma[dados.plataforma].nova++;
      resumo.importadas++;
    }
  }

  // Situação da reserva: cancelada pelo relatório, ou deduzida pelas datas.
  private status(dados: ReservaLida): ReservationStatus {
    if (dados.cancelada) return ReservationStatus.CANCELADA;
    const hoje = this.hojeISO();
    if (dados.checkout <= hoje) return ReservationStatus.FINALIZADA;
    if (dados.checkin <= hoje) return ReservationStatus.HOSPEDADO;
    return ReservationStatus.CONFIRMADA;
  }

  // --- mapeamento de imóvel ---------------------------------------------

  /**
   * Descobre a qual imóvel pertence o texto do anúncio. Primeiro tenta casar
   * com os imóveis JÁ CADASTRADOS do usuário (por palavra marcante do nome) —
   * assim, renomear o anúncio na plataforma não quebra a importação. Só se
   * nada casar é que usa os apelidos conhecidos e cria o imóvel.
   */
  private async mapearImovel(
    user: AuthUser,
    texto: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    const chave = normalizar(texto);
    if (!chave) return null;
    if (cache.has(chave)) return cache.get(chave) ?? null;

    const imoveis = await this.prisma.property.findMany({
      where: { userId: user.id },
      select: { id: true, nome: true },
    });

    // 1) Palavra marcante do nome de um imóvel cadastrado aparece no anúncio.
    let achado: string | null = null;
    let melhorPontuacao = 0;
    for (const imovel of imoveis) {
      const pontuacao = this.palavrasMarcantes(imovel.nome).filter((p) =>
        chave.includes(p),
      ).length;
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        achado = imovel.id;
      }
    }

    // 2) Apelidos conhecidos dos anúncios (fallback).
    if (!achado) {
      const grupo = this.grupoConhecido(chave);
      if (grupo) {
        const porApelido = imoveis.find((p) =>
          grupo.keys.some((k) => normalizar(p.nome).includes(k)),
        );
        achado =
          porApelido?.id ??
          (
            await this.prisma.property.create({
              data: { userId: user.id, nome: grupo.nome },
              select: { id: true },
            })
          ).id;
      }
    }

    cache.set(chave, achado);
    return achado;
  }

  /**
   * Palavras do nome do imóvel que servem para reconhecê-lo (4 letras ou mais,
   * fora as palavras comuns que não distinguem nada).
   */
  private palavrasMarcantes(nome: string): string[] {
    const comuns = new Set([
      'apto', 'apartamento', 'casa', 'studio', 'flat', 'suite', 'quarto',
      'praia', 'centro', 'residencial', 'resid', 'edificio', 'condominio',
      'com', 'para', 'sala', 'cozinha', 'vista', 'mar',
    ]);
    return normalizar(nome)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !comuns.has(p));
  }

  // Apelidos dos anúncios (usados só quando o imóvel ainda não está cadastrado).
  private grupoConhecido(
    textoNormalizado: string,
  ): { keys: string[]; nome: string } | null {
    if (/wai|cumbuco|sea view/.test(textoNormalizado))
      return { keys: ['wai', 'cumbuco'], nome: 'Apto Wai Wai Cumbuco' };
    if (/kennedy|studio|one-bedroom|one bedroom|marco|bernardo|sbc/.test(textoNormalizado))
      return { keys: ['marco', 'sbc', 'bernardo', 'kennedy'], nome: 'Marco Zero SBC' };
    return null;
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
      orderBy: [{ propertyId: 'asc' }, { checkin: 'asc' }],
    });
    const out: string[] = [];
    const curto = (d: Date) =>
      `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    // Já vem ordenado por imóvel e data: basta comparar com as vizinhas.
    for (let i = 0; i < ativ.length; i++) {
      for (let j = i + 1; j < ativ.length; j++) {
        const a = ativ[i];
        const b = ativ[j];
        if (a.propertyId !== b.propertyId) break;
        if (b.checkin >= a.checkout) break; // as seguintes começam ainda depois
        const nomeA = a.guest?.nome || a.platform?.nome || 'reserva';
        const nomeB = b.guest?.nome || b.platform?.nome || 'reserva';
        out.push(
          `${a.property.nome}: ${nomeA} (${a.platform?.nome ?? '—'}, ${curto(a.checkin)}→${curto(a.checkout)}) × ${nomeB} (${b.platform?.nome ?? '—'}, ${curto(b.checkin)}→${curto(b.checkout)})`,
        );
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

  /**
   * Mantém o hóspede da reserva. O telefone só é sobrescrito quando o
   * relatório traz um — o relatório novo do Airbnb não tem essa coluna, e
   * apagar o telefone que já estava salvo quebraria a Agenda.
   */
  private async syncGuest(
    existingGuestId: string | null,
    nome: string,
    telefone: string | null,
  ): Promise<string | null> {
    const limpo = nome?.trim();
    const tel = telefone?.trim() || null;
    if (!limpo) return existingGuestId;

    if (existingGuestId) {
      await this.prisma.guest.update({
        where: { id: existingGuestId },
        data: { nome: limpo, ...(tel ? { telefone: tel } : {}) },
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

  // Hoje (UTC) como AAAA-MM-DD, para comparar com as datas das reservas.
  private hojeISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
