-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "filePublicId" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT;
