/**
 * GET /api/content-tree
 * Returns the full content tree as a flat list sorted by parent_id, sequence.
 * Frontend assembles the tree structure.
 *
 * Query params:
 *   mode=structure (default) — returns content rows only
 *   mode=with-language&language_code=xx — joins translations for that language
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
    const mode = req.query?.mode || "structure";
    const languageCode = req.query?.language_code;

    let rows;

    if (mode === "with-language" && languageCode) {
      // Join with translations for the specified language
      rows = await query(
        `SELECT c.*,
                ct.language_code, ct.title, ct.transliteration,
                ct.translation, ct.original_text, ct.search_text,
                ct.updated_at as translation_updated_at
         FROM content c
         LEFT JOIN content_translation ct
           ON c.id = ct.content_id AND ct.language_code = ?
         WHERE c.is_deleted = 0
         ORDER BY c.parent_id, c.sequence`,
        [languageCode]
      );
    } else {
      // Structure only
      rows = await query(
        "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
      );
    }

    res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Content tree error:", err);
    res.status(500).json({ error: "Failed to load content tree." });
  }
}
