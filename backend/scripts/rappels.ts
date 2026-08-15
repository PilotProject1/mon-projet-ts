/*
 * Déclenche à la main la tournée des rappels d'échéance.
 *
 *   npm run rappels
 *
 * Utile pour vérifier la configuration SMTP sans attendre l'heure de la
 * tournée automatique. L'opération est idempotente : la relancer n'envoie
 * pas de second rappel pour un palier déjà notifié.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { RemindersService } from '../src/notifications/reminders.service';

async function main() {
  const logger = new Logger('rappels');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const summary = await app.get(RemindersService).run();
    logger.log(
      `${summary.sent} rappel(s) envoyé(s), ${summary.alreadySent} déjà notifié(s), ` +
        `${summary.failed} en erreur, sur ${summary.examined} échéance(s) examinée(s)`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
