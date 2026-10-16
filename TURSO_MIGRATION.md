# revISE: Supabase database to Turso on AWS

This change moves **application data** to Turso. Supabase remains the identity provider for GitHub sign-in, passwords, email verification, and access tokens. AWS API Gateway and Lambda sit between the static S3/CloudFront site and Turso:

```text
Browser ──Supabase Auth──> Supabase Auth
Browser ──Bearer access token──> CloudFront /api/data ──> API Gateway ──> Lambda ──> Turso
```

The browser never receives a Turso URL/token or a Supabase service-role key. Lambda checks every bearer token against Supabase Auth and enforces row ownership before issuing SQL. CloudFront forwards `/api/*` to API Gateway without caching it.

> **Do not delete or pause the existing Supabase project during migration.** Supabase Auth is still required, and the old database is the rollback copy until the Turso cutover has been verified.

## What is included

- SQLite-compatible tables and indexes in [`api/schema.sql`](./api/schema.sql).
- A Lambda data API with table/column allowlists, Supabase token verification, user scoping, and a server-only administrator check in [`api/handler.ts`](./api/handler.ts).
- CDK resources for Lambda, API Gateway, hourly answer-detail cleanup, and CloudFront `/api/*` routing in [`cdk/lib/static-site-stack.ts`](./cdk/lib/static-site-stack.ts).
- A schema initializer, a repeatable ID-based data copier, and this cutover guide.
- Supabase Auth is intentionally retained. Account deletion removes Turso data and uses a server-only Supabase service-role key to delete the Auth user.

## Before starting

1. Keep the existing Supabase project and its database intact.
2. Do not push the application change to `main` until the Turso schema exists, data has been copied, and the GitHub deployment secrets below are configured. A successful deployment switches the live browser from Supabase database queries to Turso.
3. Plan a short write freeze for the final copy and first deployment. During that window, do not create notes, take quizzes, upload materials, or change account settings. The final import is a snapshot; changes made in the old site after that snapshot will not automatically appear in Turso.
4. Back up or export the existing Supabase tables before proceeding.
5. Confirm the current Turso plan's storage, read/write, and overage quotas in Turso's dashboard. Do not assume an advertised storage figure is unlimited or permanently included in a free plan.

## 1. Create the Turso database and access token

1. Sign in to the Turso dashboard and create a database in a region close to the AWS deployment/users.
2. Create a database authentication token with read/write access. Keep it private.
3. Copy the database URL (usually starts with `libsql://`) and the token. Do not put either value in client-side variables such as `PUBLIC_*`, source files, or Git.

The Turso database stores compact text/JSON summaries, not original uploaded slide files. The application continues to store the reduced, moderated summary text it already creates.

## 2. Create the schema

In PowerShell, set credentials only for the current terminal, then initialize the database:

```powershell
$env:TURSO_DATABASE_URL = "libsql://YOUR-DATABASE-YOUR-ORG.turso.io"
$env:TURSO_AUTH_TOKEN = "YOUR_TURSO_DATABASE_TOKEN"
npm run turso:init
```

The command reads [`api/schema.sql`](./api/schema.sql), creates the tables/indexes, and prints the resulting table list. It is safe to rerun: it uses `CREATE ... IF NOT EXISTS`.

Expected application tables:

- `profiles`
- `curriculum_materials`
- `test_history`
- `learn_categories`
- `learn_sections`
- `learn_notes`
- `learn_clarifications`

If it reports an error, stop here and do not deploy the client switch.

## 3. Copy existing rows from Supabase

The migration script uses the Supabase **service-role key only on your own computer** to read all rows, including rows protected by RLS. It uses the existing IDs, so user IDs still match Supabase Auth IDs and relationships remain intact. The script never writes the service-role key to a file.

