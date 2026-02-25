/**
 * POST /api/content-reorder
 * Reorders children under a given parent by updating sequence values.
 *
 * Input: { parent_id, ordered_ids: [id1, id2, ...] }
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
    const { parent_id, ordered_ids } = req.body || {};

    // Validate ordered_ids
    if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
      return res.status(400).json({ error: "ordered_ids array is required." });
    }

    // Verify all IDs belong to the specified parent
    const parentClause = parent_id
      ? "parent_id = ?"
      : "parent_id IS NULL";
    const parentArgs = parent_id ? [parent_id] : [];

    const existing = await query(
      `SELECT id FROM content WHERE ${parentClause} AND is_deleted = 0`,
      parentArgs
    );
    const existingIds = new Set(existing.map((r) => Number(r.id)));

    for (const id of ordered_ids) {
      if (!existingIds.has(Number(id))) {
        return res.status(400).json({
          error: `Content ID ${id} does not belong to the specified parent or is deleted.`,
        });
      }
    }

    // Update sequence values
    for (let i = 0; i < ordered_ids.length; i++) {
      await execute(
        "UPDATE content SET sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [i, ordered_ids[i]]
      );
    }

    res.json({
      success: true,
      reordered_count: ordered_ids.length,
    });
  } catch (err) {
    console.error("Content reorder error:", err);
    res.status(500).json({ error: "Failed to reorder content. Please try again." });
  }
}
