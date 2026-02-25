/**
 * GET /api/content-children
 * Returns immediate children of a given parent_id.
 * Used for lazy-loading large trees.
 * Optimized: uses LEFT JOIN + GROUP BY to count grandchildren in a single query.
 *
 * Query params:
 *   parent_id — the parent content ID (use "null" or omit for root)
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
    const parentId = req.query?.parent_id;

    let rows;
    if (!parentId || parentId === "null" || parentId === "undefined") {
      // Root-level items with child counts in a single query
      rows = await query(
        `SELECT c.*, COUNT(ch.id) as child_count
         FROM content c
         LEFT JOIN content ch ON ch.parent_id = c.id AND ch.is_deleted = 0
         WHERE c.parent_id IS NULL AND c.is_deleted = 0
         GROUP BY c.id
         ORDER BY c.sequence`
      );
    } else {
      rows = await query(
        `SELECT c.*, COUNT(ch.id) as child_count
         FROM content c
         LEFT JOIN content ch ON ch.parent_id = c.id AND ch.is_deleted = 0
         WHERE c.parent_id = ? AND c.is_deleted = 0
         GROUP BY c.id
         ORDER BY c.sequence`,
        [Number(parentId)]
      );
    }

    // Add has_children boolean for the frontend
    const enriched = rows.map((row) => ({
      ...row,
      has_children: (row.child_count || 0) > 0,
      child_count: row.child_count || 0,
    }));

    res.json({ rows: enriched, count: enriched.length });
  } catch (err) {
    console.error("Content children error:", err);
    res.status(500).json({ error: "Failed to load children." });
  }
}
