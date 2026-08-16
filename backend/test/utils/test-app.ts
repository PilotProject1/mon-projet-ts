import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import type { Plan } from '@prisma/client';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

/**
 * Place un compte sur un plan donné.
 *
 * L'inscription ouvre un compte gratuit, et le partage comme la facturation
 * sont réservés aux plans payants. Les tests qui portent sur le cloisonnement
 * entre comptes doivent donc s'affranchir de cette barrière : sinon un refus
 * d'accès pour cause d'abonnement se ferait passer pour un refus de
 * propriété, et le test ne prouverait plus rien.
 */
export async function setPlan(
  app: INestApplication,
  userId: string,
  plan: Plan,
) {
  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { id: userId }, data: { plan } });
}

export async function cleanupUsers(app: INestApplication, userIds: string[]) {
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
