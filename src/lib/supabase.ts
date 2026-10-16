import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const useTursoApi = import.meta.env.PROD || import.meta.env.DEV;
const databaseApiBase = import.meta.env.DEV
  ? 'http://localhost:8787/api'
  : import.meta.env.PUBLIC_DATABASE_API_URL?.replace(/\/+$/, '') || '/api';

const authClient = createClient(supabaseUrl, supabaseAnonKey);

type QueryOperation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';
type QueryFilter = { column: string; operator: string; value?: unknown };
type QueryResponse = { data: any; error: { message: string; code?: string } | null };

class TursoQuery {
  private operation: QueryOperation = 'select';
  private values?: Record<string, unknown> | Array<Record<string, unknown>>;
  private columns = '*';
  private readonly filters: QueryFilter[] = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private offset = 0;
  private limitValue = 1000;
  private singleResult = false;
  private hasProjection = false;

  constructor(private readonly table: string) {}

  select(columns = '*') {
    this.columns = columns;
    this.hasProjection = true;
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.operation = 'upsert';
    this.values = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.addFilter(column, 'neq', value); }
  gte(column: string, value: unknown) { return this.addFilter(column, 'gte', value); }
  gt(column: string, value: unknown) { return this.addFilter(column, 'gt', value); }
  lte(column: string, value: unknown) { return this.addFilter(column, 'lte', value); }
  lt(column: string, value: unknown) { return this.addFilter(column, 'lt', value); }
  in(column: string, value: unknown[]) { return this.addFilter(column, 'in', value); }
  not(column: string, operator: string, value: unknown) {
    return this.addFilter(column, operator === 'is' ? 'not_is' : `not_${operator}`, value);
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(value: number) {
    this.limitValue = value;
    return this;
  }
  range(from: number, to: number) {
    this.offset = from;
    this.limitValue = to - from + 1;
    return this;
  }
  single() {
    this.singleResult = true;
    return this;
  }
  maybeSingle() {
    this.singleResult = true;
    return this;
  }

  private addFilter(column: string, operator: string, value: unknown) {
    this.filters.push({ column, operator, value });
    return this;
  }

  private async execute(): Promise<QueryResponse> {
    try {
      const { data: { session }, error: sessionError } = await authClient.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Please sign in again to access your data.');

      const response = await fetch(`${databaseApiBase}/data`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          values: this.values,
          columns: this.hasProjection ? this.columns : undefined,
          filters: this.filters,
          orders: this.orders,
          offset: this.offset,
          limit: this.limitValue,
          single: this.singleResult,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result
          ? String((result as { error: unknown }).error)
          : `Database request failed with status ${response.status}.`;
        return { data: null, error: { message, code: String(response.status) } };
      }
      return { data: result && typeof result === 'object' && 'data' in result ? (result as { data: unknown }).data : null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Database request failed.' } };
    }
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

const callRpc = async (name: string): Promise<QueryResponse> => {
  try {
    const { data: { session }, error: sessionError } = await authClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error('Please sign in again to access your data.');
    const response = await fetch(`${databaseApiBase}/data`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ operation: 'rpc', rpc: name }),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const message = result && typeof result === 'object' && 'error' in result
        ? String((result as { error: unknown }).error)
        : `Database request failed with status ${response.status}.`;
      return { data: null, error: { message, code: String(response.status) } };
    }
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Database request failed.' } };
  }
};

export const supabase = new Proxy(authClient, {
  get(target, property, receiver) {
    if (property === 'from') {
      return useTursoApi
        ? (table: string) => new TursoQuery(table)
        : (table: string) => target.from(table);
    }
    if (property === 'rpc') {
      return useTursoApi
        ? (name: string) => callRpc(name)
        : (...args: Parameters<typeof target.rpc>) => target.rpc(...args);
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});