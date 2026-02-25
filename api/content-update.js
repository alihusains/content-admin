/**
 * POST /api/content-update
 * Updates an existing content node's fields.
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
    const { id, parent_id, type, sequence, audio_url, video_url, css, duas_url } = req.body || {};

    // Validate ID
    if (!id) {
      return res.status(400).json({ error: "Content ID is required." });
    }

    // Verify content exists and is not deleted
    const existing = await query("SELECT * FROM content WHERE id = ? AND is_deleted = 0", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Content not found." });
    }

    // Prevent circular parent reference
    if (parent_id !== undefined && parent_id !== null) {
      if (Number(parent_id) === Number(id)) {
        return res.status(400).json({ error: "Content cannot be its own parent." });
      }
      // Check parent exists
      const parentExists = await query(
        "SELECT id FROM content WHERE id = ? AND is_deleted = 0",
        [parent_id]
      );
      if (parentExists.length === 0) {
        return res.status(400).json({ error: "Parent content not found." });
      }
    }

    // Build dynamic update
    const updates = [];
    const args = [];

    if (parent_id !== undefined) {
      updates.push("parent_id = ?");
      args.push(parent_id);
    }
    if (type !== undefined) {
      updates.push("type = ?");
      args.push(type);
    }
    if (sequence !== undefined) {
      updates.push("sequence = ?");
      args.push(sequence);
    }
    if (audio_url !== undefined) {
      updates.push("audio_url = ?");
      args.push(audio_url);
    }
    if (video_url !== undefined) {
      updates.push("video_url = ?");
      args.push(video_url);
    }
    if (css !== undefined) {
      updates.push("css = ?");
      args.push(css);
    }
    if (duas_url !== undefined) {
      updates.push("duas_url = ?");
      args.push(duas_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    await execute(
      `UPDATE content SET ${updates.join(", ")} WHERE id = ?`,
      args
    );

    // Return updated row
    const rows = await query("SELECT * FROM content WHERE id = ?", [id]);

    res.json({
      success: true,
      row: rows[0] || null,
    });
  } catch (err) {
    console.error("Content update error:", err);
    res.status(500).json({ error: "Failed to update content. Please try again." });
  }
}
