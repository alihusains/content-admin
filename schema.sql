-- Content Admin Database Schema
-- Run these statements on Turso to initialize the database.

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Content tree (infinite nesting via parent_id)
CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES content(id),
  type TEXT NOT NULL DEFAULT 'item',
  sequence INTEGER DEFAULT 0,
  audio_url TEXT,
  video_url TEXT,
  css TEXT,
  duas_url TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Translations for each content node per language
CREATE TABLE IF NOT EXISTS content_translation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content(id),
  language_code TEXT NOT NULL,
  title TEXT DEFAULT '',
  transliteration TEXT DEFAULT '',
  translation TEXT DEFAULT '',
  original_text TEXT DEFAULT '',
  search_text TEXT DEFAULT '',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_id, language_code)
);

-- Export version records
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_number TEXT NOT NULL,
  notes TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  content_count INTEGER DEFAULT 0,
  translation_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_content_parent ON content(parent_id);
CREATE INDEX IF NOT EXISTS idx_content_sequence ON content(sequence);
CREATE INDEX IF NOT EXISTS idx_content_deleted ON content(is_deleted);
CREATE INDEX IF NOT EXISTS idx_translation_lookup ON content_translation(content_id, language_code);
