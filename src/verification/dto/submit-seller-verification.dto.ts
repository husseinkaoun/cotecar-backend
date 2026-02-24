import { IsOptional, IsString, MinLength } from "class-validator";

export class SubmitSellerVerificationDto {
  @IsString()
  @MinLength(2)
  idType!: string;

  @IsOptional()
  @IsString()
  idNumber?: string;
}
