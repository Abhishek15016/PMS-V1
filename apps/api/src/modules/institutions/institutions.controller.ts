import { Body, Controller, Post } from "@nestjs/common";
import { RegisterInstitutionDto } from "./dto/register-institution.dto";
import { InstitutionsService } from "./institutions.service";

/**
 * Public (pre-auth) tenant onboarding — deliberately unguarded, like the
 * login endpoints. Abuse controls (rate limiting, email verification of the
 * admin) are part of the "production auth" work package alongside real SSO;
 * with the stub provider this endpoint is demo-grade by definition.
 */
@Controller("institutions")
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post("register")
  register(@Body() dto: RegisterInstitutionDto) {
    return this.institutionsService.register(dto);
  }
}
