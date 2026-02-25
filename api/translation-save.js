/**
 * POST /api/translation-save
 * Upserts a translation for a content node.
 * Uses INSERT ... ON CONFLICT ... DO UPDATE for idempotent saves.
 */
import { execute, query } from "../lib/db.js";
import { requireAuth, handleCors } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const {
      content_id,
      language_code,
      title,
      transliteration,
      translation,
      original_text,
      search_text,
    } = req.body || {};

    // Validate required fields
    if (!content_id) {
      return res.status(400).json({ error: "content_id is required." });
    }
    if (!language_code || typeof language_code !== "string") {
      return res.status(400).json({ error: "language_code is required." });
    }

    // Verify content exists
    const existing = await query(
      "SELECT id FROM content WHERE id = ? AND is_deleted = 0",
      [content_id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Content not found." });
    }

    // Upsert translation
    await execute(
      `INSERT INTO content_translation
       (content_id, language_code, title, transliteration, translation, original_text, search_text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(content_id, language_code)
       DO UPDATE SET
         title = excluded.title,
         transliteration = excluded.transliteration,
         translation = excluded.translation,
         original_text = excluded.original_text,
         search_text = excluded.search_text,
         updated_at = CURRENT_TIMESTAMP`,
      [
        content_id,
        language_code.trim(),
        title || "",
        transliteration || "",
        translation || "",
        original_text || "",
        search_text || "",
      ]
    );

    res.json({ success: true, content_id, language_code });
  } catch (err) {
    console.error("Translation save error:", err);
    res.status(500).json({ error: "Failed to save translation. Please try again." });
  }
}
