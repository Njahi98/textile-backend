-- AlterTable
ALTER TABLE "PerformanceRecord" ADD COLUMN     "shift" TEXT;

-- CreateIndex
CREATE INDEX "Assignment_productionLineId_date_idx" ON "Assignment"("productionLineId", "date");

-- CreateIndex
CREATE INDEX "Assignment_workerId_date_idx" ON "Assignment"("workerId", "date");

-- CreateIndex
CREATE INDEX "PerformanceRecord_workerId_date_idx" ON "PerformanceRecord"("workerId", "date");
