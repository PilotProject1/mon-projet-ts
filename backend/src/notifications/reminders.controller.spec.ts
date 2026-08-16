import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import type { RemindersService } from './reminders.service';
import type { WeeklyDigestService } from '../briefing/weekly-digest.service';

describe('RemindersController', () => {
  const JETON = 'jeton-secret-de-declenchement';
  let controller: RemindersController;
  let reminders: { run: jest.Mock };
  let digest: { run: jest.Mock };
  const jetonInitial = process.env.REMINDERS_TRIGGER_TOKEN;

  beforeEach(() => {
    reminders = {
      run: jest
        .fn()
        .mockResolvedValue({ examined: 3, sent: 2, alreadySent: 1, failed: 0 }),
    };
    digest = {
      run: jest.fn().mockResolvedValue({
        examined: 0,
        sent: 0,
        nothingToSay: 0,
        failed: 0,
      }),
    };
    controller = new RemindersController(
      reminders as unknown as RemindersService,
      digest as unknown as WeeklyDigestService,
    );
    process.env.REMINDERS_TRIGGER_TOKEN = JETON;
  });

  afterEach(() => {
    if (jetonInitial === undefined) delete process.env.REMINDERS_TRIGGER_TOKEN;
    else process.env.REMINDERS_TRIGGER_TOKEN = jetonInitial;
  });

  it('exécute la tournée avec le bon jeton', async () => {
    await expect(controller.run(JETON)).resolves.toEqual({
      examined: 3,
      sent: 2,
      alreadySent: 1,
      failed: 0,
      digest: { examined: 0, sent: 0, nothingToSay: 0, failed: 0 },
    });
    expect(reminders.run).toHaveBeenCalled();
    // Le même appel porte les deux tournées : c'est lui qui réveille
    // l'instance, et le planificateur interne ne tourne pas quand elle dort.
    expect(digest.run).toHaveBeenCalled();
  });

  it('refuse un jeton erroné', async () => {
    await expect(controller.run('mauvais-jeton')).rejects.toThrow(
      ForbiddenException,
    );
    expect(reminders.run).not.toHaveBeenCalled();
  });

  it('refuse un jeton de même longueur mais différent', async () => {
    const leurre = 'x'.repeat(JETON.length);
    await expect(controller.run(leurre)).rejects.toThrow(ForbiddenException);
    expect(reminders.run).not.toHaveBeenCalled();
  });

  it('refuse une requête sans jeton', async () => {
    await expect(controller.run(undefined)).rejects.toThrow(ForbiddenException);
    expect(reminders.run).not.toHaveBeenCalled();
  });

  it('reste fermé tant qu’aucun jeton n’est configuré', async () => {
    delete process.env.REMINDERS_TRIGGER_TOKEN;

    // Y compris lorsque la requête n'en présente aucun : l'absence de
    // configuration ne doit jamais ouvrir le point d'entrée.
    await expect(controller.run(undefined)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(controller.run('')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(reminders.run).not.toHaveBeenCalled();
  });
});
