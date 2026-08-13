import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanFeatureGuard } from '../plans/plan-feature.guard';
import { RequiresFeature } from '../plans/requires-feature.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PlanFeatureGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequiresFeature('facturation')
  create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.clientsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.clientsService.findOne(id, user.userId);
  }

  @Patch(':id')
  @RequiresFeature('facturation')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequiresFeature('facturation')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.clientsService.remove(id, user.userId);
  }
}
