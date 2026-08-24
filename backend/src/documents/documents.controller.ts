import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DraftLetterDto } from './dto/draft-letter.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanFeatureGuard } from '../plans/plan-feature.guard';
import { RequiresFeature } from '../plans/requires-feature.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './file-upload.constants';
import { typeReel } from './file-signature';

@UseGuards(JwtAuthGuard, PlanFeatureGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Fichier requis');
    }
    // Le type annoncé vient du client et se change en une ligne : c'est le
    // contenu qui décide. Les deux doivent concorder, sans quoi un
    // exécutable renommé « facture.pdf » serait stocké puis resservi sous ce
    // type.
    const reel = typeReel(file.buffer);
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || reel !== file.mimetype) {
      throw new BadRequestException(
        'Type de fichier non autorisé (PDF, JPG, PNG ou WEBP uniquement)',
      );
    }
    return this.documentsService.create(dto, user.userId, file);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.documentsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.documentsService.findOne(id, user.userId);
  }

  @Get(':id/file')
  async getFile(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.documentsService.findOne(id, user.userId);
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.name)}"`,
    });
    return new StreamableFile(
      this.documentsService.getFileStream(document.fileKey),
    );
  }

  @Post(':id/analyze')
  analyze(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.documentsService.analyze(id, user.userId);
  }

  /** Accepte l'échéance repérée automatiquement dans le document. */
  @Post(':id/echeance-suggeree')
  acceptSuggestion(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentsService.acceptSuggestedDeadline(id, user.userId);
  }

  @Delete(':id/echeance-suggeree')
  dismissSuggestion(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentsService.dismissSuggestedDeadline(id, user.userId);
  }

  /** Brouillon de courrier (résiliation, contestation) — jamais envoyé seul. */
  @Post(':id/letter')
  @RequiresFeature('ia')
  draftLetter(
    @Param('id') id: string,
    @Body() dto: DraftLetterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentsService.draftLetter(id, user.userId, dto.kind);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.documentsService.remove(id, user.userId);
  }
}
