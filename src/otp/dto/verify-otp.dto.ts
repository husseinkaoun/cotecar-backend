import { IsIn, IsString, Length, MinLength } from "class-validator";

export class VerifyOtpDto {
  @IsIn(["SMS", "EMAIL"])
  channel!: "SMS" | "EMAIL";

  @IsString()
  @MinLength(5)
  target!: string;

  @IsString()
  @Length(6, 6)
  code!: string; // "123456"
}
