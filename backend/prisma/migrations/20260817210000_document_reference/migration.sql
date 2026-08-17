-- Référence propre au document et statut de paiement.
-- Trois colonnes facultatives : les documents déjà déposés restent valides,
-- et leur prochaine analyse les renseignera.
ALTER TABLE "Document" ADD COLUMN "reference" TEXT;
ALTER TABLE "Document" ADD COLUMN "referenceLabel" TEXT;
ALTER TABLE "Document" ADD COLUMN "paid" BOOLEAN;
