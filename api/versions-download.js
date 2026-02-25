/**
 * GET /api/versions-download
 * Downloads a specific version's export.
 * If file_url exists, redirects to it.
 * Otherwise, regenerates the SQL export on the fly for that version.
 * Query params: id — version record ID
 */
import { query } from "../lib/db.js";
import { requireAuth, handleCors } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const versionId = req.query?.id;

    if (!versionId) {
      return res.status(400).json({ error: "Version ID is required." });
    }

    const rows = await query("SELECT * FROM versions WHERE id = ?", [versionId]);
    const version = rows[0];

    if (!version) {
      return res.status(404).json({ error: "Version not found." });
    }

    // If a stored file URL exists, redirect to it
    if (version.file_url) {
      return res.redirect(302, version.file_url);
    }

    // Otherwise regenerate the export as a SQL dump
    const contentRows = await query(
      "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
    );

    const contentIds = contentRows.map((r) => Number(r.id));
    let translationRows = [];
    if (contentIds.length > 0) {
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

    const escapeSql = (v) =>
      v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

    let sqlDump = `-- Content Admin Export v${version.version_number}\n`;
    sqlDump += `-- Regenerated: ${new Date().toISOString()}\n\n`;

    sqlDump += `CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY, parent_id INTEGER, type TEXT, sequence INTEGER DEFAULT 0,
  audio_url TEXT, video_url TEXT, css TEXT, duas_url TEXT,
  is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
);\n\n`;

    sqlDump += `CREATE TABLE IF NOT EXISTS content_translation (
  id INTEGER PRIMARY KEY AUTOINCREMENT, content_id INTEGER NOT NULL,
  language_code TEXT NOT NULL, title TEXT DEFAULT '', transliteration TEXT DEFAULT '',
  translation TEXT DEFAULT '', original_text TEXT DEFAULT '', search_text TEXT DEFAULT '',
  updated_at TEXT, UNIQUE(content_id, language_code)
);\n\n`;

    sqlDump += "BEGIN TRANSACTION;\n";
    for (const r of contentRows) {
      sqlDump += `INSERT INTO content (id,parent_id,type,sequence,audio_url,video_url,css,duas_url,is_deleted,created_at,updated_at) VALUES (${escapeSql(r.id)},${escapeSql(r.parent_id)},${escapeSql(r.type)},${escapeSql(r.sequence)},${escapeSql(r.audio_url)},${escapeSql(r.video_url)},${escapeSql(r.css)},${escapeSql(r.duas_url)},0,${escapeSql(r.created_at)},${escapeSql(r.updated_at)});\n`;
    }
    for (const r of translationRows) {
      sqlDump += `INSERT INTO content_translation (content_id,language_code,title,transliteration,translation,original_text,search_text,updated_at) VALUES (${escapeSql(r.content_id)},${escapeSql(r.language_code)},${escapeSql(r.title)},${escapeSql(r.transliteration)},${escapeSql(r.translation)},${escapeSql(r.original_text)},${escapeSql(r.search_text)},${escapeSql(r.updated_at)});\n`;
    }
    sqlDump += "COMMIT;\n";

    const filename = `content-export-v${version.version_number}.sql`;
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(sqlDump);
  } catch (err) {
    console.error("Version download error:", err);
    res.status(500).json({ error: "Failed to download version." });
  }
}