1. In Supabase, get the project URL and the `service_role` secret key from **Project Settings → API**. Do not use the `anon` key for this export; RLS would hide other users' data.
2. Set all four environment variables in the same PowerShell window:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY"
$env:TURSO_DATABASE_URL = "libsql://YOUR-DATABASE-YOUR-ORG.turso.io"
$env:TURSO_AUTH_TOKEN = "YOUR_TURSO_DATABASE_TOKEN"
```

3. Run a read-only dry run and check the row counts:

```powershell
npm run migrate:turso -- --dry-run
```

4. If every table is read successfully and the counts look plausible, pause writes to the current site and run the actual import:

```powershell
npm run migrate:turso
```

The importer pages through each table, copies rows in batches, preserves IDs, converts `terms` to compact JSON text, and removes question-level `details` from feedback already older than 14 days. It uses `ON CONFLICT(id) DO UPDATE`, so rerunning it updates matching IDs; it does not delete Turso rows that are absent from Supabase.

5. After the import completes, clear the sensitive values from the shell:

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
Remove-Item Env:TURSO_AUTH_TOKEN
Remove-Item Env:TURSO_DATABASE_URL
```

Never paste credentials into chat, commit them, add them to `.env.production`, or take screenshots that show them.

### Verify the copied data

Run these queries in the Turso SQL console (or the database shell). Counts should match the corresponding table counts in Supabase, except that `ai_feedback` detail arrays are intentionally trimmed for records older than 14 days:

```sql
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL SELECT 'curriculum_materials', COUNT(*) FROM curriculum_materials
UNION ALL SELECT 'test_history', COUNT(*) FROM test_history
UNION ALL SELECT 'learn_categories', COUNT(*) FROM learn_categories
UNION ALL SELECT 'learn_sections', COUNT(*) FROM learn_sections
UNION ALL SELECT 'learn_notes', COUNT(*) FROM learn_notes
UNION ALL SELECT 'learn_clarifications', COUNT(*) FROM learn_clarifications;
```

Also inspect a sample of each user's rows and confirm `profiles.id` matches that user's Supabase Auth UUID. Do not continue if IDs, counts, or Learn links are wrong.

## 4. Store server credentials in AWS Secrets Manager

Create one secret in the **same AWS account and region** used by the CDK deployment:

1. Open **AWS Console → Secrets Manager → Store a new secret**.
2. Select **Other type of secret** and enter these exact JSON key/value pairs:

```json
{
  "tursoUrl": "libsql://YOUR-DATABASE-YOUR-ORG.turso.io",
  "tursoAuthToken": "YOUR_TURSO_DATABASE_TOKEN",
  "supabaseServiceRoleKey": "YOUR_SUPABASE_SERVICE_ROLE_KEY"
}
```

3. Name it, for example, `revise/production/turso`.
4. Copy its full Secret ARN. Lambda is granted read access only to this secret. The service-role key is needed only by the account-deletion endpoint; it is never sent to the browser.

If account deletion must be disabled, the service-role field can be omitted, but deletion in Settings will return a visible configuration error instead of silently claiming success.

## 5. Configure GitHub Actions

In the repository, open **Settings → Secrets and variables → Actions**.

Add/update these **Repository secrets**:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | Existing deployment IAM user's access key |
| `AWS_SECRET_ACCESS_KEY` | Existing deployment IAM user's secret |
| `PUBLIC_SUPABASE_URL` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key, not the service-role key |
| `TURSO_SECRET_ARN` | Full ARN of the Secrets Manager secret from step 4 |

Add a **Repository variable**:

| Variable | Value |
|---|---|
| `ADMIN_EMAIL` | The verified email of the revISE administrator (currently `dinosaurkiril@gmail.com`) |

The AWS deployment IAM identity needs permission to deploy the CDK stack and manage its S3, CloudFront, API Gateway, Lambda, EventBridge, IAM, CloudFormation, and asset-bootstrap resources. It also needs permission for CDK to reference the existing Secrets Manager secret. Avoid using root AWS credentials.

## 6. Deploy the cutover

Only after Turso is initialized, the import is verified, and GitHub secrets are set:

1. Keep the old app in its write freeze.
2. Commit and push the migration changes to `main` (or merge the migration branch into `main`).
3. Open **GitHub → Actions → Deploy Astro to AWS** and inspect the run.
4. Wait for the CDK deployment and CloudFront invalidation to finish. CloudFront may take several minutes to distribute the new `/api/*` route and static site.
5. Keep the old Supabase database unchanged as a rollback copy.

