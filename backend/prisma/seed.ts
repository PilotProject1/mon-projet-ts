import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'test@pilot.app' },
    update: {},
    create: {
      email: 'test@pilot.app',
      name: 'Utilisateur Test',
      // Placeholder : le vrai hash de mot de passe (bcrypt) arrive en Phase 5.
      passwordHash: 'placeholder-en-attente-phase-5',
    },
  });

  console.log('Utilisateur de test :', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
