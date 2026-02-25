/**
 * POST /api/content-create
 * Creates a new content node in the tree.
 * Auto-assigns sequence if not provided.
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
    const { parent_id, type, sequence } = req.body || {};

    // Validate type
    if (!type || typeof type !== "string" || type.trim().length === 0) {
      return res.status(400).json({ error: "Content type is required." });
    }

    // Auto-calculate sequence if not provided: max(sequence) + 1 for siblings
    let finalSequence = sequence;
    if (finalSequence === undefined || finalSequence === null) {
      const siblings = await query(
        "SELECT MAX(sequence) as max_seq FROM content WHERE parent_id IS ? AND is_deleted = 0",
        [parent_id || null]
      );
      finalSequence = (siblings[0]?.max_seq ?? -1) + 1;
    }

    // Insert content node
    const result = await execute(
      `INSERT INTO content (parent_id, type, sequence, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [parent_id || null, type.trim(), finalSequence]
    );

    const newId = Number(result.lastInsertRowid);

    // Return the created row
    const rows = await query("SELECT * FROM content WHERE id = ?", [newId]);

    res.status(201).json({
      success: true,
      id: newId,
      row: rows[0] || null,
    });
  } catch (err) {
    console.error("Content create error:", err);
    res.status(500).json({ error: "Failed to create content. Please try again." });
  }
}
