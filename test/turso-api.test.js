import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../api/handler.ts';

const createEvent = (body, authorization = 'Bearer test-access-token') => ({
  httpMethod: 'POST',
  headers: authorization ? { authorization } : {},
  body: JSON.stringify(body),
});

const mockVerifiedUser = () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'student-123', email: 'student@studentmail.ul.ie' }),
  }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Turso API authentication and request validation', () => {
  it('rejects requests without a bearer token before contacting Supabase', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(createEvent({ table: 'profiles', operation: 'select' }, ''));

    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an expired or invalid Supabase access token', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const response = await handler(createEvent({ table: 'profiles', operation: 'select' }));

    expect(response.statusCode).toBe(401);
  });

  it('uses the public Supabase settings used by the local development environment', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://local-example.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(createEvent({ table: 'profiles', operation: 'select' }));

    expect(response.statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://local-example.supabase.co/auth/v1/user',
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'public-test-key' }) }),
    );
  });

  it('allows a user to update their own leaderboard consent', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    mockVerifiedUser();

    const response = await handler(createEvent({
      table: 'profiles',
      operation: 'update',
      values: { leaderboard_accepted: true },
      filters: [{ column: 'id', operator: 'eq', value: 'student-123' }],
    }));

    expect(response.statusCode).not.toBe(403);
    expect(JSON.parse(response.body).error).not.toBe('Updates are not permitted for these fields in profiles.');
  });

  it('rejects a table outside the server allowlist before connecting to Turso', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'student-123', email: 'student@studentmail.ul.ie' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(createEvent({ table: 'auth.users', operation: 'select' }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Unsupported table.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects filters on columns that are not in the table schema', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    mockVerifiedUser();

    const response = await handler(createEvent({
      table: 'learn_notes',
      operation: 'select',
      filters: [{ column: 'private_key', operator: 'eq', value: 'secret' }],
    }));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Unsupported filter column.');
  });

  it('does not expose private material submission fields to other users', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    mockVerifiedUser();

    const response = await handler(createEvent({
      table: 'curriculum_materials',
      operation: 'select',
      columns: '*',
      filters: [{ column: 'status', operator: 'eq', value: 'approved' }],
    }));

    expect(response.statusCode).toBe(403);
  });

  it('rejects upserts to user-owned tables before connecting to Turso', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'public-test-key');
    mockVerifiedUser();

    const response = await handler(createEvent({
      table: 'learn_notes',
      operation: 'upsert',
      values: { id: 'another-users-note', section_id: 'another-users-section', title: 'Injected note' },
    }));

    expect(response.statusCode).toBe(403);
  });
});
