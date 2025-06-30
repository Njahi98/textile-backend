-- AlterTable
ALTER TABLE "ProductionLine" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "targetOutput" INTEGER;
