-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'OPERATOR', 'STAFF');

-- CreateEnum
CREATE TYPE "ReservationKind" AS ENUM ('BOOKING', 'BLOCK');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'HOSPEDADO', 'FINALIZADA', 'CANCELADA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('LIMPEZA', 'CONDOMINIO', 'IPTU', 'ENERGIA', 'AGUA', 'GAS', 'INTERNET', 'MANUTENCAO', 'COMPRAS', 'REPOSICAO_ITENS', 'LAVANDERIA', 'TAXAS_BANCARIAS', 'OUTROS');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PRINT', 'PDF', 'PLANILHA', 'COMPROVANTE', 'RECIBO', 'NOTA_FISCAL', 'FOTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "AttachmentSource" AS ENUM ('WHATSAPP', 'WEB_UPLOAD', 'EMAIL');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'FALHOU', 'AGUARDANDO_CONFIRMACAO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('CHECKIN_AMANHA', 'CHECKOUT_AMANHA', 'RESERVA_NOVA', 'RESERVA_CANCELADA', 'PAGAMENTO_PENDENTE', 'DATA_VAGA_ALTA_TEMPORADA', 'CONFLITO_AGENDA', 'CUSTO_ACIMA_MEDIA', 'QUEDA_OCUPACAO');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('AGENDADO', 'ENVIADO', 'LIDO', 'DISPENSADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageIntent" AS ENUM ('NOVA_RESERVA', 'LANCAR_CUSTO', 'BLOQUEAR', 'CONSULTA_AGENDA', 'CONSULTA_FINANCEIRA', 'CONSULTA_METRICA', 'GERAR_RELATORIO', 'ANEXO', 'AJUDA', 'DESCONHECIDO');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('OCIOSO', 'AGUARDANDO_CAMPO', 'AGUARDANDO_CONFIRMACAO');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'EXCEL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDENTE', 'GERANDO', 'PRONTO', 'FALHOU');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senhaHash" TEXT,
    "papel" "UserRole" NOT NULL DEFAULT 'OWNER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "comissaoPadrao" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "capacidade" INTEGER NOT NULL DEFAULT 2,
    "checkinPadrao" TEXT DEFAULT '15:00',
    "checkoutPadrao" TEXT DEFAULT '11:00',
    "taxaLimpeza" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyListing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "listingExternalId" TEXT,
    "icalUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "documento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "guestId" TEXT,
    "platformId" TEXT,
    "kind" "ReservationKind" NOT NULL DEFAULT 'BOOKING',
    "codigoReserva" TEXT,
    "checkin" DATE NOT NULL,
    "checkout" DATE NOT NULL,
    "noites" INTEGER NOT NULL,
    "hospedes" INTEGER NOT NULL DEFAULT 1,
    "valorBruto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxaPlataforma" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxaLimpeza" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDENTE',
    "motivoBloqueio" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cost" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT,
    "data" DATE NOT NULL,
    "categoria" "CostCategory" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "descricao" TEXT,
    "statusPagamento" "PaymentStatus" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringCost" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "categoria" "CostCategory" NOT NULL,
    "valorMensal" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "costId" TEXT,
    "tipo" "PaymentType" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDENTE',
    "metodo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "AttachmentType" NOT NULL,
    "mimeType" TEXT,
    "origem" "AttachmentSource" NOT NULL,
    "reservationId" TEXT,
    "costId" TEXT,
    "messageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionJob" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDENTE',
    "resultado" JSONB,
    "confiancaMedia" DECIMAL(4,3),
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tipo" "AlertType" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'AGENDADO',
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "reservationId" TEXT,
    "costId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estado" "ConversationState" NOT NULL DEFAULT 'OCIOSO',
    "intencaoPendente" "MessageIntent",
    "contextoPendente" JSONB,
    "expiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "direcao" "MessageDirection" NOT NULL,
    "conteudo" TEXT,
    "intencao" "MessageIntent",
    "payloadRaw" JSONB,
    "waMessageId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "formato" "ReportFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDENTE',
    "url" TEXT,
    "parametros" JSONB,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prontoEm" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telefone_key" ON "User"("telefone");

-- CreateIndex
CREATE INDEX "User_telefone_idx" ON "User"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_nome_key" ON "Platform"("nome");

-- CreateIndex
CREATE INDEX "Property_userId_idx" ON "Property"("userId");

-- CreateIndex
CREATE INDEX "PropertyListing_propertyId_idx" ON "PropertyListing"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyListing_propertyId_platformId_key" ON "PropertyListing"("propertyId", "platformId");

-- CreateIndex
CREATE INDEX "Guest_documento_idx" ON "Guest"("documento");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_checkin_checkout_idx" ON "Reservation"("propertyId", "checkin", "checkout");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_checkin_idx" ON "Reservation"("checkin");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_platformId_codigoReserva_key" ON "Reservation"("platformId", "codigoReserva");

-- CreateIndex
CREATE INDEX "Cost_propertyId_data_idx" ON "Cost"("propertyId", "data");

-- CreateIndex
CREATE INDEX "Cost_categoria_idx" ON "Cost"("categoria");

-- CreateIndex
CREATE INDEX "Cost_statusPagamento_idx" ON "Cost"("statusPagamento");

-- CreateIndex
CREATE INDEX "RecurringCost_propertyId_idx" ON "RecurringCost"("propertyId");

-- CreateIndex
CREATE INDEX "Payment_data_idx" ON "Payment"("data");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_messageId_key" ON "Attachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionJob_attachmentId_key" ON "ExtractionJob"("attachmentId");

-- CreateIndex
CREATE INDEX "ExtractionJob_status_idx" ON "ExtractionJob"("status");

-- CreateIndex
CREATE INDEX "Alert_status_agendadoPara_idx" ON "Alert"("status", "agendadoPara");

-- CreateIndex
CREATE INDEX "Alert_tipo_idx" ON "Alert"("tipo");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_userId_estado_idx" ON "WhatsAppConversation"("userId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_userId_criadoEm_idx" ON "WhatsAppMessage"("userId", "criadoEm");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_intencao_idx" ON "WhatsAppMessage"("intencao");

-- CreateIndex
CREATE INDEX "Report_userId_criadoEm_idx" ON "Report"("userId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cost" ADD CONSTRAINT "Cost_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCost" ADD CONSTRAINT "RecurringCost_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_costId_fkey" FOREIGN KEY ("costId") REFERENCES "Cost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_costId_fkey" FOREIGN KEY ("costId") REFERENCES "Cost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "WhatsAppMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_costId_fkey" FOREIGN KEY ("costId") REFERENCES "Cost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

