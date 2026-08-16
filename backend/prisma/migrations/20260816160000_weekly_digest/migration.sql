-- Point hebdomadaire par e-mail : préférence, et date du dernier envoi.

ALTER TABLE "User" ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "lastWeeklyDigestAt" TIMESTAMP(3);
