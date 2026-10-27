import { createClient, type Client, type InValue } from '@libsql/client';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';

type TableName =
  | 'profiles'
  | 'curriculum_materials'
  | 'test_history'
  | 'learn_categories'
  | 'learn_sections'
  | 'learn_notes'
  | 'learn_clarifications';

type Filter = { column: string; operator: string; value?: unknown };
type RequestBody = {
  table?: TableName;
  operation?: 'select' | 'insert' | 'upsert' | 'update' | 'delete' | 'rpc';
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  columns?: string;
  filters?: Filter[];
  orders?: Array<{ column: string; ascending: boolean }>;
  offset?: number;
  limit?: number;
  single?: boolean;
  rpc?: string;
};

type Identity = { id: string; email: string; isAdmin: boolean };
type SecretPayload = { tursoUrl: string; tursoAuthToken: string; supabaseServiceRoleKey?: string };
type ColumnDefinition = { type: 'text' | 'number' | 'boolean' | 'json'; nullable?: boolean };

const secretsClient = new SecretsManagerClient({});
let cachedSecret: SecretPayload | null = null;
let cachedDb: Client | null = null;

const definitions: Record<TableName, Record<string, ColumnDefinition>> = {
  profiles: {
    id: { type: 'text' }, email: { type: 'text' }, nickname: { type: 'text' },
    real_name: { type: 'text', nullable: true }, study_year: { type: 'text' },
    hide_from_leaderboard: { type: 'boolean' }, leaderboard_accepted: { type: 'boolean' },
    disable_vortex: { type: 'boolean' },
    gemini_api_key: { type: 'text', nullable: true }, updated_at: { type: 'text', nullable: true },
    created_at: { type: 'text' },
  },
  curriculum_materials: {
    id: { type: 'text' }, submitted_by: { type: 'text' }, submitter_email: { type: 'text', nullable: true },
    title: { type: 'text' }, tag_name: { type: 'text' }, content_text: { type: 'text' },
    status: { type: 'text' }, ai_verdict_reason: { type: 'text', nullable: true }, created_at: { type: 'text' },
  },
  test_history: {
    id: { type: 'text' }, user_id: { type: 'text' }, title: { type: 'text' }, type: { type: 'text' },
    score: { type: 'number' }, max_score: { type: 'number' }, points_earned: { type: 'number' },
    time_spent: { type: 'text' }, ai_feedback: { type: 'text' }, created_at: { type: 'text' },
  },
  learn_categories: {
    id: { type: 'text' }, user_id: { type: 'text' }, name: { type: 'text' }, created_at: { type: 'text' },
  },
  learn_sections: {
    id: { type: 'text' }, user_id: { type: 'text' }, category_id: { type: 'text' },
    name: { type: 'text' }, created_at: { type: 'text' },
  },
  learn_notes: {
    id: { type: 'text' }, user_id: { type: 'text' }, section_id: { type: 'text' },
    title: { type: 'text' }, content_text: { type: 'text', nullable: true },
    curriculum_material_id: { type: 'text', nullable: true }, source_name: { type: 'text', nullable: true },
    terms: { type: 'json' }, created_at: { type: 'text' },
  },
  learn_clarifications: {
    id: { type: 'text' }, user_id: { type: 'text' }, section_id: { type: 'text' },
    selected_text: { type: 'text' }, question: { type: 'text' }, answer: { type: 'text' }, created_at: { type: 'text' },
  },
};

