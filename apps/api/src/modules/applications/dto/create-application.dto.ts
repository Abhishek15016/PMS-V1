import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  driveId!: string;

  /** Required for ON_BEHALF callers (TPO/Faculty Coordinator); ignored for SELF (STUDENT) — a student always applies as themselves, never as someone else, regardless of what this field says. */
  @IsOptional()
  @IsString()
  studentId?: string;
}
