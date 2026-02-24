import { IsIn, IsOptional, IsString } from "class-validator";

export class AdminReviewDto {
  @IsIn(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  @IsOptional()
  @IsString()
  note?: string;
}
