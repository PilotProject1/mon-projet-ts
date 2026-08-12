import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  warning: string | null;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_MEANINGFUL_TEXT_LENGTH = 20;

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

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
    const worker = await createWorker('fra');
    try {
      const {
        data: { text },
      } = await worker.recognize(buffer);
      if (text.trim().length < MIN_MEANINGFUL_TEXT_LENGTH) {
        return {
          text,
          warning: 'Peu ou pas de texte détecté dans cette image.',
        };
      }
      return { text, warning: null };
    } catch (error) {
      this.logger.error('OCR image échoué', error);
      return { text: '', warning: "L'analyse de cette image a échoué." };
    } finally {
      await worker.terminate();
    }
  }
}
