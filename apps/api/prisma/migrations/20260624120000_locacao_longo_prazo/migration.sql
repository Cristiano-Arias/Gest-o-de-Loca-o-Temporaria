-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('TEMPORADA', 'LONGO_PRAZO');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "RentStatus" AS ENUM ('EM_ABERTO', 'PAGO');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "tipo" "PropertyType" NOT NULL DEFAULT 'TEMPORADA';

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "inquilinoNome" TEXT NOT NULL,
    "inquilinoTelefone" TEXT,
    "inquilinoEmail" TEXT,
    "inquilinoDocumento" TEXT,
    "valorMensal" DECIMAL(10,2) NOT NULL,
    "outrosCustos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outrosCustosDescricao" TEXT,
    "diaVencimento" INTEGER NOT NULL DEFAULT 5,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "incluiInternet" BOOLEAN NOT NULL DEFAULT false,
    "incluiAgua" BOOLEAN NOT NULL DEFAULT false,
    "incluiEnergia" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "status" "LeaseStatus" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentInstallment" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "RentStatus" NOT NULL DEFAULT 'EM_ABERTO',
    "pagoEm" DATE,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");

-- CreateIndex
CREATE INDEX "Lease_status_idx" ON "Lease"("status");

-- CreateIndex
CREATE INDEX "RentInstallment_leaseId_idx" ON "RentInstallment"("leaseId");

-- CreateIndex
CREATE INDEX "RentInstallment_status_idx" ON "RentInstallment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentInstallment_leaseId_competencia_key" ON "RentInstallment"("leaseId", "competencia");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentInstallment" ADD CONSTRAINT "RentInstallment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
