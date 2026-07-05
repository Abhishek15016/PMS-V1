import { Module } from "@nestjs/common";
import { AuthBootstrapPrismaService } from "./auth-bootstrap-prisma.service";
import { AuthDevController } from "./auth-dev.controller";
import { authProviderFactories } from "./providers/auth-provider.factory";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";

@Module({
  controllers: [AuthController, AuthDevController],
  providers: [
    AuthService,
    SessionService,
    AuthBootstrapPrismaService,
    ...authProviderFactories,
  ],
})
export class AuthModule {}
