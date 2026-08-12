import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports ok when the database responds', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.health();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('ok');
    });

    it('throws ServiceUnavailableException when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(appController.health()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
