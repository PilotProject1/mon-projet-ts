import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { ResiliationService } from './resiliation.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../documents/file-upload.constants';
import { typeReel } from '../documents/file-signature';

/**
 * Outil public de résiliation.
 *
 * Volontairement ouvert sans compte : il s'adresse à quelqu'un qui cherche
 * « résilier son assurance » et n'a aucune raison de s'inscrire quelque part
 * avant d'avoir obtenu ce qu'il venait chercher. Le compte se propose après,
 * pour surveiller les autres contrats.
 *
 * Rien n'est conservé : le fichier est lu en mémoire et oublié avec la
 * requête.
 */
@Controller('public/resiliation')
export class ResiliationController {
  constructor(private readonly resiliation: ResiliationService) {}

  /*
   * Cinq analyses par quart d'heure et par adresse : de quoi essayer
   * plusieurs documents d'affilée, pas de quoi vider le budget du jour à
   * lui seul. Le plafond global prend le relais au-delà.
   *
   * Desserré sous test, comme la limite globale : sans cela, une poignée de
   * cas enchaînés se heurterait au quota et échouerait pour une raison
   * étrangère à ce qu'ils vérifient.
   */
  @Throttle({
    default: {
      ttl: 900_000,
      limit: process.env.NODE_ENV === 'test' ? 10_000 : 5,
    },
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async analyser(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }
    // Même règle que le dépôt authentifié : c'est le contenu qui décide du
    // type, jamais l'en-tête annoncé par le client.
    const reel = typeReel(file.buffer);
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || reel !== file.mimetype) {
      throw new BadRequestException(
        'Type de fichier non autorisé (PDF, JPG, PNG ou WEBP uniquement)',
      );
    }
    return this.resiliation.analyser(file);
  }
}
