-- Double authentification par code à usage unique (TOTP, RFC 6238).
--
-- Quatre colonnes facultatives sur "User" : les comptes déjà créés restent
-- valides et continuent de se connecter avec leur seul mot de passe. La
-- protection ne s'ajoute que si son titulaire la demande.
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorPendingSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorLastStep" INTEGER;

-- Codes de secours, sous forme d'empreinte bcrypt comme un mot de passe.
CREATE TABLE "TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TwoFactorRecoveryCode_userId_idx" ON "TwoFactorRecoveryCode"("userId");

-- En cascade : un compte supprimé emporte ses codes de secours, comme le
-- reste de ses données.
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
