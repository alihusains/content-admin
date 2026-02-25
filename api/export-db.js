/**
 * POST /api/export-db
 * Admin-only endpoint to export all active content + translations to a SQLite file.
 * Records the export in the versions table.
 * Streams the file as a download response.
 */
import { query, execute } from "../lib/db.js";
import { requireRole, handleCors } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireRole(req, res, ["admin"]);
  if (!user) return;

  try {
    const { version_number, notes } = req.body || {};

    if (!version_number) {
      return res.status(400).json({ error: "version_number is required." });
    }

    // Check for duplicate version numbers
    const existingVersion = await query(
      "SELECT id FROM versions WHERE version_number = ?",
      [version_number]
    );
    if (existingVersion.length > 0) {
      return res.status(409).json({ error: `Version ${version_number} already exists.` });
    }

    // Fetch all active content
    const contentRows = await query(
      "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
    );

    // Fetch all translations for active content
    const contentIds = contentRows.map((r) => Number(r.id));
    let translationRows = [];

    if (contentIds.length > 0) {
      // Batch query translations in chunks to avoid query size limits
      const CHUNK_SIZE = 500;
      for (let i = 0; i < contentIds.length; i += CHUNK_SIZE) {
        const chunk = contentIds.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "?").join(",");
        const chunkRows = await query(
          `SELECT * FROM content_translation WHERE content_id IN (${placeholders})`,
          chunk
        );
        translationRows = translationRows.concat(chunkRows);
      }
    }

    // Build SQLite SQL statements as a downloadable SQL dump
    // (Using SQL dump instead of binary SQLite to avoid native dependency issues on serverless)
    let sqlDump = "";

    // Content table
    sqlDump += `-- Content Admin Export v${version_number}\n`;
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    sqlDump += `-- Content rows: ${contentRows.length}\n`;
    sqlDump += `-- Translation rows: ${translationRows.length}\n\n`;

    sqlDump += `CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER,
  type TEXT,
  sequence INTEGER DEFAULT 0,
  audio_url TEXT,
  video_url TEXT,
  css TEXT,
  duas_url TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);\n\n`;

    sqlDump += `CREATE TABLE IF NOT EXISTS content_translation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  language_code TEXT NOT NULL,
  title TEXT DEFAULT '',
  transliteration TEXT DEFAULT '',
  translation TEXT DEFAULT '',
  original_text TEXT DEFAULT '',
  search_text TEXT DEFAULT '',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_id, language_code)
);\n\n`;

    // Insert content rows in batches
    sqlDump += "BEGIN TRANSACTION;\n\n";

    for (const row of contentRows) {
      const escapeSql = (v) =>
        v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

      sqlDump += `INSERT INTO content (id, parent_id, type, sequence, audio_url, video_url, css, duas_url, is_deleted, created_at, updated_at) VALUES (${escapeSql(row.id)}, ${escapeSql(row.parent_id)}, ${escapeSql(row.type)}, ${escapeSql(row.sequence)}, ${escapeSql(row.audio_url)}, ${escapeSql(row.video_url)}, ${escapeSql(row.css)}, ${escapeSql(row.duas_url)}, 0, ${escapeSql(row.created_at)}, ${escapeSql(row.updated_at)});\n`;
    }

    sqlDump += "\n";

    for (const row of translationRows) {
      const escapeSql = (v) =>
        v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

      sqlDump += `INSERT INTO content_translation (content_id, language_code, title, transliteration, translation, original_text, search_text, updated_at) VALUES (${escapeSql(row.content_id)}, ${escapeSql(row.language_code)}, ${escapeSql(row.title)}, ${escapeSql(row.transliteration)}, ${escapeSql(row.translation)}, ${escapeSql(row.original_text)}, ${escapeSql(row.search_text)}, ${escapeSql(row.updated_at)});\n`;
    }

    sqlDump += "\nCOMMIT;\n";

    // Record version in database
    await execute(
      `INSERT INTO versions (version_number, notes, file_url, content_count, translation_count, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [version_number, notes || "", "", contentRows.length, translationRows.length]
    );

    // Stream the SQL dump as a file download
    const filename = `content-export-v${version_number}.sql`;
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(sqlDump);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed. Please try again." });
  }
}
