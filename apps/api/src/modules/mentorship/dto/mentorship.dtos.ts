import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateThreadDto {
  @IsString()
  @MinLength(8)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  mentorStudentId?: string;
}

export class CreateReplyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;
}

export class UpdateMentorProfileDto {
  @IsBoolean()
  mentorOptIn!: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(140)
  mentorHeadline?: string | null;
}
