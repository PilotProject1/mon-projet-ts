-- Échéance repérée automatiquement dans un document, en attente de décision.

ALTER TABLE "Document" ADD COLUMN "suggestedDueDate" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "suggestedDueLabel" TEXT;
