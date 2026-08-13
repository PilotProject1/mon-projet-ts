import { SetMetadata } from '@nestjs/common';
import type { PlanFeature } from './plan.config';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/**
 * Restreint une route (ou un contrôleur entier) aux plans incluant la
 * fonctionnalité indiquée. À utiliser avec PlanFeatureGuard.
 */
export const RequiresFeature = (feature: PlanFeature) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);