const allowedOperators = new Set(['eq', 'neq', 'gte', 'gt', 'lte', 'lt', 'in', 'is', 'not_is']);
const privateTables = new Set<TableName>([
  'learn_categories', 'learn_sections', 'learn_notes', 'learn_clarifications',
]);
const mutableColumns: Partial<Record<TableName, Set<string>>> = {
  profiles: new Set(['nickname', 'real_name', 'hide_from_leaderboard', 'leaderboard_accepted', 'study_year', 'gemini_api_key', 'updated_at']),
  curriculum_materials: new Set(['title', 'content_text', 'status']),
  learn_categories: new Set(['name']),
  learn_sections: new Set(['name']),
  learn_notes: new Set(['title', 'content_text', 'terms']),
};
const publicLeaderboardColumns: Record<TableName, Set<string>> = {
  profiles: new Set(['id', 'nickname', 'real_name', 'study_year', 'hide_from_leaderboard', 'leaderboard_accepted']),
  test_history: new Set(['user_id', 'score', 'max_score', 'points_earned', 'created_at']),
  curriculum_materials: new Set(),
  learn_categories: new Set(),
  learn_sections: new Set(),
  learn_notes: new Set(),
  learn_clarifications: new Set(),
};
const publicMaterialColumns = new Set(['id', 'title', 'tag_name', 'content_text', 'created_at']);

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getSecret = async (): Promise<SecretPayload> => {
  if (cachedSecret) return cachedSecret;
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl || !tursoAuthToken) {
      throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the local .env file.');
    }
    cachedSecret = {
      tursoUrl,
      tursoAuthToken,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return cachedSecret;
  }
  const secretId = process.env.TURSO_SECRET_ARN;
  if (!secretId) throw new Error('The TURSO_SECRET_ARN Lambda setting is missing.');
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) throw new Error('The configured Turso secret is empty.');
  const parsed: unknown = JSON.parse(response.SecretString);
  if (
    !parsed || typeof parsed !== 'object'
    || typeof (parsed as Record<string, unknown>).tursoUrl !== 'string'
    || typeof (parsed as Record<string, unknown>).tursoAuthToken !== 'string'
  ) {
    throw new Error('The Turso secret must contain tursoUrl and tursoAuthToken strings.');
  }
  cachedSecret = parsed as SecretPayload;
  return cachedSecret;
};

const getDatabase = async (): Promise<Client> => {
  if (cachedDb) return cachedDb;
  const secret = await getSecret();
  cachedDb = createClient({ url: secret.tursoUrl, authToken: secret.tursoAuthToken });
  return cachedDb;
};

const getSupabaseConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY,
});

/* ==========================================================================
   DEEP HEALTH CHECK IMPLEMENTATION
   ========================================================================== */
export const checkHealth = async (): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> = {};

  // 1. Проверка Secrets / Конфигурации
  try {
    const secret = await getSecret();
    checks.secrets = {
      status: secret.tursoUrl && secret.tursoAuthToken ? 'healthy' : 'unhealthy',
    };
  } catch (error) {
    checks.secrets = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Secrets retrieval failed',
    };
  }

  // 2. Глубокий пинг базы данных Turso (SELECT 1)
  const dbStart = Date.now();
  try {
    const db = await getDatabase();
    const result = await db.execute('SELECT 1 AS alive');
    const dbLatency = Date.now() - dbStart;
    checks.database = {
      status: result.rows.length > 0 ? 'healthy' : 'unhealthy',
      latencyMs: dbLatency,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Turso database unreachable',
    };
  }

  // 3. Проверка доступности Supabase Auth
  const authStart = Date.now();
  try {
    const { url: supabaseUrl, anonKey } = getSupabaseConfig();
    if (!supabaseUrl || !anonKey) {
      checks.auth = { status: 'unhealthy', error: 'Supabase configuration missing' };
    } else {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
        headers: { apikey: anonKey },
      });
      const authLatency = Date.now() - authStart;
      checks.auth = {
        // Если эндпоинт вернул 200 или любой статус авторизации, сервис живой
        status: response.status < 500 ? 'healthy' : 'unhealthy',
        latencyMs: authLatency,
      };
    }
  } catch (error) {
    checks.auth = {
      status: 'unhealthy',
      latencyMs: Date.now() - authStart,
      error: error instanceof Error ? error.message : 'Supabase Auth unreachable',
    };
  }

  // Вычисляем финальный статус
  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const totalDurationMs = Date.now() - startTime;

  return jsonResponse(isHealthy ? 200 : 503, {
    status: isHealthy ? 'healthy' : 'unhealthy',
    environment: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'aws-lambda' : 'local',
    timestamp: new Date().toISOString(),
    totalDurationMs,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
  });
};

