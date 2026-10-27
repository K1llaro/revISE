import { test, expect, vi, beforeEach } from 'vitest';
import { handler } from '../api/handler.ts';

const mockExecute = vi.fn();

vi.mock('@libsql/client', () => ({
  createClient: vi.fn(() => ({
    execute: (...args) => mockExecute(...args),
  })),
}));

// Используем реальные class-конструкторы для AWS SDK
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = vi.fn(async () => ({
      SecretString: JSON.stringify({
        tursoUrl: 'libsql://mock-test.turso.io',
        tursoAuthToken: 'mock-token',
      }),
    }));
  },
  GetSecretValueCommand: class {},
}));

beforeEach(() => {
  process.env.TURSO_DATABASE_URL = 'libsql://mock-test.turso.io';
  process.env.TURSO_AUTH_TOKEN = 'mock-token';
  process.env.SUPABASE_URL = 'https://mock.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'mock-anon-key';

  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [{ alive: 1 }] });

  global.fetch = vi.fn(async (url) => {
    if (url.includes('/auth/v1/health')) {
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    }
    return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) };
  });
});

test('Health Probe: returns 200 OK and reports healthy subsystems', async () => {
  const event = {
    httpMethod: 'GET',
    path: '/api/health',
    headers: {},
  };

  const response = await handler(event);
  expect(response.statusCode).toBe(200);

  const body = JSON.parse(response.body);
  expect(body.status).toBe('healthy');
  expect(body.checks.database.status).toBe('healthy');
  expect(body.checks.secrets.status).toBe('healthy');
  expect(body.checks.auth.status).toBe('healthy');
});

test('Health Probe Resilience: returns 503 if database connection fails', async () => {
  mockExecute.mockRejectedValueOnce(new Error('Connection timeout to Turso'));

  const event = {
    httpMethod: 'GET',
    path: '/api/health',
    headers: {},
  };

  const response = await handler(event);
  expect(response.statusCode).toBe(503);

  const body = JSON.parse(response.body);
  expect(body.status).toBe('unhealthy');
  expect(body.checks.database.status).toBe('unhealthy');
  expect(body.checks.database.error).toContain('Connection timeout to Turso');
});

test('CORS Preflight: returns 204 No Content for OPTIONS request', async () => {
  const event = {
    httpMethod: 'OPTIONS',
    path: '/api/data',
    headers: {},
  };

  const response = await handler(event);
  expect(response.statusCode).toBe(204);
  expect(response.headers['access-control-allow-methods']).toContain('OPTIONS');
});

test('Security Gatekeeper: rejects unauthenticated requests with 401', async () => {
  const event = {
    httpMethod: 'POST',
    path: '/api/data',
    headers: {},
    body: JSON.stringify({ table: 'profiles', operation: 'select' }),
  };

  const response = await handler(event);
  expect(response.statusCode).toBe(401);

  const body = JSON.parse(response.body);
  expect(body.error).toContain('Supabase access token is required');
});

test('Input Validation: rejects malformed non-JSON body with 400', async () => {
  const event = {
    httpMethod: 'POST',
    path: '/api/data',
    headers: { authorization: 'Bearer valid-test-token' },
    body: 'this is not a json string',
  };

  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'usr-123', email: 'student@studentmail.ul.ie' }),
  });

  const response = await handler(event);
  expect(response.statusCode).toBe(400);

  const body = JSON.parse(response.body);
  expect(body.error).toContain('JSON request body is required');
});