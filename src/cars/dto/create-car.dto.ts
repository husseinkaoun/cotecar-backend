// ✅ FILE: src/cars/dto/create-car.dto.ts

import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from "class-validator";

export class CreateCarDto {
  // ✅ REQUIRED
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  brand!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  model!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(4)
  year!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(15)
  price!: string;

  // ✅ OPTIONAL
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fuel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  mileage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  transmission?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  carType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // 📍 Location
  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lng?: string;
}
