-- Rappels d'échéance par e-mail : préférence utilisateur et déduplication.

ALTER TABLE "User" ADD COLUMN "reminderEmails" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Notification" ADD COLUMN "offsetDays" INTEGER;

-- Un seul rappel automatique par échéance et par palier. Les rappels
-- déclenchés à la main portent offsetDays NULL et restent répétables, deux
-- NULL étant distincts pour un index unique PostgreSQL.
CREATE UNIQUE INDEX "Notification_deadlineId_offsetDays_key"
  ON "Notification" ("deadlineId", "offsetDays");
