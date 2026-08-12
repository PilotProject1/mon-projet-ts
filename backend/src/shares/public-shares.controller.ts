import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { SharesService } from './shares.service';

@Controller('public/shares')
export class PublicSharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Get(':token')
  async getInfo(@Param('token') token: string) {
    const link = await this.sharesService.resolvePublicShare(token);
    return {
      documentName: link.document.name,
      documentType: link.document.type,
      mimeType: link.document.mimeType,
      expiresAt: link.expiresAt,
    };
  }

  @Get(':token/file')
  async getFile(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const link = await this.sharesService.resolvePublicShare(token);
    res.set({
      'Content-Type': link.document.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(link.document.name)}"`,
    });
    return new StreamableFile(
      this.sharesService.getFileStream(link.document.fileKey),
    );
  }
}
