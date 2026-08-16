-- Ce que la lecture d'un document apprend de lui, désormais conservé :
-- fournisseur, montant, date portée par le document et texte lu.

ALTER TABLE "Document" ADD COLUMN "provider" TEXT;
ALTER TABLE "Document" ADD COLUMN "amount" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN "documentDate" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "extractedText" TEXT;
ALTER TABLE "Document" ADD COLUMN "analyzedAt" TIMESTAMP(3);

-- La recherche par le contenu filtre sur le texte des documents d'un compte.
CREATE INDEX "Document_userId_analyzedAt_idx" ON "Document" ("userId", "analyzedAt");
