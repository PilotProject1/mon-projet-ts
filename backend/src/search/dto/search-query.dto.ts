import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string;
}
