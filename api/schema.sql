PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT 'Student',
  real_name TEXT,
  study_year TEXT NOT NULL DEFAULT 'year1',
  hide_from_leaderboard INTEGER NOT NULL DEFAULT 0,
  leaderboard_accepted INTEGER NOT NULL DEFAULT 0,
  gemini_api_key TEXT,
  avatar_url TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS curriculum_materials (
  id TEXT PRIMARY KEY,
  submitted_by TEXT NOT NULL,
  submitter_email TEXT,
  title TEXT NOT NULL,
  tag_name TEXT NOT NULL DEFAULT '#General',
  content_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'flagged', 'rejected')),
  ai_verdict_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS curriculum_materials_status_created_idx
  ON curriculum_materials(status, created_at DESC);
CREATE INDEX IF NOT EXISTS curriculum_materials_submitter_idx
  ON curriculum_materials(submitted_by);

CREATE TABLE IF NOT EXISTS test_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 0,
  points_earned REAL NOT NULL DEFAULT 0,
  time_spent TEXT NOT NULL DEFAULT '',
  ai_feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS test_history_user_created_idx
  ON test_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS test_history_created_idx ON test_history(created_at DESC);

CREATE TABLE IF NOT EXISTS learn_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS learn_categories_user_created_idx
  ON learn_categories(user_id, created_at);

CREATE TABLE IF NOT EXISTS learn_sections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES learn_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS learn_sections_user_category_idx
  ON learn_sections(user_id, category_id, created_at);

CREATE TABLE IF NOT EXISTS learn_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  section_id TEXT NOT NULL REFERENCES learn_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_text TEXT,
  curriculum_material_id TEXT REFERENCES curriculum_materials(id) ON DELETE SET NULL,
  source_name TEXT,
  terms TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS learn_notes_user_section_idx
  ON learn_notes(user_id, section_id, created_at);

CREATE TABLE IF NOT EXISTS learn_clarifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  section_id TEXT NOT NULL REFERENCES learn_sections(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS learn_clarifications_user_section_created_idx
  ON learn_clarifications(user_id, section_id, created_at);
