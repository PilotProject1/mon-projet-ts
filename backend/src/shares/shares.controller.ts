import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  create(@Body() dto: CreateShareDto, @CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.findAll(user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.sharesService.revoke(id, user.userId);
  }
}
