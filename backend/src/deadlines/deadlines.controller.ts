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
  Query,
} from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';

@Controller('deadlines')
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Post()
  create(@Body() dto: CreateDeadlineDto) {
    return this.deadlinesService.create(dto);
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.deadlinesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deadlinesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeadlineDto) {
    return this.deadlinesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.deadlinesService.remove(id);
  }
}
