import { createClient } from '@libsql/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const tables = [
  {
    name: 'profiles',
    columns: ['id', 'email', 'nickname', 'real_name', 'study_year', 'hide_from_leaderboard', 'leaderboard_accepted', 'gemini_api_key', 'updated_at'],
    booleans: ['hide_from_leaderboard', 'leaderboard_accepted'],
  },
  {
    name: 'curriculum_materials',
    columns: ['id', 'submitted_by', 'submitter_email', 'title', 'tag_name', 'content_text', 'status', 'ai_verdict_reason', 'created_at'],
  },
  {
    name: 'test_history',
    columns: ['id', 'user_id', 'title', 'type', 'score', 'max_score', 'points_earned', 'time_spent', 'ai_feedback', 'created_at'],
  },
  {
    name: 'learn_categories',
    columns: ['id', 'user_id', 'name', 'created_at'],
  },
  {
    name: 'learn_sections',
    columns: ['id', 'user_id', 'category_id', 'name', 'created_at'],
  },
  {
    name: 'learn_notes',
    columns: ['id', 'user_id', 'section_id', 'title', 'content_text', 'curriculum_material_id', 'source_name', 'terms', 'created_at'],
    jsonColumns: ['terms'],
  },
  {
    name: 'learn_clarifications',
    columns: ['id', 'user_id', 'section_id', 'selected_text', 'question', 'answer', 'created_at'],
  },
];

let totalRows = 0;
for (const table of tables) {
  let offset = 0;
  let tableCount = 0;
  const pendingWrites = [];
  while (true) {
    const { data, error } = await supabase
      .from(table.name)
      .select(table.columns.join(','))
      .range(offset, offset + 499);
    if (error) throw new Error(`Could not read ${table.name} at row ${offset}: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      tableCount += 1;
      if (dryRun) continue;
      const sourceRow = { ...row };
      const historyAge = table.name === 'test_history' && typeof sourceRow.created_at === 'string'
        ? Date.now() - new Date(sourceRow.created_at).getTime()
        : null;
      if (table.name === 'test_history' && typeof historyAge === 'number'
        && (!Number.isFinite(historyAge) || historyAge < 0 || historyAge > 14 * 24 * 60 * 60 * 1000)
        && typeof sourceRow.ai_feedback === 'string') {
        try {
          const feedback = JSON.parse(sourceRow.ai_feedback);
          if (feedback && typeof feedback === 'object' && Array.isArray(feedback.details)) {
            delete feedback.details;
            sourceRow.ai_feedback = JSON.stringify(feedback);
          }
        } catch {
          // Existing plain-text feedback is retained unchanged.
        }
      }
      const values = table.columns.map((column) => {
        const value = sourceRow[column];
        if (value === undefined || value === null) return null;
        if (table.booleans?.includes(column)) return value ? 1 : 0;
        if (table.jsonColumns?.includes(column)) return JSON.stringify(value);
        return value;
      });
      const placeholders = table.columns.map(() => '?').join(', ');
      const updates = table.columns.filter((column) => column !== 'id')
        .map((column) => `"${column}" = excluded."${column}"`)
        .join(', ');
      pendingWrites.push({
        sql: `INSERT INTO "${table.name}" (${table.columns.map((column) => `"${column}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
        args: values,
      });
      if (pendingWrites.length === 100) {
        await turso.batch(pendingWrites.splice(0, pendingWrites.length), 'write');
        console.log(`Copied ${tableCount} rows from ${table.name}`);
      }
    }
    if (data.length < 500) break;
    offset += data.length;
  }
  if (!dryRun && pendingWrites.length) await turso.batch(pendingWrites, 'write');
  totalRows += tableCount;
  console.log(`${dryRun ? 'Found' : 'Copied'} ${tableCount} rows in ${table.name}`);
}

if (dryRun) {
  console.log(`Dry run complete. ${totalRows} rows would be copied; no Turso data was changed.`);
} else {
  console.log(`Migration complete: ${totalRows} rows copied. Verify row counts in Turso before switching the site.`);
}

await turso.close();
