import { env } from "../config/env";
import { generateSessionToken, hashToken } from "./sessionToken";
import { verifyPassword } from "./passwordHash";
import type { AuthStore, AuthUser, SessionRecord } from "./types";
import { logger } from "../utils/logger";

const lockoutWindowMs = env.lockoutMinutes * 60 * 1000;

type LoginResult =
  | {
      ok: true;
      user: Pick<AuthUser, "id" | "username" | "roles">;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      code: "INVALID_CREDENTIALS" | "LOCKED" | "INACTIVE";
      message: string;
      lockedUntil?: Date;
    };

export class AuthService {
  public constructor(private readonly store: AuthStore) {}

  public async login(params: {
    username: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const username = params.username.trim();
    const lockout = await this.getLockoutInfo(username);
    if (lockout.isLocked) {
      logger.warn("auth.login.locked", "Rejected login due to active lockout", {
        ipAddress: params.ipAddress ?? null,
        lockedUntil: lockout.lockedUntil?.toISOString() ?? null,
      });
      return {
        ok: false,
        code: "LOCKED",
        message:
          "Account is temporarily locked due to repeated failed login attempts.",
        lockedUntil: lockout.lockedUntil,
      };
    }

    const user = await this.store.findUserByUsername(username);

    if (!user) {
      await this.store.recordAuthAttempt({
        username,
        success: false,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      logger.warn(
        "auth.login.invalid_credentials",
        "Rejected login for unknown user",
        {
          ipAddress: params.ipAddress ?? null,
        },
      );
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
      };
    }

    if (!user.isActive) {
      logger.warn("auth.login.inactive", "Rejected login for inactive user", {
        userId: user.id,
        ipAddress: params.ipAddress ?? null,
      });
      return {
        ok: false,
        code: "INACTIVE",
        message: "Account is inactive.",
      };
    }

    const passwordValid = await verifyPassword(
      user.passwordHash,
      params.password,
    );

    if (!passwordValid) {
      await this.store.recordAuthAttempt({
        username,
        success: false,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      logger.warn(
        "auth.login.invalid_credentials",
        "Rejected login due to invalid password",
        {
          userId: user.id,
          ipAddress: params.ipAddress ?? null,
        },
      );

      const newLockout = await this.getLockoutInfo(username);
      if (newLockout.isLocked) {
        logger.warn(
          "auth.login.locked",
          "Account locked after repeated failed attempts",
          {
            userId: user.id,
            ipAddress: params.ipAddress ?? null,
            lockedUntil: newLockout.lockedUntil?.toISOString() ?? null,
          },
        );
        return {
          ok: false,
          code: "LOCKED",
          message:
            "Account is temporarily locked due to repeated failed login attempts.",
          lockedUntil: newLockout.lockedUntil,
        };
      }

      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
      };
    }

    await this.store.recordAuthAttempt({
      username,
      success: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const token = generateSessionToken();
    const tokenHash = hashToken(token, env.sessionSecret);
    const expiresAt = new Date(
      Date.now() + env.sessionTtlHours * 60 * 60 * 1000,
    );

    await this.store.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    logger.info("auth.login.success", "User authenticated", {
      userId: user.id,
      roleCount: user.roles.length,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles,
      },
      token,
      expiresAt,
    };
  }

  public async getCurrentSession(
    token: string | undefined,
  ): Promise<SessionRecord | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashToken(token, env.sessionSecret);
    const session = await this.store.findSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    await this.store.touchSession(tokenHash);
    return session;
  }

  public async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    const tokenHash = hashToken(token, env.sessionSecret);
    await this.store.revokeSession(tokenHash);
  }

  public async getLockoutInfo(username: string): Promise<{
    isLocked: boolean;
    lockedUntil?: Date;
  }> {
    const attempts = await this.store.listRecentAttempts(
      username,
      env.lockoutMaxAttempts,
    );
    if (attempts.length < env.lockoutMaxAttempts) {
      return { isLocked: false };
    }

    const recent = attempts.slice(0, env.lockoutMaxAttempts);
    const allFailed = recent.every((attempt) => !attempt.success);
    if (!allFailed) {
      return { isLocked: false };
    }

    const mostRecentAttempt = recent[0];
    const lockedUntil = new Date(
      mostRecentAttempt.attemptedAt.getTime() + lockoutWindowMs,
    );

    if (lockedUntil.getTime() <= Date.now()) {
      return { isLocked: false };
    }

    return { isLocked: true, lockedUntil };
  }
}
