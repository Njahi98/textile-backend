/*
  Warnings:

  - A unique constraint covering the columns `[cin]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cin` to the `Worker` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "cin" INTEGER NOT NULL,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_cin_key" ON "Worker"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_phone_key" ON "Worker"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_email_key" ON "Worker"("email");
