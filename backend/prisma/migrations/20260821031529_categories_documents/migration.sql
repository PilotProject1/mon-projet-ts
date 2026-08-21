-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('maison', 'personnel', 'famille');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" "DocumentCategory";
