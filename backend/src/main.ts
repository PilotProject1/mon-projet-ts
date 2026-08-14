import 'dotenv/config';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  ...(IS_PRODUCTION ? ['FRONTEND_ORIGIN'] : []),
];

function assertRequiredEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes dans .env : ${missing.join(', ')}`,
    );
  }
}

async function bootstrap() {
  assertRequiredEnvVars();

  // rawBody: Stripe signe le corps exact de la requête. Sans conservation de
  // l'original, le reparsage JSON invaliderait toute vérification de signature.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Derriere un reverse proxy (Render, Railway, Fly...), necessaire pour que
  // l'adresse IP du client (rate-limiting) et le protocole (https) soient corrects.
  if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());

  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
