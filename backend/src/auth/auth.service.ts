import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
/*
 * Le jeton de défi ne vaut qu'entre le mot de passe et le code : cinq minutes
 * suffisent à sortir son téléphone, et passé ce délai il faut redonner son
 * mot de passe — ce qui repasse par la limitation des tentatives.
 */
const CHALLENGE_TOKEN_EXPIRES_IN = '5m';

/*
 * `typ` distingue un jeton d'accès d'un jeton de défi. Les deux sont signés
 * avec le même secret, et sans cette mention un défi — obtenu avec le seul
 * mot de passe — serait accepté comme un accès complet : la double
 * authentification ne protègerait rien. La stratégie JWT refuse tout jeton
 * dont le `typ` n'est pas 'acces'.
 */
interface JwtPayload {
  sub: string;
  email: string;
  typ?: 'acces' | 'defi';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  private signTokens(payload: { sub: string; email: string }) {
    const accessToken = this.jwtService.sign(
      { ...payload, typ: 'acces' },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      },
    );
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    const tokens = this.signTokens({ sub: user.id, email: user.email });
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    /*
     * Compte protégé : le mot de passe ne suffit plus. On ne délivre aucun
     * jeton d'accès ici — seulement un droit de présenter un code, valable
     * cinq minutes. C'est tout l'intérêt du second facteur : un mot de passe
     * qui a fuité ne mène nulle part.
     */
    if (user.twoFactorEnabledAt) {
      return {
        deuxiemeFacteurRequis: true as const,
        challengeToken: this.jwtService.sign(
          { sub: user.id, email: user.email, typ: 'defi' },
          {
            secret: process.env.JWT_ACCESS_SECRET,
            expiresIn: CHALLENGE_TOKEN_EXPIRES_IN,
          },
        ),
      };
    }

    const tokens = this.signTokens({ sub: user.id, email: user.email });
    return { ...tokens, user: this.toPublicUser(user) };
  }

  /**
   * Second temps de la connexion : le code, temporel ou de secours.
   *
   * Le jeton de défi ne prouve que le mot de passe. Il est reverifié ici —
   * signature, expiration, et surtout son `typ` : un jeton d'accès présenté à
   * cette place n'ouvrirait rien de plus qu'il n'ouvre déjà.
   */
  async loginDeuxiemeFacteur(challengeToken: string, code: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(challengeToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        'Délai dépassé : recommencez la connexion',
      );
    }
    if (payload.typ !== 'defi') {
      throw new UnauthorizedException('Jeton invalide');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.twoFactorEnabledAt) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.twoFactor.verifierCode(user, code);

    const tokens = this.signTokens({ sub: user.id, email: user.email });
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        'Token de rafraîchissement invalide ou expiré',
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    const tokens = this.signTokens({ sub: user.id, email: user.email });
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    return this.toPublicUser(user);
  }
}
