import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let storage: any;
  let ocr: any;
  let extraction: any;
  let ai: any;
  let aiExtraction: any;
  let aiLetter: any;
  let plans: any;

  const ownerId = 'user-1';
  const otherId = 'user-2';
  const document = {
    id: 'doc-1',
    userId: ownerId,
    fileKey: 'key-1',
    mimeType: 'application/pdf',
  };

  beforeEach(() => {
    prisma = {
      document: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };
    storage = {
      save: jest.fn(),
      createReadStream: jest.fn(),
      getBuffer: jest.fn(),
      delete: jest.fn(),
    };
    ocr = { extractText: jest.fn() };
    // categorise rend null par défaut : ces cas portent sur l'extraction des
    // champs, non sur le rangement, et un domaine surgissant au milieu
    // brouillerait ce qu'ils vérifient.
    extraction = {
      extract: jest.fn(),
      categorise: jest.fn().mockReturnValue(null),
    };
    ai = { available: false };
    aiExtraction = { extract: jest.fn() };
    aiLetter = { draft: jest.fn() };
    // Par défaut le plan de test autorise l'IA : les cas existants vérifient
    // le comportement de l'extraction, pas la restriction par plan.
    plans = {
      getPlan: jest.fn().mockResolvedValue('premium'),
      hasFeature: jest.fn().mockReturnValue(true),
      assertCanAddDocument: jest.fn().mockResolvedValue(undefined),
    };

    service = new DocumentsService(
      prisma,
      storage,
      ocr,
      extraction,
      ai,
      aiExtraction,
      aiLetter,
      plans,
    );
  });

  describe('findOne (ownership)', () => {
    it('throws NotFoundException when the document does not exist', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', ownerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when another user owns the document', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await expect(service.findOne(document.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the document for its owner', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await expect(service.findOne(document.id, ownerId)).resolves.toEqual(
        document,
      );
    });
  });

  describe('update', () => {
    it('blocks updates from a non-owner before touching prisma.update', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await expect(
        service.update(document.id, { name: 'x' } as any, otherId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('blocks deletion from a non-owner and does not touch storage', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await expect(service.remove(document.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.document.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the db row and the stored file for the owner', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await service.remove(document.id, ownerId);

      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: document.id },
      });
      expect(storage.delete).toHaveBeenCalledWith(document.fileKey);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      storage.save.mockResolvedValue({
        key: 'key-1',
        mimeType: 'application/pdf',
        sizeBytes: 42,
      });
    });

    it('met le document en analyse quand aucun type n’est imposé', async () => {
      prisma.document.create.mockResolvedValue({ ...document, id: 'doc-neuf' });
      prisma.document.findUnique.mockResolvedValue(null); // interrompt la reconnaissance

      await service.create({ name: 'Sans type' }, ownerId, {} as any);

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'autre',
            status: 'en_attente',
          }),
        }),
      );
    });

    it('tient pour traité un document dont le type est choisi à la main', async () => {
      prisma.document.create.mockResolvedValue(document);

      await service.create(
        { name: 'Avec type', type: 'facture' } as any,
        ownerId,
        {} as any,
      );

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'facture', status: 'traite' }),
        }),
      );
      // Aucune lecture n'est engagée : le type est déjà connu.
      expect(storage.getBuffer).not.toHaveBeenCalled();
    });

    it('refuse d’ajouter au-delà du quota, avant toute écriture', async () => {
      plans.assertCanAddDocument.mockRejectedValue(new Error('quota atteint'));

      await expect(
        service.create({ name: 'Trop' } as any, ownerId, {} as any),
      ).rejects.toThrow('quota atteint');
      expect(storage.save).not.toHaveBeenCalled();
    });
  });

  describe('analyze', () => {
    it('rejects analysis of a document owned by someone else', async () => {
      prisma.document.findUnique.mockResolvedValue(document);

      await expect(service.analyze(document.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(storage.getBuffer).not.toHaveBeenCalled();
    });

    /*
     * Un document déposé avant l'existence des domaines n'en a aucun, et le
     * classement ne tournait qu'au dépôt : sans cela, il n'aurait jamais pu
     * en recevoir un autrement qu'en étant redéposé.
     */
    it('range un document qui n’a pas encore de domaine', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        category: null,
      });
      storage.getBuffer.mockResolvedValue(Buffer.from('file-bytes'));
      ocr.extractText.mockResolvedValue({
        text: 'Quittance de loyer',
        warning: undefined,
      });
      extraction.extract.mockReturnValue({});
      extraction.categorise.mockReturnValue('maison');

      await service.analyze(document.id, ownerId);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'maison' }),
        }),
      );
    });

    it('ne défait pas un rangement déjà décidé', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        category: 'famille',
      });
      storage.getBuffer.mockResolvedValue(Buffer.from('file-bytes'));
      ocr.extractText.mockResolvedValue({
        text: 'Quittance de loyer',
        warning: undefined,
      });
      extraction.extract.mockReturnValue({});
      // La lecture dirait « maison » : le choix existant doit primer.
      extraction.categorise.mockReturnValue('maison');

      await service.analyze(document.id, ownerId);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'famille' }),
        }),
      );
    });

    it('runs OCR + extraction and returns a preview capped at 500 chars', async () => {
      prisma.document.findUnique.mockResolvedValue(document);
      storage.getBuffer.mockResolvedValue(Buffer.from('file-bytes'));
      const longText = 'A'.repeat(600);
      ocr.extractText.mockResolvedValue({ text: longText, warning: undefined });
      extraction.extract.mockReturnValue({
        suggestedAmount: 42,
        suggestedProvider: 'EDF',
      });

      const result = await service.analyze(document.id, ownerId);

      expect(ocr.extractText).toHaveBeenCalledWith(
        Buffer.from('file-bytes'),
        document.mimeType,
      );
      expect(result.rawTextPreview).toHaveLength(500);
      expect(result.suggestedAmount).toBe(42);
      expect(result.suggestedProvider).toBe('EDF');
      expect(aiExtraction.extract).not.toHaveBeenCalled();
    });

    it('uses the AI extractor instead of the heuristic one when configured', async () => {
      prisma.document.findUnique.mockResolvedValue(document);
      storage.getBuffer.mockResolvedValue(Buffer.from('file-bytes'));
      ocr.extractText.mockResolvedValue({ text: 'Facture EDF', warning: null });
      ai.available = true;
      aiExtraction.extract.mockResolvedValue({
        suggestedType: 'facture',
        suggestedProvider: 'EDF',
        suggestedDates: [],
        suggestedAmount: 99,
      });

      const result = await service.analyze(document.id, ownerId);

      expect(aiExtraction.extract).toHaveBeenCalledWith('Facture EDF');
      expect(extraction.extract).not.toHaveBeenCalled();
      expect(result.suggestedAmount).toBe(99);
    });

    it('falls back to the heuristic extractor when the AI call fails', async () => {
      prisma.document.findUnique.mockResolvedValue(document);
      storage.getBuffer.mockResolvedValue(Buffer.from('file-bytes'));
      ocr.extractText.mockResolvedValue({ text: 'Facture EDF', warning: null });
      ai.available = true;
      aiExtraction.extract.mockRejectedValue(new Error('timeout'));
      extraction.extract.mockReturnValue({
        suggestedType: 'facture',
        suggestedProvider: 'EDF',
        suggestedDates: [],
        suggestedAmount: 10,
      });

      const result = await service.analyze(document.id, ownerId);

      expect(result.suggestedAmount).toBe(10);
    });
  });

  describe('draftLetter', () => {
    it('rejects a letter for a document owned by someone else', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'contrat',
        provider: 'Free',
      });

      await expect(
        service.draftLetter(document.id, otherId, 'resiliation'),
      ).rejects.toThrow(ForbiddenException);
      expect(aiLetter.draft).not.toHaveBeenCalled();
    });

    it('refuse une résiliation sur un document qui n’est ni un contrat ni une assurance', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'courrier',
        provider: 'Free',
      });

      await expect(
        service.draftLetter(document.id, ownerId, 'resiliation'),
      ).rejects.toThrow(BadRequestException);
      expect(aiLetter.draft).not.toHaveBeenCalled();
    });

    it('refuse une résiliation sans émetteur identifié', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'contrat',
        provider: null,
      });

      await expect(
        service.draftLetter(document.id, ownerId, 'resiliation'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une contestation sur un document qui n’est pas une facture', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'contrat',
        provider: 'EDF',
        amount: 42,
        paid: false,
      });

      await expect(
        service.draftLetter(document.id, ownerId, 'contestation'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse une contestation sur une facture déjà réglée', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'facture',
        provider: 'EDF',
        amount: 42,
        paid: true,
      });

      await expect(
        service.draftLetter(document.id, ownerId, 'contestation'),
      ).rejects.toThrow(BadRequestException);
    });

    it('prépare une résiliation à partir des faits du document', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'assurance',
        provider: 'MAIF',
        reference: 'POL-998877',
        documentDate: new Date('2026-01-10T00:00:00.000Z'),
        amount: null,
      });
      aiLetter.draft.mockResolvedValue({ subject: 'Résiliation', body: '...' });

      const result = await service.draftLetter(
        document.id,
        ownerId,
        'resiliation',
      );

      expect(aiLetter.draft).toHaveBeenCalledWith({
        kind: 'resiliation',
        provider: 'MAIF',
        reference: 'POL-998877',
        documentDate: new Date('2026-01-10T00:00:00.000Z'),
        amount: null,
      });
      expect(result).toEqual({ subject: 'Résiliation', body: '...' });
    });

    it('prépare une contestation pour une facture impayée', async () => {
      prisma.document.findUnique.mockResolvedValue({
        ...document,
        type: 'facture',
        provider: 'EDF',
        reference: null,
        documentDate: null,
        amount: 84.3,
        paid: false,
      });
      aiLetter.draft.mockResolvedValue({
        subject: 'Contestation',
        body: '...',
      });

      const result = await service.draftLetter(
        document.id,
        ownerId,
        'contestation',
      );

      expect(aiLetter.draft).toHaveBeenCalledWith({
        kind: 'contestation',
        provider: 'EDF',
        reference: null,
        documentDate: null,
        amount: 84.3,
      });
      expect(result).toEqual({ subject: 'Contestation', body: '...' });
    });
  });

  describe('getFileStream', () => {
    it('delegates to storage with the file key', () => {
      const stream = new Readable();
      storage.createReadStream.mockReturnValue(stream);

      expect(service.getFileStream('key-1')).toBe(stream);
      expect(storage.createReadStream).toHaveBeenCalledWith('key-1');
    });
  });
});
