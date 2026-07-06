import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { TokenService } from "../../common/token/token.service";
import {
  MagicLinkProvider,
  SsoProvider,
} from "./providers/auth-provider.interface";
import {
  MAGIC_LINK_PROVIDER,
  SSO_PROVIDER,
} from "./providers/auth-provider.tokens";
import { SessionService } from "./session.service";
import { AuthBootstrapPrismaService } from "./auth-bootstrap-prisma.service";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: User["role"];
  departmentId: string | null;
  companyId: string | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly bootstrap: AuthBootstrapPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    @Inject(SSO_PROVIDER) private readonly ssoProvider: SsoProvider,
    @Inject(MAGIC_LINK_PROVIDER)
    private readonly magicLinkProvider: MagicLinkProvider,
  ) {}

  async ssoCallback(
    tenantSlug: string,
    email: string | undefined,
    code: string | undefined,
  ): Promise<AuthResult> {
    const institution = await this.requireInstitution(tenantSlug);
    const result = await this.ssoProvider.handleCallback({
      tenantId: institution.id,
      email,
      code,
    });
    const user = await this.requireActiveUser(institution.id, result.email);
    return this.issueTokens(institution.id, user);
  }

  /** Always resolves (no error) so the response can't be used to enumerate which emails have accounts. */
  async requestMagicLink(tenantSlug: string, email: string): Promise<void> {
    const institution = await this.requireInstitution(tenantSlug);
    const user = await this.tenantPrisma.run(institution.id, (tx) =>
      tx.user.findUnique({
        where: { tenantId_email: { tenantId: institution.id, email } },
      }),
    );
    if (!user || user.status !== "ACTIVE") return;

    const rawToken = this.tokenService.generateOpaqueToken();
    const tokenHash = this.tokenService.hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

    await this.tenantPrisma.run(institution.id, (tx) =>
      tx.magicLinkToken.create({
        data: { tenantId: institution.id, email, tokenHash, expiresAt },
      }),
    );
    await this.magicLinkProvider.sendMagicLink({
      email,
      tenantId: institution.id,
      token: rawToken,
      expiresAt,
    });
  }

  async verifyMagicLink(rawToken: string): Promise<AuthResult> {
    const tokenHash = this.tokenService.hashOpaqueToken(rawToken);
    const tokenRow = await this.bootstrap.findMagicLinkTokenByHash(tokenHash);
    if (!tokenRow) {
      throw new UnauthorizedException("Invalid or expired magic link");
    }

    return this.tenantPrisma.run(tokenRow.tenantId, async (tx) => {
      // Re-fetch and consume atomically inside the tenant-scoped transaction
      // to close the race window between the bootstrap lookup above and the
      // consume below (two concurrent verify calls on the same link).
      const fresh = await tx.magicLinkToken.findUnique({
        where: { id: tokenRow.id },
      });
      if (!fresh || fresh.consumedAt) {
        throw new UnauthorizedException(
          "This magic link has already been used",
        );
      }
      if (fresh.expiresAt < new Date()) {
        throw new UnauthorizedException("This magic link has expired");
      }
      await tx.magicLinkToken.update({
        where: { id: fresh.id },
        data: { consumedAt: new Date() },
      });

      const user = await tx.user.findUnique({
        where: {
          tenantId_email: { tenantId: fresh.tenantId, email: fresh.email },
        },
      });
      if (!user || user.status !== "ACTIVE") {
        throw new UnauthorizedException(
          "No active account found for this email",
        );
      }

      const accessToken = this.tokenService.signAccessToken({
        sub: user.id,
        tenantId: fresh.tenantId,
        role: user.role,
        departmentId: user.departmentId,
        companyId: user.companyId,
      });
      const refreshToken = await this.sessionService.createSessionWithTx(
        tx,
        fresh.tenantId,
        user.id,
      );

      return { accessToken, refreshToken, user: this.toPublicUser(user) };
    });
  }

  async refresh(presentedRefreshToken: string): Promise<AuthResult> {
    const { tenantId, userId, refreshToken } =
      await this.sessionService.rotateSession(presentedRefreshToken);
    const user = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
    );
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      tenantId,
      role: user.role,
      departmentId: user.departmentId,
      companyId: user.companyId,
    });
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  async logout(presentedRefreshToken: string): Promise<void> {
    await this.sessionService.revokeByRefreshToken(presentedRefreshToken);
  }

  private async requireInstitution(slug: string) {
    const institution = await this.bootstrap.findInstitutionBySlug(slug);
    if (!institution) {
      throw new NotFoundException("Institution not found");
    }
    // Platform-level kill switch (operator console): a suspended client's
    // users can't start new sessions. Existing refresh tokens ride out
    // their 7-day TTL — acceptable for a billing-grade suspension, not a
    // security revocation.
    if (institution.status !== "ACTIVE") {
      throw new ForbiddenException(
        "This institution's access is suspended — contact your platform provider",
      );
    }
    return institution;
  }

  private async requireActiveUser(
    tenantId: string,
    email: string,
  ): Promise<User> {
    const user = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.user.findUnique({ where: { tenantId_email: { tenantId, email } } }),
    );
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("No active account found for this email");
    }
    return user;
  }

  private async issueTokens(tenantId: string, user: User): Promise<AuthResult> {
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      tenantId,
      role: user.role,
      departmentId: user.departmentId,
      companyId: user.companyId,
    });
    const refreshToken = await this.sessionService.createSession(
      tenantId,
      user.id,
    );
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      departmentId: user.departmentId,
      companyId: user.companyId,
    };
  }
}
