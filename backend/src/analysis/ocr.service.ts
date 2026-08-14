import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { createWorker, OEM } from 'tesseract.js';

export interface OcrResult {
  text: string;
  warning: string | null;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_MEANINGFUL_TEXT_LENGTH = 20;
/** Chargement du moteur et de son modèle de langue. */
const WORKER_TIMEOUT_MS = 30_000;
/** Une page se lit en quelques secondes ; au-delà, quelque chose est bloqué. */
const RECOGNITION_TIMEOUT_MS = 45_000;

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`lecture optique interrompue après ${ms} ms`)),
          ms,
        ).unref(),
      ),
    ]);
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer);
    }
    if (IMAGE_MIME_TYPES.includes(mimeType)) {
      return this.extractFromImage(buffer);
    }
    return {
      text: '',
      warning: 'Type de fichier non pris en charge pour l’analyse',
    };
  }

  private async extractFromPdf(buffer: Buffer): Promise<OcrResult> {
    let text = '';
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text ?? '';
    } catch (error) {
      this.logger.error('Lecture du PDF échouée', error);
      return {
        text: '',
        warning: 'Ce PDF n’a pas pu être lu (fichier corrompu ou invalide).',
      };
    }

    if (text.trim().length < MIN_MEANINGFUL_TEXT_LENGTH) {
      return {
        text,
        warning:
          'Aucun texte détecté dans ce PDF (probablement scanné) — la lecture optique des PDF scannés n’est pas encore prise en charge, seuls les PDF avec texte intégré ou les images sont analysés.',
      };
    }
    return { text, warning: null };
  }

  private async extractFromImage(buffer: Buffer): Promise<OcrResult> {
    const failure: OcrResult = {
      text: '',
      warning: "L'analyse de cette image a échoué.",
    };

    // Le premier appel télécharge le modèle français. Deux précautions sont
    // indispensables à cette étape :
    //
    //  - errorHandler : sans lui, tesseract.js relance l'erreur depuis le
    //    message du worker, hors de toute promesse. Elle devenait une
    //    exception non capturée, et le serveur entier tombait sur une simple
    //    image illisible ou un modèle inaccessible ;
    //  - une échéance : lorsque le chargement du modèle échoue, la promesse de
    //    création n'est pas rejetée, elle reste en suspens. L'analyse aurait
    //    attendu indéfiniment.
    const creation = createWorker('fra', OEM.LSTM_ONLY, {
      errorHandler: (error) =>
        this.logger.error(
          `Moteur OCR en erreur : ${error instanceof Error ? error.message : String(error)}`,
        ),
    });

    let worker: OcrWorker;
    try {
      worker = await this.withTimeout(creation, WORKER_TIMEOUT_MS);
    } catch (error) {
      this.logger.error('Moteur OCR indisponible', error);
      // Si la création aboutit plus tard, le moteur est libéré malgré tout.
      void creation.then((late) => late.terminate()).catch(() => undefined);
      return failure;
    }

    try {
      const {
        data: { text },
      } = await this.withTimeout(
        worker.recognize(buffer),
        RECOGNITION_TIMEOUT_MS,
      );
      if (text.trim().length < MIN_MEANINGFUL_TEXT_LENGTH) {
        return {
          text,
          warning: 'Peu ou pas de texte détecté dans cette image.',
        };
      }
      return { text, warning: null };
    } catch (error) {
      this.logger.error('OCR image échoué', error);
      return failure;
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  }
}
