import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  findMine(@CurrentUser() user: CurrentUserPayload) {
    return this.companyService.findMine(user.userId);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.companyService.create(dto, user.userId);
  }

  @Patch()
  update(@Body() dto: UpdateCompanyDto, @CurrentUser() user: CurrentUserPayload) {
    return this.companyService.update(dto, user.userId);
  }
}
