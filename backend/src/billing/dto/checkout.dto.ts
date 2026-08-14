import { IsIn } from 'class-validator';
import { PURCHASABLE_PLANS, type PurchasablePlan } from '../../plans/plan.config';

export class CheckoutDto {
  @IsIn([...PURCHASABLE_PLANS], {
    message: `plan doit valoir : ${PURCHASABLE_PLANS.join(', ')}`,
  })
  plan: PurchasablePlan;
}