const authenticate = async (event: APIGatewayProxyEvent): Promise<Identity> => {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'A valid Supabase access token is required.');

  const { url: supabaseUrl, anonKey } = getSupabaseConfig();
  if (!supabaseUrl || !anonKey) throw new Error('Supabase Auth verification is not configured.');

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
    });
  } catch {
    throw new HttpError(503, 'Could not verify your sign-in right now. Please retry.');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(401, 'The Supabase access token is invalid or expired.');
    }
    throw new HttpError(503, 'Could not verify your sign-in right now. Please retry.');
  }
  const user: unknown = await response.json();
  if (!user || typeof user !== 'object' || typeof (user as Record<string, unknown>).id !== 'string') {
    throw new HttpError(401, 'The Supabase Auth response did not contain a valid user.');
  }
  const typedUser = user as { id: string; email?: string; email_confirmed_at?: string | null };
  const email = (typedUser.email || '').trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return {
    id: typedUser.id,
    email,
    isAdmin: Boolean(adminEmail && email === adminEmail && typedUser.email_confirmed_at),
  };
};

const assertTable = (value: unknown): TableName => {
  if (typeof value !== 'string' || !Object.hasOwn(definitions, value)) {
    throw new HttpError(400, 'Unsupported table.');
  }
  return value as TableName;
};

const parseColumns = (table: TableName, requested: string | undefined): string[] => {
  const available = definitions[table];
  if (requested !== undefined && (typeof requested !== 'string' || requested.length > 1000)) {
    throw new HttpError(400, 'Invalid column projection.');
  }
  const rawColumns = !requested || requested.trim() === '*'
    ? Object.keys(available)
    : requested.split(',').map((column) => column.trim());
  const relationColumns = rawColumns.filter((column) => column === 'linked_material:curriculum_materials(content_text)');
  if (relationColumns.length && table !== 'learn_notes') throw new HttpError(400, 'Unsupported relation projection.');
  if (rawColumns.some((column) => column.includes(':') && column !== 'linked_material:curriculum_materials(content_text)')) {
    throw new HttpError(400, 'Unsupported relation projection.');
  }
  const requestedColumns = rawColumns
    .filter((column) => column !== 'linked_material:curriculum_materials(content_text)')
    .map((column) => column.replace(/^.*:/, '').split('(')[0]);
  const columns = requestedColumns.filter((column) => Object.hasOwn(available, column));
  if (columns.length !== requestedColumns.length) throw new HttpError(400, 'The request contains an unsupported column.');
  if (table === 'profiles' && !columns.includes('id')) columns.unshift('id');
  return Array.from(new Set(columns));
};

