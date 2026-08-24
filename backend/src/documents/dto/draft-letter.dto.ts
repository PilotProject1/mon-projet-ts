import { IsIn } from 'class-validator';

export class DraftLetterDto {
  @IsIn(['resiliation', 'contestation'])
  kind: 'resiliation' | 'contestation';
}
