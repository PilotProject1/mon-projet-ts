-- Adresse de dépôt par e-mail, propre à chaque compte.
--
-- Colonne facultative : elle reste nulle tant que la personne n'a pas
-- demandé son adresse. Les comptes existants ne changent pas.
ALTER TABLE "User" ADD COLUMN "inboundToken" TEXT;

-- Unique : deux comptes ne peuvent pas partager la même adresse de dépôt,
-- et la contrainte le garantit au niveau de la base plutôt qu'au niveau du
-- code, où une course entre deux requêtes pourrait la contourner.
CREATE UNIQUE INDEX "User_inboundToken_key" ON "User"("inboundToken");
