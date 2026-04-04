import { AuthService } from '../../src/auth/authService';
import { hashPassword } from '../../src/auth/passwordHash';
import { InMemoryAuthStore } from '../helpers/inMemoryAuthStore';

describe('AuthService login and lockout', () => {
  it('logs in with valid credentials', async () => {
    const store = new InMemoryAuthStore();
    const passwordHash = await hashPassword('Member#Pass123');
    store.addUser({
      id: 1,
      username: 'member1',
      passwordHash,
      isActive: true,
      roles: ['MEMBER']
    });

    const service = new AuthService(store);
    const result = await service.login({
      username: 'member1',
      password: 'Member#Pass123'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected successful login');
    }
    expect(result.user.username).toBe('member1');
    expect(result.user.roles).toContain('MEMBER');
    expect(result.token.length).toBeGreaterThan(20);
  });

  it('fails with invalid credentials', async () => {
    const store = new InMemoryAuthStore();
    const passwordHash = await hashPassword('Member#Pass123');
    store.addUser({
      id: 1,
      username: 'member1',
      passwordHash,
      isActive: true,
      roles: ['MEMBER']
    });

    const service = new AuthService(store);
    const result = await service.login({
      username: 'member1',
      password: 'Wrong#Pass123'
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failed login');
    }
    expect(result.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks account for 15 minutes after five failed attempts', async () => {
    const store = new InMemoryAuthStore();
    const passwordHash = await hashPassword('Member#Pass123');
    store.addUser({
      id: 1,
      username: 'member1',
      passwordHash,
      isActive: true,
      roles: ['MEMBER']
    });

    const service = new AuthService(store);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await service.login({
        username: 'member1',
        password: 'Wrong#Pass123'
      });

      if (i < 4) {
        expect(attempt.ok).toBe(false);
        if (!attempt.ok) {
          expect(attempt.code).toBe('INVALID_CREDENTIALS');
        }
      } else {
        expect(attempt.ok).toBe(false);
        if (!attempt.ok) {
          expect(attempt.code).toBe('LOCKED');
          expect(attempt.lockedUntil).toBeDefined();
        }
      }
    }

    const blockedLogin = await service.login({
      username: 'member1',
      password: 'Member#Pass123'
    });

    expect(blockedLogin.ok).toBe(false);
    if (!blockedLogin.ok) {
      expect(blockedLogin.code).toBe('LOCKED');
    }
  });

  it('does not re-lock after one post-expiry failed attempt', async () => {
    const store = new InMemoryAuthStore();
    const passwordHash = await hashPassword('Member#Pass123');
    store.addUser({
      id: 1,
      username: 'member1',
      passwordHash,
      isActive: true,
      roles: ['MEMBER']
    });

    // Seed 5 failed attempts that are older than the lockout window (>15 minutes ago)
    const oldTime = new Date(Date.now() - 20 * 60 * 1000);
    store.seedAttempts('member1', [
      { success: false, attemptedAt: new Date(oldTime.getTime() + 4000) },
      { success: false, attemptedAt: new Date(oldTime.getTime() + 3000) },
      { success: false, attemptedAt: new Date(oldTime.getTime() + 2000) },
      { success: false, attemptedAt: new Date(oldTime.getTime() + 1000) },
      { success: false, attemptedAt: oldTime },
    ]);

    const service = new AuthService(store);

    // Lockout should have expired since all attempts are >15 min old
    const lockoutInfo = await service.getLockoutInfo('member1');
    expect(lockoutInfo.isLocked).toBe(false);

    // One new failed attempt should NOT trigger re-lock
    const result = await service.login({
      username: 'member1',
      password: 'Wrong#Pass123'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_CREDENTIALS');
    }

    // Verify still not locked after single post-expiry failure
    const lockoutAfter = await service.getLockoutInfo('member1');
    expect(lockoutAfter.isLocked).toBe(false);
  });
});