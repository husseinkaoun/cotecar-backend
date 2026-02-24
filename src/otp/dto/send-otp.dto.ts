import { IsIn, IsString, MinLength } from "class-validator";

export class SendOtpDto {
  @IsIn(["SMS", "EMAIL"])
  channel!: "SMS" | "EMAIL";

  @IsString()
  @MinLength(5)
  target!: string; // phone or email
}
