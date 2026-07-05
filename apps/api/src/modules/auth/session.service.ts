import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { TokenService } from "../../common/token/token.service";

@Injectable()
export class SessionService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /** For use inside an already-open tenant-scoped transaction (e.g. magic-link verify, which must consume the token and issue a session atomically). */
  async createSessionWithTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const refreshToken = this.tokenService.generateRefreshToken(tenantId);
    const refreshTokenHash = this.tokenService.hashOpaqueToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTtlMs(),
    );
    await tx.session.create({
      data: { tenantId, userId, refreshTokenHash, expiresAt },
    });
    return refreshToken;
  }

  async createSession(tenantId: string, userId: string): Promise<string> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      this.createSessionWithTx(tx, tenantId, userId),
    );
  }

  /**
   * Verifies and rotates a refresh token: the old session is revoked and a
   * new one issued in the same transaction. Reuse of an already-revoked
   * token is treated as a token-theft signal and revokes every active
   * session for that user, not just the one being reused.
   *
   * The transaction callback always returns normally (never throws) so
   * that a detected-reuse revocation actually commits — Prisma rolls back
   * the whole interactive transaction if the callback throws, which would
   * otherwise silently undo the revocation it just performed. Errors are
   * thrown only after `run()` resolves, outside the transaction.
   */
  async rotateSession(
    presentedToken: string,
  ): Promise<{ tenantId: string; userId: string; refreshToken: string }> {
    const tenantId =
      this.tokenService.parseTenantFromRefreshToken(presentedToken);
    if (!tenantId) {
      throw new UnauthorizedException("Malformed refresh token");
    }
    const hash = this.tokenService.hashOpaqueToken(presentedToken);

    type RotateOutcome =
      | { kind: "invalid" }
      | { kind: "reused" }
      | { kind: "expired" }
      | { kind: "ok"; userId: string; refreshToken: string };

    const outcome = await this.tenantPrisma.run(
      tenantId,
      async (tx): Promise<RotateOutcome> => {
        const session = await tx.session.findFirst({
          where: { refreshTokenHash: hash },
        });
        if (!session) {
          return { kind: "invalid" };
        }
        if (session.revokedAt) {
          await tx.session.updateMany({
            where: { userId: session.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          return { kind: "reused" };
        }
        if (session.expiresAt < new Date()) {
          return { kind: "expired" };
        }

        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        const refreshToken = await this.createSessionWithTx(
          tx,
          tenantId,
          session.userId,
        );
        return { kind: "ok", userId: session.userId, refreshToken };
      },
    );

    switch (outcome.kind) {
      case "invalid":
        throw new UnauthorizedException("Invalid refresh token");
      case "reused":
        throw new UnauthorizedException(
          "Refresh token has already been used; all sessions for this user have been revoked",
        );
      case "expired":
        throw new UnauthorizedException("Refresh token expired");
      case "ok":
        return {
          tenantId,
          userId: outcome.userId,
          refreshToken: outcome.refreshToken,
        };
    }
  }

  async revokeByRefreshToken(presentedToken: string): Promise<void> {
    const tenantId =
      this.tokenService.parseTenantFromRefreshToken(presentedToken);
    if (!tenantId) return;
    const hash = this.tokenService.hashOpaqueToken(presentedToken);
    await this.tenantPrisma.run(tenantId, (tx) =>
      tx.session.updateMany({
        where: { refreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }
}
