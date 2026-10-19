import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

// Load .env manually
const envFile = await readFile(new URL('../.env', import.meta.url), 'utf8').catch(() => '');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set.');
}

const turso = createClient({ url, authToken });

try {
  await turso.execute('ALTER TABLE profiles ADD COLUMN disable_vortex INTEGER NOT NULL DEFAULT 0');
  console.log('✅ Migration successful: disable_vortex column added to profiles table.');
} catch (e) {
  const msg = e?.message || String(e);
  if (msg.includes('duplicate column') || msg.includes('already exists')) {
    console.log('ℹ️  Column disable_vortex already exists — no action needed.');
  } else {
    console.error('❌ Migration error:', msg);
    process.exit(1);
  }
} finally {
  await turso.close();
}

