/**
 * POST /api/content-delete
 * Soft-deletes a content node (sets is_deleted = 1).
 * Also soft-deletes all descendant nodes recursively.
 */
import { execute, query } from "../lib/db.js";
import { requireAuth, handleCors } from "../lib/auth.js";

/**
 * Recursively collect all descendant IDs of a given parent.
 */
async function getDescendantIds(parentId) {
  const children = await query(
    "SELECT id FROM content WHERE parent_id = ? AND is_deleted = 0",
    [parentId]
  );
  let ids = [];
  for (const child of children) {
    ids.push(Number(child.id));
    const subIds = await getDescendantIds(Number(child.id));
    ids = ids.concat(subIds);
  }
  return ids;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Content ID is required." });
    }

    // Verify content exists
    const existing = await query("SELECT * FROM content WHERE id = ? AND is_deleted = 0", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Content not found or already deleted." });
    }

    // Collect all descendant IDs
    const descendantIds = await getDescendantIds(Number(id));
    const allIds = [Number(id), ...descendantIds];

    // Soft-delete all in a batch
    const statements = allIds.map((nodeId) => ({
      sql: "UPDATE content SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [nodeId],
    }));

    // Execute individually (Turso batch may not be available in all plans)
    for (const stmt of statements) {
      await execute(stmt.sql, stmt.args);
    }

    res.json({
      success: true,
      deleted_count: allIds.length,
      deleted_ids: allIds,
    });
  } catch (err) {
    console.error("Content delete error:", err);
    res.status(500).json({ error: "Failed to delete content. Please try again." });
  }
}
