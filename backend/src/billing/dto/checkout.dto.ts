import { IsIn, IsOptional } from 'class-validator';
import {
  BILLING_INTERVALS,
  PURCHASABLE_PLANS,
  type BillingInterval,
  type PurchasablePlan,
} from '../../plans/plan.config';

export class CheckoutDto {
  @IsIn([...PURCHASABLE_PLANS], {
    message: `plan doit valoir : ${PURCHASABLE_PLANS.join(', ')}`,
  })
  plan: PurchasablePlan;

  /**
   * Absente, la périodicité vaut mensuel : les clients déjà déployés
   * n'envoient pas ce champ, et leur paiement doit continuer de passer.
   */
  @IsOptional()
  @IsIn([...BILLING_INTERVALS], {
    message: `interval doit valoir : ${BILLING_INTERVALS.join(', ')}`,
  })
  interval?: BillingInterval;
}
