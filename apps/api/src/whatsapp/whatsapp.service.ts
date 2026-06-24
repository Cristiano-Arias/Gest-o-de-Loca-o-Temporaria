import { Injectable, Logger } from '@nestjs/common';
import { CostCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntentRouterService } from './intent-router.service';
import { WhatsAppApiService } from './whatsapp-api.service';
import { ImportService } from '../import/import.service';

// Limite defensivo do anexo guardado no estado da conversa (relatórios são pequenos).
const MAX_ARQUIVO_BYTES = 6 * 1024 * 1024; // 6 MB

const CATEGORIAS_VALIDAS = new Set<string>([
  'LIMPEZA', 'CONDOMINIO', 'IPTU', 'ENERGIA', 'AGUA', 'GAS', 'INTERNET',
  'MANUTENCAO', 'COMPRAS', 'REPOSICAO_ITENS', 'LAVANDERIA', 'TAXAS_BANCARIAS', 'OUTROS',
]);

const CAT_LABEL: Record<string, string> = {
  LIMPEZA: 'Limpeza', CONDOMINIO: 'Condomínio', IPTU: 'IPTU', ENERGIA: 'Energia',
  AGUA: 'Água', GAS: 'Gás', INTERNET: 'Internet', MANUTENCAO: 'Manutenção',
  COMPRAS: 'Compras', REPOSICAO_ITENS: 'Reposição', LAVANDERIA: 'Lavanderia',
  TAXAS_BANCARIAS: 'Taxas', OUTROS: 'Outros',
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const SIM = /^\s*(sim|s|isso|confirmo|confirmar|ok|pode|positivo|👍)\b/i;
const NAO = /^\s*(n[aã]o|n|cancela|cancelar|negativo)\b/i;

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function competenciaLabel(yyyymm: string): string {
  const [a, m] = yyyymm.split('-');
  return `${MESES[Number(m) - 1] ?? m}/${a}`;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: IntentRouterService,
    private readonly wa: WhatsAppApiService,
    private readonly importer: ImportService,
  ) {}

  /**
   * Processa uma mensagem de texto recebida. Identifica o usuário pelo telefone,
   * roteia a intenção e responde. Tudo em try/catch para nunca derrubar o webhook.
   */
  async processarTexto(from: string, texto: string): Promise<void> {
    try {
      this.logger.log(`Processando texto de ${from}: "${texto}"`);
      const user = await this.encontrarUsuario(from);
      if (!user) {
        this.logger.warn(`Usuário não encontrado para ${from}.`);
        await this.wa.sendText(
          from,
          'Olá! Seu número ainda não está vinculado a uma conta C. Arias. ' +
            'Peça ao administrador para cadastrar este telefone no seu usuário.',
        );
        return;
      }

      // Registra a mensagem recebida (histórico).
      await this.prisma.whatsAppMessage.create({
        data: { userId: user.id, direcao: 'INBOUND', conteudo: texto },
      });

      const conversa = await this.obterConversa(user.id);

      // Loop de confirmação: se estávamos esperando "sim/não", trata aqui.
      if (
        conversa.estado === 'AGUARDANDO_CONFIRMACAO' &&
        conversa.contextoPendente
      ) {
        await this.tratarConfirmacao(user.id, from, texto, conversa);
        return;
      }

      const resultado = await this.router.route(texto);
      this.logger.log(`Intenção detectada: ${resultado.intencao}`);

      switch (resultado.intencao) {
        case 'LANCAR_CUSTO':
          await this.iniciarLancamentoCusto(user.id, from, resultado.campos);
          break;
        case 'AJUDA':
          await this.wa.sendText(from, this.textoAjuda());
          break;
        case 'CONSULTA_AGENDA':
        case 'CONSULTA_FINANCEIRA':
          await this.wa.sendText(
            from,
            'Consultas por aqui ainda estão em construção. Por enquanto eu já ' +
              'consigo lançar custos — ex.: “Gás 120 no Wai Wai em julho”.',
          );
          break;
        default:
          await this.wa.sendText(
            from,
            'Não entendi 🤔. ' + this.textoAjuda(),
          );
      }
    } catch (e) {
      this.logger.error(`Erro ao processar texto: ${String(e)}`);
      try {
        await this.wa.sendText(
          from,
          'Tive um problema ao processar sua mensagem. Tente novamente em instantes.',
        );
      } catch {
        // ignora
      }
    }
  }

  /**
   * Processa um documento (anexo) recebido: relatório padrão do Airbnb (.csv)
   * ou Booking (.xls/.xlsx). Baixa, guarda no estado e pede confirmação Sim/Não.
   */
  async processarDocumento(
    from: string,
    documento: { id?: string; filename?: string; mime_type?: string },
  ): Promise<void> {
    try {
      const user = await this.encontrarUsuario(from);
      if (!user) {
        await this.wa.sendText(
          from,
          'Seu número ainda não está vinculado a uma conta C. Arias.',
        );
        return;
      }
      await this.prisma.whatsAppMessage.create({
        data: {
          userId: user.id,
          direcao: 'INBOUND',
          conteudo: `[arquivo] ${documento.filename ?? ''}`,
        },
      });

      const nome = documento.filename || 'arquivo';
      const ehRelatorio = /\.(csv|xls|xlsx)$/i.test(nome);
      if (!ehRelatorio) {
        await this.wa.sendText(
          from,
          'Recebi um arquivo, mas só sei importar os relatórios padrão do ' +
            'Airbnb (.csv) ou Booking (.xls). Prints e PDFs ainda não.',
        );
        return;
      }
      if (!documento.id) {
        await this.wa.sendText(from, 'Não consegui identificar o arquivo. Reenvie, por favor.');
        return;
      }

      const buffer = await this.wa.baixarMidia(documento.id);
      if (!buffer) {
        await this.wa.sendText(
          from,
          'Não consegui baixar o arquivo. Tente reenviar em instantes.',
        );
        return;
      }
      if (buffer.length > MAX_ARQUIVO_BYTES) {
        await this.wa.sendText(
          from,
          'O arquivo é muito grande para importar por aqui. Use a importação no site.',
        );
        return;
      }

      const plataforma = /\.csv$/i.test(nome) ? 'Airbnb' : 'Booking';
      const contexto = {
        tipo: 'importar',
        filename: nome,
        base64: buffer.toString('base64'),
      };

      await this.prisma.whatsAppConversation.update({
        where: { id: (await this.obterConversa(user.id)).id },
        data: {
          estado: 'AGUARDANDO_CONFIRMACAO',
          intencaoPendente: 'ANEXO',
          contextoPendente: contexto as unknown as Prisma.InputJsonValue,
        },
      });

      await this.wa.sendText(
        from,
        `📄 Recebi o arquivo *${nome}* (parece ${plataforma}).\n\n` +
          `Quer que eu importe as reservas? Responda *Sim* ou *Não*.`,
      );
    } catch (e) {
      this.logger.error(`Erro ao processar documento: ${String(e)}`);
      await this.wa.sendText(from, 'Tive um problema com o arquivo. Tente novamente.');
    }
  }

  // --- lançamento de custo (com confirmação) ---------------------------

  private async iniciarLancamentoCusto(
    userId: string,
    from: string,
    campos: { categoria?: string; valor?: number; imovel?: string; competencia?: string; descricao?: string },
  ) {
    const valor = Number(campos.valor);
    if (!(valor > 0)) {
      await this.wa.sendText(
        from,
        'Entendi que é um custo, mas faltou o valor. Ex.: “Gás 120 no Wai Wai”.',
      );
      return;
    }

    const categoria = (campos.categoria || 'OUTROS').toUpperCase();
    const cat = CATEGORIAS_VALIDAS.has(categoria) ? categoria : 'OUTROS';

    // Resolve o imóvel.
    const imoveis = await this.prisma.property.findMany({
      where: { userId, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
    if (imoveis.length === 0) {
      await this.wa.sendText(
        from,
        'Você ainda não tem imóveis cadastrados. Cadastre um no site antes de lançar custos.',
      );
      return;
    }

    const imovel = this.escolherImovel(imoveis, campos.imovel);
    if (!imovel) {
      const nomes = imoveis.map((i) => `• ${i.nome}`).join('\n');
      await this.wa.sendText(
        from,
        `Para qual imóvel é esse custo? Reenvie incluindo o nome:\n${nomes}`,
      );
      return;
    }

    const competencia =
      campos.competencia && /^\d{4}-\d{2}$/.test(campos.competencia)
        ? campos.competencia
        : mesAtual();

    const contexto = {
      tipo: 'custo',
      propertyId: imovel.id,
      imovelNome: imovel.nome,
      categoria: cat,
      valor,
      competencia,
      descricao: campos.descricao || null,
    };

    await this.prisma.whatsAppConversation.update({
      where: { id: (await this.obterConversa(userId)).id },
      data: {
        estado: 'AGUARDANDO_CONFIRMACAO',
        intencaoPendente: 'LANCAR_CUSTO',
        contextoPendente: contexto as unknown as Prisma.InputJsonValue,
      },
    });

    await this.wa.sendText(
      from,
      `Confirma este lançamento?\n\n` +
        `• Categoria: ${CAT_LABEL[cat]}\n` +
        `• Imóvel: ${imovel.nome}\n` +
        `• Valor: ${brl(valor)}\n` +
        `• Mês: ${competenciaLabel(competencia)}\n\n` +
        `Responda *Sim* ou *Não*.`,
    );
  }

  private async tratarConfirmacao(
    userId: string,
    from: string,
    texto: string,
    conversa: { id: string; contextoPendente: Prisma.JsonValue },
  ) {
    const resetar = () =>
      this.prisma.whatsAppConversation.update({
        where: { id: conversa.id },
        data: {
          estado: 'OCIOSO',
          intencaoPendente: null,
          contextoPendente: Prisma.JsonNull,
        },
      });

    if (NAO.test(texto)) {
      await resetar();
      await this.wa.sendText(from, 'Ok, cancelei. 👍');
      return;
    }
    if (!SIM.test(texto)) {
      await this.wa.sendText(from, 'Por favor responda *Sim* ou *Não*.');
      return;
    }

    const ctx = conversa.contextoPendente as unknown as {
      tipo: string;
      // custo
      propertyId?: string;
      imovelNome?: string;
      categoria?: string;
      valor?: number;
      competencia?: string;
      descricao?: string | null;
      // importar
      filename?: string;
      base64?: string;
    };

    // Importação de relatório (Airbnb/Booking).
    if (ctx?.tipo === 'importar' && ctx.base64 && ctx.filename) {
      await this.wa.sendText(from, '⏳ Importando, um instante…');
      const buffer = Buffer.from(ctx.base64, 'base64');
      const resultado = await this.importer.importar({ id: userId }, [
        { originalname: ctx.filename, buffer },
      ]);
      await resetar();
      await this.wa.sendText(from, this.formatarResumoImport(resultado));
      return;
    }

    if (ctx?.tipo === 'custo' && ctx.propertyId && ctx.categoria) {
      const competencia = ctx.competencia ?? mesAtual();
      const valor = Number(ctx.valor) || 0;
      const [a, m] = competencia.split('-').map(Number);
      const data = new Date(Date.UTC(a, m - 1, 1)); // 1º dia do mês de referência
      await this.prisma.cost.create({
        data: {
          propertyId: ctx.propertyId,
          data,
          categoria: ctx.categoria as CostCategory,
          valor,
          descricao: ctx.descricao ?? null,
          statusPagamento: 'PENDENTE',
        },
      });
      await resetar();
      await this.wa.sendText(
        from,
        `✅ Lançado: ${CAT_LABEL[ctx.categoria]} ${brl(valor)} em ${ctx.imovelNome ?? 'imóvel'} (${competenciaLabel(competencia)}).`,
      );
      return;
    }

    await resetar();
    await this.wa.sendText(from, 'Não havia nada pendente para confirmar.');
  }

  // --- auxiliares ------------------------------------------------------

  // Casa o imóvel pelo texto falado (palavra-chave). Se só houver 1 imóvel, usa-o.
  private escolherImovel(
    imoveis: { id: string; nome: string }[],
    falado?: string,
  ): { id: string; nome: string } | null {
    if (falado) {
      const alvo = falado.toLowerCase();
      const achou = imoveis.find((i) => {
        const nome = i.nome.toLowerCase();
        return (
          nome.includes(alvo) ||
          alvo
            .split(/\s+/)
            .some((p) => p.length >= 3 && nome.includes(p))
        );
      });
      if (achou) return achou;
    }
    if (imoveis.length === 1) return imoveis[0];
    return null;
  }

  private async obterConversa(userId: string) {
    const existente = await this.prisma.whatsAppConversation.findFirst({
      where: { userId },
      orderBy: { criadoEm: 'desc' },
    });
    if (existente) return existente;
    return this.prisma.whatsAppConversation.create({
      data: { userId, estado: 'OCIOSO' },
    });
  }

  /**
   * Encontra o usuário dono deste número. Estratégia:
   *  1) usuário cujo telefone bate com o número recebido;
   *  2) senão, usuário do e-mail em WHATSAPP_OWNER_EMAIL (modo dono único).
   */
  private async encontrarUsuario(from: string) {
    const ultimos8 = from.replace(/\D/g, '').slice(-8);
    if (ultimos8) {
      const porTelefone = await this.prisma.user.findFirst({
        where: { telefone: { contains: ultimos8 } },
      });
      if (porTelefone) return porTelefone;
    }
    const ownerEmail = process.env.WHATSAPP_OWNER_EMAIL;
    if (ownerEmail) {
      return this.prisma.user.findFirst({
        where: { email: ownerEmail.toLowerCase() },
      });
    }
    return null;
  }

  private textoAjuda(): string {
    return (
      'Eu sou o assistente da C. Arias. Por aqui eu já consigo:\n' +
      '• *Lançar custos* — ex.: “Gás 120 no Wai Wai”, “Energia 340,50 Marco Zero em julho”.\n' +
      '• *Importar reservas* — me envie o relatório do Airbnb (.csv) ou Booking (.xls) como anexo.\n' +
      'Sempre peço sua confirmação antes de gravar.'
    );
  }

  // Monta a resposta com o resultado da importação (espelha o resumo da Fase C).
  private formatarResumoImport(r: {
    importadas: number;
    atualizadas: number;
    ignoradas: number;
    porPlataforma: Record<string, { nova: number; atu: number }>;
    conflitos: string[];
    erros: string[];
  }): string {
    if (r.erros.length && r.importadas === 0 && r.atualizadas === 0) {
      return `❌ Não consegui importar:\n${r.erros.join('\n')}`;
    }
    const linhas: string[] = [
      `✅ Importação concluída.`,
      `• Novas: ${r.importadas}`,
      `• Atualizadas: ${r.atualizadas}`,
      `• Ignoradas (duplicadas): ${r.ignoradas}`,
    ];
    const ab = r.porPlataforma['Airbnb'];
    const bk = r.porPlataforma['Booking.com'];
    if (ab && (ab.nova || ab.atu)) linhas.push(`• Airbnb: ${ab.nova} novas`);
    if (bk && (bk.nova || bk.atu)) linhas.push(`• Booking: ${bk.nova} novas`);
    if (r.conflitos.length) {
      linhas.push('', `⚠️ Atenção a possíveis conflitos de data:`);
      linhas.push(...r.conflitos.slice(0, 5).map((c) => `• ${c}`));
    }
    if (r.erros.length) {
      linhas.push('', `Obs.: ${r.erros.length} arquivo(s) com aviso.`);
    }
    return linhas.join('\n');
  }
}