const validateValue = (table: TableName, column: string, value: unknown): InValue => {
  const definition = definitions[table][column];
  if (!definition) throw new HttpError(400, `Unsupported ${table} column: ${column}.`);
  if (value === null) {
    if (!definition.nullable) throw new HttpError(400, `${column} cannot be null.`);
    return null;
  }
  if (definition.type === 'json') return JSON.stringify(value);
  if (definition.type === 'boolean') return value === true || value === 1 ? 1 : value === false || value === 0 ? 0 : (() => { throw new HttpError(400, `${column} must be a boolean.`); })();
  if (definition.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, `${column} must be a finite number.`);
    return value;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${column} must be a string.`);
  if (table === 'profiles' && column === 'nickname' && (value.trim().length < 1 || value.trim().length > 30)) {
    throw new HttpError(400, 'Nickname must be between 1 and 30 characters.');
  }
  if (table === 'profiles' && column === 'real_name' && value.trim().length > 50) {
    throw new HttpError(400, 'Real name cannot exceed 50 characters.');
  }
  if (column === 'title' && value.length > 150) {
    throw new HttpError(400, 'Title cannot exceed 150 characters.');
  }
  if (column === 'study_year' && !['year1', 'year2', 'year3', 'year4'].includes(value)) {
    throw new HttpError(400, 'study_year must be one of year1, year2, year3, or year4.');
  }
  if (column === 'status' && !['approved', 'flagged', 'rejected'].includes(value)) {
    throw new HttpError(400, 'Material status must be approved, flagged, or rejected.');
  }
  return value;
};

const toAppRow = (table: TableName, row: Record<string, unknown>): Record<string, unknown> => {
  const converted = { ...row };
  if (table === 'learn_notes' && typeof converted.terms === 'string') {
    converted.terms = JSON.parse(converted.terms);
  }
  if (table === 'profiles') {
    converted.hide_from_leaderboard = Boolean(converted.hide_from_leaderboard);
    converted.leaderboard_accepted = Boolean(converted.leaderboard_accepted);
  }
  return converted;
};

const getFilters = (filters: Filter[] | undefined, table: TableName): Filter[] => {
  if (filters === undefined) return [];
  if (!Array.isArray(filters) || filters.length > 50) throw new HttpError(400, 'Invalid filters.');
  return filters.map((filter) => {
    if (!filter || typeof filter.column !== 'string' || !definitions[table][filter.column]) {
      throw new HttpError(400, 'Unsupported filter column.');
    }
    if (!allowedOperators.has(filter.operator)) throw new HttpError(400, 'Unsupported filter operator.');
    return filter;
  });
};

const makeWhere = (
  table: TableName,
  filters: Filter[],
  args: InValue[],
  identity: Identity,
  operation: string,
): string[] => {
  const clauses: string[] = [];
  for (const filter of filters) {
    const column = `"${filter.column}"`;
    if (filter.operator === 'in') {
      if (!Array.isArray(filter.value) || filter.value.length > 100) throw new HttpError(400, 'Invalid IN filter.');
      if (filter.value.length === 0) {
        clauses.push('1 = 0');
      } else {
        clauses.push(`${column} IN (${filter.value.map((value) => {
          args.push(validateValue(table, filter.column, value));
          return '?';
        }).join(', ')})`);
      }
      continue;
    }
    if (filter.operator === 'is' || filter.operator === 'not_is') {
      if (filter.value !== null) throw new HttpError(400, 'Only NULL checks are supported by this filter.');
      clauses.push(`${column} IS ${filter.operator === 'not_is' ? 'NOT ' : ''}NULL`);
      continue;
    }
    const operators: Record<string, string> = { eq: '=', neq: '!=', gte: '>=', gt: '>', lte: '<=', lt: '<' };
    clauses.push(`${column} ${operators[filter.operator]} ?`);
    args.push(validateValue(table, filter.column, filter.value));
  }

  if (table === 'profiles') {
    const ownProfile = filters.some((filter) => filter.column === 'id' && filter.operator === 'eq' && filter.value === identity.id);
    if (ownProfile) {
      clauses.push('"id" = ?');
      args.push(identity.id);
    } else {
      if (operation !== 'select' || filters.some((filter) => filter.column !== 'hide_from_leaderboard')) {
        throw new HttpError(403, 'Profiles can only be read by their owner, except for the public leaderboard fields.');
      }
      clauses.push('"hide_from_leaderboard" = 0');
      if (filters.some((filter) => filter.column === 'id')) throw new HttpError(403, 'Profile lookup is not permitted.');
    }
  } else if (table === 'test_history') {
    const ownHistory = filters.some((filter) => filter.column === 'user_id' && filter.operator === 'eq' && filter.value === identity.id);
    if (ownHistory) {
      clauses.push('"user_id" = ?');
      args.push(identity.id);
    } else if (operation === 'select') {
      clauses.push('1 = 1');
    } else {
      throw new HttpError(403, 'You may only modify your own test history.');
    }
  } else if (table === 'curriculum_materials') {
    if (!identity.isAdmin && operation === 'select') {
      clauses.push('("status" = \'approved\' OR "submitted_by" = ?)');
      args.push(identity.id);
    } else if (!identity.isAdmin) {
      clauses.push('"submitted_by" = ?');
      args.push(identity.id);
    }
  } else if (privateTables.has(table)) {
    clauses.push('"user_id" = ?');
    args.push(identity.id);
  }

  return clauses;
};

const enforceReadProjection = (table: TableName, columns: string[], filters: Filter[], identity: Identity): void => {
  if (table === 'profiles') {
    const ownProfile = filters.some((filter) => filter.column === 'id' && filter.operator === 'eq' && filter.value === identity.id);
    if (!ownProfile && columns.some((column) => !publicLeaderboardColumns.profiles.has(column))) {
      throw new HttpError(403, 'Private profile fields cannot be read through the leaderboard.');
    }
  }
  if (table === 'test_history') {
    const ownHistory = filters.some((filter) => filter.column === 'user_id' && filter.operator === 'eq' && filter.value === identity.id);
    if (!ownHistory && columns.some((column) => !publicLeaderboardColumns.test_history.has(column))) {
      throw new HttpError(403, 'Detailed test history is private.');
    }
  }
  if (table === 'curriculum_materials') {
    const ownMaterials = filters.some((filter) =>
      filter.column === 'submitted_by' && filter.operator === 'eq' && filter.value === identity.id);
    if (!identity.isAdmin && !ownMaterials && columns.some((column) => !publicMaterialColumns.has(column))) {
      throw new HttpError(403, 'Private material submission fields are unavailable to other users.');
    }
  }
};

const runQuery = async (body: RequestBody, identity: Identity): Promise<unknown> => {
  if (body.operation === 'rpc') {
    if (body.rpc !== 'delete_user_account') throw new HttpError(400, 'Unsupported database action.');
    return deleteAccount(identity);
  }

  const table = assertTable(body.table);
  const operation = body.operation || 'select';
  if (!['select', 'insert', 'upsert', 'update', 'delete'].includes(operation)) {
    throw new HttpError(400, 'Unsupported database operation.');
  }
  if (operation === 'upsert' && table !== 'profiles') {
    throw new HttpError(403, 'Upsert is only permitted for the authenticated profile.');
  }
  const filters = getFilters(body.filters, table);
  const columns = parseColumns(table, body.columns);
  if (body.orders !== undefined && (!Array.isArray(body.orders) || body.orders.length > 5)) {
    throw new HttpError(400, 'Invalid order clauses.');
  }
  if (body.single !== undefined && typeof body.single !== 'boolean') throw new HttpError(400, 'Invalid single-row option.');
  if (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1)) throw new HttpError(400, 'Invalid row limit.');
  if (body.offset !== undefined && (!Number.isInteger(body.offset) || body.offset < 0)) throw new HttpError(400, 'Invalid row offset.');
  const requestedRows = body.values === undefined ? [] : Array.isArray(body.values) ? body.values : [body.values];
  if (requestedRows.length > 100) throw new HttpError(413, 'A single request cannot write more than 100 rows.');
  if (requestedRows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new HttpError(400, 'Write values must be JSON objects.');
  }
  if (operation === 'select') {
    enforceReadProjection(table, columns, filters, identity);
    const database = await getDatabase();
    const args: InValue[] = [];
    const where = makeWhere(table, filters, args, identity, operation);
    const orders = body.orders || [];
    const orderSql = orders.map((order) => {
      if (!order || typeof order.column !== 'string' || typeof order.ascending !== 'boolean'
        || !definitions[table][order.column]) {
        throw new HttpError(400, 'Unsupported order clause.');
      }
      return `"${order.column}" ${order.ascending ? 'ASC' : 'DESC'}`;
    }).join(', ');
    const offset = Math.max(0, Math.min(Math.trunc(body.offset || 0), 100000));
    const limit = Math.max(1, Math.min(Math.trunc(body.limit || 1000), 1000));
    const result = await database.execute({
      sql: `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM "${table}" WHERE ${where.join(' AND ')}${orderSql ? ` ORDER BY ${orderSql}` : ''} LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });
    let rows = result.rows.map((row) => toAppRow(table, row as Record<string, unknown>));
    if (table === 'learn_notes' && body.columns?.includes('linked_material:curriculum_materials(content_text)')) {
      rows = await Promise.all(rows.map(async (row) => {
        if (typeof row.curriculum_material_id !== 'string') return { ...row, linked_material: [] };
        const material = await database.execute({
          sql: 'SELECT content_text FROM curriculum_materials WHERE id = ? AND (status = ? OR submitted_by = ?)',
          args: [row.curriculum_material_id, 'approved', identity.id],
        });
        return { ...row, linked_material: material.rows[0] ? [{ content_text: material.rows[0].content_text }] : [] };
      }));
    }
    if (body.single) {
      if (rows.length !== 1) throw new HttpError(406, `Expected one row, received ${rows.length}.`);
      return rows[0];
    }
    return rows;
  }

  const database = await getDatabase();
  for (const row of requestedRows) {
    for (const key of Object.keys(row)) {
      if (!definitions[table][key]) throw new HttpError(400, `Unsupported ${table} column: ${key}.`);
    }
  }

  if (operation === 'insert' || operation === 'upsert') {
    const insertedIds: string[] = [];
    for (const supplied of requestedRows) {
      const row = { ...supplied };
      if (table === 'profiles') {
        if (row.id !== undefined && row.id !== identity.id) throw new HttpError(403, 'A profile can only be created for the authenticated user.');
        row.id = identity.id;
        row.email = identity.email;
      } else if (table === 'test_history' || privateTables.has(table)) {
        if (row.user_id !== undefined && row.user_id !== identity.id) throw new HttpError(403, 'Data can only be created for the authenticated user.');
        row.user_id = identity.id;
        if (table === 'test_history') row.created_at = new Date().toISOString();
      } else if (table === 'curriculum_materials') {
        row.submitted_by = identity.id;
        row.submitter_email = identity.email;
        if (!['approved', 'flagged', 'rejected'].includes(String(row.status))) throw new HttpError(400, 'Invalid material status.');
      }
      if (table === 'learn_sections' && typeof row.category_id === 'string') {
        const category = await database.execute({
          sql: 'SELECT id FROM learn_categories WHERE id = ? AND user_id = ?',
          args: [row.category_id, identity.id],
        });
        if (category.rows.length === 0) throw new HttpError(403, 'The category does not belong to this account.');
      }
      if (table === 'learn_notes' && typeof row.curriculum_material_id === 'string') {
        const material = await database.execute({
          sql: 'SELECT id FROM curriculum_materials WHERE id = ? AND (status = ? OR submitted_by = ?)',
          args: [row.curriculum_material_id, 'approved', identity.id],
        });
        if (material.rows.length === 0) throw new HttpError(403, 'The linked study material is not available to this account.');
      }
      if ((table === 'learn_notes' || table === 'learn_clarifications') && typeof row.section_id === 'string') {
        const section = await database.execute({
          sql: 'SELECT id FROM learn_sections WHERE id = ? AND user_id = ?',
          args: [row.section_id, identity.id],
        });
        if (section.rows.length === 0) throw new HttpError(403, 'The section does not belong to this account.');
      }
      const id = typeof row.id === 'string' ? row.id : randomUUID();
      row.id = id;
      const keys = Object.keys(row);
      const args = keys.map((key) => validateValue(table, key, row[key]));
      const updates = keys.filter((key) => key !== 'id');
      const conflict = operation === 'upsert' && updates.length
        ? `ON CONFLICT(id) DO UPDATE SET ${updates.map((key) => `"${key}" = excluded."${key}"`).join(', ')}`
        : operation === 'upsert' ? 'ON CONFLICT(id) DO NOTHING' : '';
      await database.execute({
        sql: `INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ${conflict}`,
        args,
      });
      insertedIds.push(id);
    }
    if (!body.columns) return null;
    return readWrittenRows(database, table, insertedIds, columns, body.single, identity);
  }

  if (operation === 'update' || operation === 'delete') {
    if (operation === 'update' && requestedRows.length !== 1) throw new HttpError(400, 'Updates require one values object.');
    const values = requestedRows[0] || {};
    if (operation === 'update') {
      const allowedUpdates = mutableColumns[table];
      if (!allowedUpdates || Object.keys(values).some((column) => !allowedUpdates.has(column))) {
        throw new HttpError(403, `Updates are not permitted for these fields in ${table}.`);
      }
      if (table === 'profiles') {
        const ownsProfile = filters.some((filter) => filter.column === 'id' && filter.operator === 'eq' && filter.value === identity.id);
        if (!ownsProfile) {
          throw new HttpError(403, 'These profile fields cannot be changed through profile settings.');
        }
      }
      if (table === 'curriculum_materials') {
        if (!identity.isAdmin && Object.keys(values).some((column) => !['title', 'content_text'].includes(column))) {
          throw new HttpError(403, 'Only an administrator can moderate curriculum materials.');
        }
        if (Object.keys(values).length === 0) throw new HttpError(400, 'An update must include at least one field.');
        if (identity.isAdmin && Object.keys(values).some((column) => !['status'].includes(column))) {
          throw new HttpError(403, 'Administrators may only update material moderation status.');
        }
        if (identity.isAdmin && !['approved'].includes(String(values.status))) {
          throw new HttpError(400, 'The moderation action must approve the material.');
        }
      }
      const setArgs = Object.keys(values).map((key) => validateValue(table, key, values[key]));
      if (table === 'learn_notes' && values.terms !== undefined) {
        setArgs[Object.keys(values).indexOf('terms')] = JSON.stringify(values.terms);
      }
      const whereArgs: InValue[] = [];
      const where = makeWhere(table, filters, whereArgs, identity, operation);
      if (where.length === 0) throw new HttpError(400, 'Updates require restrictive filters.');
      const result = await database.execute({
        sql: `UPDATE "${table}" SET ${Object.keys(values).map((key) => `"${key}" = ?`).join(', ')} WHERE ${where.join(' AND ')}`,
        args: [...setArgs, ...whereArgs],
      });
      if (!body.columns) return null;
      return readWrittenRows(database, table, filters, columns, body.single, identity, result.rowsAffected);
    }

    const whereArgs: InValue[] = [];
    const where = makeWhere(table, filters, whereArgs, identity, operation);
    if (where.length === 0) throw new HttpError(400, 'Deletes require restrictive filters.');
    if (table === 'learn_sections' || table === 'learn_categories') {
      const idFilter = filters.find((filter) => filter.column === 'id' && filter.operator === 'eq');
      if (typeof idFilter?.value !== 'string') {
        throw new HttpError(400, 'Learn sections and categories must be deleted by ID.');
      }
      if (table === 'learn_sections') {
        await database.batch([
          { sql: 'DELETE FROM learn_clarifications WHERE user_id = ? AND section_id = ?', args: [identity.id, idFilter.value] },
          { sql: 'DELETE FROM learn_notes WHERE user_id = ? AND section_id = ?', args: [identity.id, idFilter.value] },
          { sql: 'DELETE FROM learn_sections WHERE id = ? AND user_id = ?', args: [idFilter.value, identity.id] },
        ], 'write');
      } else {
        await database.batch([
          { sql: 'DELETE FROM learn_clarifications WHERE user_id = ? AND section_id IN (SELECT id FROM learn_sections WHERE category_id = ? AND user_id = ?)', args: [identity.id, idFilter.value, identity.id] },
          { sql: 'DELETE FROM learn_notes WHERE user_id = ? AND section_id IN (SELECT id FROM learn_sections WHERE category_id = ? AND user_id = ?)', args: [identity.id, idFilter.value, identity.id] },
          { sql: 'DELETE FROM learn_sections WHERE category_id = ? AND user_id = ?', args: [idFilter.value, identity.id] },
          { sql: 'DELETE FROM learn_categories WHERE id = ? AND user_id = ?', args: [idFilter.value, identity.id] },
        ], 'write');
      }
      return null;
    }
    await database.execute({ sql: `DELETE FROM "${table}" WHERE ${where.join(' AND ')}`, args: whereArgs });
    return null;
  }

  throw new HttpError(400, 'Unsupported database operation.');
};