The workflow builds the static website and deploys the API infrastructure together. The website uses the same CloudFront domain for `/api/data`, so no Turso URL/token is embedded in the generated client bundle.

## 7. Verify the live application

Use an existing test account and, if possible, a separate test account. Check each item:

1. GitHub sign-in, verified student email checks, password change, sign-out, and return login still use Supabase Auth.
2. Existing profile, study year, leaderboard privacy, and onboarding profile load correctly.
3. Categories, sections, manual notes, AI notes, glossary terms, and clarifications load/create/update/delete.
4. Quiz results, full answer details, history export, streaks, and leaderboard load correctly.
5. Approved shared study materials load; uploading a moderated item persists it; an admin can approve/reject flagged items.
6. Account deletion succeeds for a disposable test account, deletes its private Turso records and Supabase Auth user, and anonymizes contributed shared materials.
7. In the browser developer tools, confirm data calls use the site's `/api/data` path and do not contain Turso credentials or a Supabase service-role key.

The AWS EventBridge rule invokes an hourly Lambda to remove `details` from `test_history.ai_feedback` older than 14 days while preserving summary feedback and scores. Check the `TestHistoryCleanupHandler` CloudWatch log group after the first scheduled run. Cleanup may occur up to an hour after the 14-day cutoff.

## 8. Rollback

Do not delete the Supabase database during the verification period.

If the new site cannot sign in to Turso, first inspect Lambda/API Gateway/CloudFront logs and the Secrets Manager ARN/permissions. To return to the old data path, redeploy the last known-good static-site revision that still uses Supabase database queries. Remember that any writes made after the Turso cutover exist only in Turso; rolling back the frontend does **not** copy those writes to Supabase. Export them from Turso before a rollback that must preserve new user activity.

## Simple local development

Run the whole app and its local database API with the usual command:

```powershell
npm run dev
```

This starts Astro and a small local API together. GitHub sign-in still uses Supabase Auth. Browser data requests go to `http://localhost:8787`, and the local API connects to Turso on the server side. The browser never receives the Turso token. Changes to notes, profiles, quizzes, and other data are written to Turso immediately; neither Astro nor the API needs a restart after a database write. UI changes continue to use Astro hot reload.

Add these non-public settings to the ignored repository-root `.env` (the Supabase values should already be there):

```dotenv
TURSO_DATABASE_URL=libsql://YOUR-DATABASE-YOUR-ORG.turso.io
TURSO_AUTH_TOKEN=YOUR_TURSO_DATABASE_TOKEN
```

Use the Turso database URL and token from your Turso account. The same variables can initialize the schema with `npm run turso:init`. Changing `.env` requires restarting `npm run dev` once so the local API reads the new settings; normal data changes do not.

For the simplest start, this can use the Turso database created earlier. Be aware that local test activity will then appear in that database too. To keep experiments separate, create another Turso development database, run `npm run turso:init` against it, and put its URL/token in `.env`.

This local workflow requires **no AWS deployment, AWS access keys, API Gateway URL, or extra Supabase SQL**. AWS Secrets Manager remains necessary for the deployed production Lambda, which reads its Turso credentials there. The local API reads them from `.env`, which must never be committed. Never prefix Turso credentials with `PUBLIC_`.

## Important operational notes

- This migration does **not** move users/passwords out of Supabase Auth. Turso stores the same Auth UUIDs as `user_id`/`profiles.id`.
- Do not disable or delete Supabase Auth without planning a separate identity migration.
- Supabase `pg_cron` is no longer responsible for history retention after cutover; the hourly EventBridge/Lambda job replaces it.
- A successful `npm run build` does not prove live Turso credentials, AWS permissions, or deployed CloudFront routing are correct. Complete the live verification list before inviting users.
- Monitor Turso storage/read/write quotas and AWS API Gateway/Lambda usage after launch. Revisit plan limits and prices in the provider dashboards because free-tier terms can change.
