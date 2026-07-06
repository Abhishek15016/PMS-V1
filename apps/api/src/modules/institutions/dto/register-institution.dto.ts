import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterInstitutionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  institutionName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  adminName!: string;

  @IsEmail()
  adminEmail!: string;
}
