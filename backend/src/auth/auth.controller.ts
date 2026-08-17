import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from './decorators/current-user.decorator';

/*
 * Limites resserrées sur les routes d'identité : cinq créations de compte et
 * huit tentatives de connexion par minute et par adresse, c'est ce qui tient
 * la force brute à distance.
 *
 * Elles s'ouvrent en environnement de test, comme la limite générale : une
 * suite qui crée vingt comptes en trois secondes se heurterait sinon à sa
 * propre protection, et cesserait de vérifier ce qu'elle doit vérifier.
 */
const EN_TEST = process.env.NODE_ENV === 'test';
const LIMITE_INSCRIPTION = EN_TEST ? 10_000 : 5;
const LIMITE_CONNEXION = EN_TEST ? 10_000 : 8;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: LIMITE_INSCRIPTION, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LIMITE_CONNEXION, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user.userId);
  }
}
