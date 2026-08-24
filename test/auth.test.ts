import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashPassword,
  passwordMatches,
  passwordMatchesOrDummy,
} from '../src/auth/password';
import {
  clearSession,
  createSession,
  getActiveSession,
  requireRole,
  requireSession,
} from '../src/auth/session';

describe('password hashing', () => {
  it('hashes with bcrypt and verifies the original password', async () => {
    const hash = await hashPassword('Admin123!');
    assert.notEqual(hash, 'Admin123!');
    assert.match(hash, /^\$2[aby]\$/);
    assert.equal(await passwordMatches('Admin123!', hash), true);
    assert.equal(await passwordMatches('wrong', hash), false);
  });

  it('still runs a bcrypt compare when the user is missing', async () => {
    assert.equal(await passwordMatchesOrDummy('guess', undefined), false);
  });
});

describe('sessions and roles', () => {
  it('creates a public session without a password field', () => {
    clearSession();
    const session = createSession('user-1', 'admin', 'administrator');
    assert.equal(session.username, 'admin');
    assert.equal(session.role, 'administrator');
    assert.equal('password' in session, false);
    assert.equal(getActiveSession()?.username, 'admin');
    clearSession();
    assert.equal(getActiveSession(), null);
  });

  it('rejects missing sessions and the wrong role', () => {
    clearSession();
    assert.throws(() => requireSession(), /Unauthorized/);
    createSession('user-1', 'support', 'it_support');
    assert.throws(() => requireRole('administrator'), /Forbidden/);
    assert.equal(requireRole('it_support').username, 'support');
    clearSession();
  });
});
