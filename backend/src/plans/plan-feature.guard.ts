import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlansService } from './plans.service';
import { REQUIRES_FEATURE_KEY } from './requires-feature.decorator';
import type { PlanFeature } from './plan.config';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plansService: PlansService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      REQUIRES_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    if (!request.user) {
      throw new UnauthorizedException();
    }

    // Lève une ForbiddenException détaillée si le plan ne couvre pas la fonctionnalité.
    await this.plansService.assertFeature(request.user.userId, feature);
    return true;
  }
}
