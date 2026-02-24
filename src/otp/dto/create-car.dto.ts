
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateCarDto {
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsInt()
  @Min(1900)
  year!: number;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
