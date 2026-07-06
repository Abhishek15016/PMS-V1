import { IsOptional, IsUrl, ValidateIf } from "class-validator";

/** All four are optional; sending null clears a link. */
export class UpdateStudentLinksDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  linkedinUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  githubUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  leetcodeUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  codeforcesUrl?: string | null;
}
