/**
 * GET /api/stats
 * Returns dashboard statistics (content count, translation count, version count).
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
    const [contentCount] = await query(
      "SELECT COUNT(*) as count FROM content WHERE is_deleted = 0"
    );
    const [translationCount] = await query(
      "SELECT COUNT(*) as count FROM content_translation"
    );
    const [versionCount] = await query(
      "SELECT COUNT(*) as count FROM versions"
    );
    const [rootCount] = await query(
      "SELECT COUNT(*) as count FROM content WHERE parent_id IS NULL AND is_deleted = 0"
    );

    // Get content types breakdown
    const typeBreakdown = await query(
      "SELECT type, COUNT(*) as count FROM content WHERE is_deleted = 0 GROUP BY type ORDER BY count DESC"
    );

    // Get languages used
    const languages = await query(
      "SELECT language_code, COUNT(*) as count FROM content_translation GROUP BY language_code ORDER BY count DESC"
    );

    // Latest version
    const [latestVersion] = await query(
      "SELECT * FROM versions ORDER BY created_at DESC LIMIT 1"
    );

    res.json({
      content_count: contentCount?.count || 0,
      translation_count: translationCount?.count || 0,
      version_count: versionCount?.count || 0,
      root_count: rootCount?.count || 0,
      type_breakdown: typeBreakdown,
      languages,
      latest_version: latestVersion || null,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to load statistics." });
  }
}
