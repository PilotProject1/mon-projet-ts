import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  typ?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET manquant dans .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    /*
     * Le jeton de défi de la double authentification est signé avec ce même
     * secret : sans ce refus, il vaudrait accès complet, et le code ne
     * protégerait plus rien. Les jetons émis avant l'introduction de `typ`
     * n'en portent pas et restent valides le temps de leur quart d'heure.
     */
    if (payload.typ !== undefined && payload.typ !== 'acces') {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
