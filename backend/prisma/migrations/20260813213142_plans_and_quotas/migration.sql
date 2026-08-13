-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('gratuit', 'premium', 'pro', 'pme');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'gratuit';
