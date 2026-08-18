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
import { TwoFactorService } from './two-factor.service';
import {
  ActiverDeuxiemeFacteurDto,
  ConnexionDeuxiemeFacteurDto,
  RetirerDeuxiemeFacteurDto,
} from './dto/two-factor.dto';
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
/*
 * Six chiffres se devinent avec assez d'essais. Six tentatives par minute et
 * par adresse, contre un jeton de défi qui expire au bout de cinq minutes,
 * laissent une trentaine d'essais pour un million de combinaisons — et il
 * faut redonner le mot de passe pour en obtenir trente de plus.
 */
const LIMITE_CODE = EN_TEST ? 10_000 : 6;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

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

  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LIMITE_CODE, ttl: 60_000 } })
  loginDeuxiemeFacteur(@Body() dto: ConnexionDeuxiemeFacteurDto) {
    return this.authService.loginDeuxiemeFacteur(dto.challengeToken, dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.me(user.userId);
  }

  @Get('2fa')
  @UseGuards(JwtAuthGuard)
  etatDeuxiemeFacteur(@CurrentUser() user: CurrentUserPayload) {
    return this.twoFactor.etat(user.userId);
  }

  @Post('2fa/preparer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  preparerDeuxiemeFacteur(@CurrentUser() user: CurrentUserPayload) {
    return this.twoFactor.preparer(user.userId);
  }

  @Post('2fa/activer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: LIMITE_CODE, ttl: 60_000 } })
  activerDeuxiemeFacteur(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ActiverDeuxiemeFacteurDto,
  ) {
    return this.twoFactor.activer(user.userId, dto.code);
  }

  @Post('2fa/retirer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: LIMITE_CODE, ttl: 60_000 } })
  async retirerDeuxiemeFacteur(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RetirerDeuxiemeFacteurDto,
  ) {
    await this.twoFactor.desactiver(user.userId, dto.password, dto.code);
  }

  @Post('2fa/codes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: LIMITE_CODE, ttl: 60_000 } })
  renouvelerLesCodes(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RetirerDeuxiemeFacteurDto,
  ) {
    return this.twoFactor.renouvelerLesCodes(
      user.userId,
      dto.password,
      dto.code,
    );
  }
}
