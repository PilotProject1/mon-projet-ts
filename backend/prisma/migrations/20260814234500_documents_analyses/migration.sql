-- Le statut d'un document devient significatif : « en_attente » désigne
-- désormais une reconnaissance de type en cours, et non plus un état jamais
-- mis à jour. Les documents déjà déposés ne sont pas dans cette file : ils
-- sont marqués traités pour que l'interface cesse de les annoncer en attente.

UPDATE "Document" SET "status" = 'traite' WHERE "status" = 'en_attente';
