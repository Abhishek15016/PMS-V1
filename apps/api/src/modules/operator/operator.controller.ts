import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsIn, IsString } from "class-validator";
import { RegisterInstitutionDto } from "../institutions/dto/register-institution.dto";
import { InstitutionsService } from "../institutions/institutions.service";
import { OperatorGuard } from "./operator.guard";
import { OperatorService } from "./operator.service";

class SetStatusDto {
  @IsString()
  @IsIn(["ACTIVE", "SUSPENDED"])
  status!: string;
}

/** Vendor console API — see OperatorGuard for the trust model. */
@Controller("operator")
@UseGuards(OperatorGuard)
export class OperatorController {
  constructor(
    private readonly operatorService: OperatorService,
    private readonly institutionsService: InstitutionsService,
  ) {}

  @Get("institutions")
  list() {
    return this.operatorService.listInstitutions();
  }

  /** Sales-led provisioning: the vendor creates a client workspace on their behalf. */
  @Post("institutions")
  provision(@Body() dto: RegisterInstitutionDto) {
    return this.institutionsService.register(dto);
  }

  @Patch("institutions/:id/status")
  setStatus(@Param("id") id: string, @Body() dto: SetStatusDto) {
    return this.operatorService.setStatus(id, dto.status);
  }
}
