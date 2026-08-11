import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEST_PASSWORD = 'password123';

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@pilot.app' },
    update: { passwordHash },
    create: {
      email: 'test@pilot.app',
      name: 'Utilisateur Test',
      passwordHash,
    },
  });

  console.log('Utilisateur de test :', { ...user, passwordHash: '(hashé)' });
  console.log(`Identifiants de connexion -> email: ${user.email} / mot de passe: ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
