import type {
  AuthAttemptRecord,
  AuthStore,
  AuthUser,
  SessionRecord,
} from "../../../src/auth/types";
import type { RoleName } from "../../../src/auth/roles";

export type SeededUser = {
  id: number;
  username: string;
  passwordHash: string;
  isActive: boolean;
  roles: RoleName[];
};

export class InMemoryAuthStore implements AuthStore {
  public readonly users = new Map<string, SeededUser>();
  public readonly usersById = new Map<number, SeededUser>();
  public readonly attempts = new Map<
    string,
    Array<{ success: boolean; attemptedAt: Date }>
  >();
  public readonly sessions = new Map<string, SessionRecord>();

  public seedUser(user: SeededUser): void {
    this.users.set(user.username, user);
    this.usersById.set(user.id, user);
  }

  public reset(): void {
    this.users.clear();
    this.usersById.clear();
    this.attempts.clear();
    this.sessions.clear();
  }

  public async findUserByUsername(username: string): Promise<AuthUser | null> {
    const user = this.users.get(username);
    return user ? { ...user } : null;
  }

  public async findUserById(userId: number): Promise<AuthUser | null> {
    const user = this.usersById.get(userId);
    return user ? { ...user } : null;
  }

  public async listRecentAttempts(
    username: string,
    limit: number,
  ): Promise<AuthAttemptRecord[]> {
    const list = this.attempts.get(username) ?? [];
    return [...list]
      .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime())
      .slice(0, limit)
      .map((attempt) => ({
        success: attempt.success,
        attemptedAt: attempt.attemptedAt,
      }));
  }

  public async recordAuthAttempt(params: {
    username: string;
    success: boolean;
  }): Promise<void> {
    const list = this.attempts.get(params.username) ?? [];
    list.push({ success: params.success, attemptedAt: new Date() });
    this.attempts.set(params.username, list);
  }

  public async createSession(params: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const user = this.usersById.get(params.userId);
    if (!user) return;
    this.sessions.set(params.tokenHash, {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      expiresAt: params.expiresAt,
    });
  }

  public async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(tokenHash);
      return null;
    }
    return { ...session };
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  public async touchSession(_tokenHash: string): Promise<void> {
    // no-op for the in-memory store; the session record itself is immutable
  }
}

export const sharedInMemoryStore = new InMemoryAuthStore();
