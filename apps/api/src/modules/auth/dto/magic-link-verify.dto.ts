import { IsString, MinLength } from "class-validator";

export class MagicLinkVerifyDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