const readWrittenRows = async (
  database: Client,
  table: TableName,
  idsOrFilters: string[] | Filter[],
  columns: string[],
  single: boolean | undefined,
  identity: Identity,
  _rowsAffected?: number,
): Promise<unknown> => {
  const args: InValue[] = [];
  const where = Array.isArray(idsOrFilters) && idsOrFilters.every((item) => typeof item === 'string')
    ? (() => {
      const ids = idsOrFilters as string[];
      args.push(...ids);
      return `id IN (${ids.map(() => '?').join(', ') || "''"})`;
    })()
    : makeWhere(table, idsOrFilters as Filter[], args, identity, 'select').join(' AND ');
  const result = await database.execute({
    sql: `SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM "${table}" WHERE ${where}`,
    args,
  });
  const rows = result.rows.map((row) => toAppRow(table, row as Record<string, unknown>));
  if (single) {
    if (rows.length !== 1) throw new HttpError(406, `Expected one row, received ${rows.length}.`);
    return rows[0];
  }
  return rows;
};

const deleteAccount = async (identity: Identity): Promise<null> => {
  const database = await getDatabase();
  const secret = await getSecret();
  if (!secret.supabaseServiceRoleKey) {
    throw new HttpError(503, 'Account deletion is not fully configured. Please contact the administrator.');
  }
  await database.batch([
    { sql: 'DELETE FROM learn_clarifications WHERE user_id = ?', args: [identity.id] },
    { sql: 'DELETE FROM learn_notes WHERE user_id = ?', args: [identity.id] },
    { sql: 'DELETE FROM learn_sections WHERE user_id = ?', args: [identity.id] },
    { sql: 'DELETE FROM learn_categories WHERE user_id = ?', args: [identity.id] },
    { sql: 'DELETE FROM test_history WHERE user_id = ?', args: [identity.id] },
    { sql: "UPDATE curriculum_materials SET submitted_by = 'deleted', submitter_email = NULL WHERE submitted_by = ?", args: [identity.id] },
    { sql: 'DELETE FROM profiles WHERE id = ?', args: [identity.id] },
  ], 'write');

  const { url: supabaseUrl } = getSupabaseConfig();
  if (!supabaseUrl) throw new HttpError(503, 'Supabase Auth deletion is not configured. Please contact the administrator.');
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(identity.id)}`, {
      method: 'DELETE',
      headers: { apikey: secret.supabaseServiceRoleKey, authorization: `Bearer ${secret.supabaseServiceRoleKey}` },
    });
  } catch {
    throw new HttpError(502, 'Your app data was removed, but the sign-in account could not be deleted. Contact the administrator.');
  }
  if (!response.ok) {
    throw new HttpError(502, 'Your app data was removed, but the sign-in account could not be deleted. Contact the administrator.');
  }
  return null;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {});

    // ПЕРЕХВАТ ПРОВЕРКИ ЗДОРОВЬЯ (БЕЗ АВТОРИЗАЦИИ)
    const requestPath = event.path || (event as any).rawPath || '';
    if (event.httpMethod === 'GET' && (requestPath.endsWith('/health') || requestPath.endsWith('/health/'))) {
      return await checkHealth();
    }

    const identity = await authenticate(event);
    if (!event.body || event.body.length > 1_000_000) throw new HttpError(413, 'Request body is missing or too large.');
    let body: unknown;
    try {
      body = JSON.parse(event.body);
    } catch {
      throw new HttpError(400, 'A valid JSON request body is required.');
    }
    if (!body || typeof body !== 'object') throw new HttpError(400, 'A JSON request body is required.');
    const result = await runQuery(body as RequestBody, identity);
    return jsonResponse(200, { data: result });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) {
      const localError = !process.env.AWS_LAMBDA_FUNCTION_NAME && error instanceof Error
        ? error.message
        : undefined;
      console.error('Turso API request failed.', localError || (error instanceof Error ? error.name : 'Unknown error'));
      if (localError) return jsonResponse(500, { error: localError });
      return jsonResponse(500, { error: 'The database request failed unexpectedly. Please retry or contact support.' });
    }
    return jsonResponse(status, { error: error instanceof Error ? error.message : 'The request is invalid.' });
  }
};

export const cleanupHandler = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execute(`
    UPDATE test_history
    SET ai_feedback = json_remove(ai_feedback, '$.details')
    WHERE (created_at < datetime('now', '-14 days') OR created_at > datetime('now') OR datetime(created_at) IS NULL)
      AND json_valid(ai_feedback)
      AND json_type(ai_feedback, '$.details') = 'array'
  `);
};