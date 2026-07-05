import { IsOptional, IsString, MinLength } from "class-validator";

export class SsoCallbackDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  code?: string;
}
