import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before initializing the Turso database.');
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  const schema = await readFile(new URL('../api/schema.sql', import.meta.url), 'utf8');
  await turso.executeMultiple(schema);
  const result = await turso.execute('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name', ['table']);
  console.log(`Turso schema is ready. Tables: ${result.rows.map((row) => String(row.name)).join(', ')}`);
} finally {
  await turso.close();
}
