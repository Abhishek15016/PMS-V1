import { IsEmail, IsString, MinLength } from "class-validator";

export class MagicLinkRequestDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsEmail()
  email!: string;
}
