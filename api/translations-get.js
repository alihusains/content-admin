/**
 * GET /api/translations-get
 * Returns all translations for a specific content node.
 * Query params: content_id
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
    const contentId = req.query?.content_id;

    if (!contentId) {
      return res.status(400).json({ error: "content_id is required." });
    }

    const rows = await query(
      "SELECT * FROM content_translation WHERE content_id = ? ORDER BY language_code",
      [contentId]
    );

    // Convert to a map keyed by language_code for easy frontend consumption
    const byLanguage = {};
    for (const row of rows) {
      byLanguage[row.language_code] = row;
    }

    res.json({ translations: byLanguage, rows, count: rows.length });
  } catch (err) {
    console.error("Translations get error:", err);
    res.status(500).json({ error: "Failed to load translations." });
  }
}
