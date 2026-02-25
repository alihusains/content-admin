/**
 * GET /api/versions-list
 * Returns all version records ordered by created_at desc.
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
    const rows = await query(
      "SELECT * FROM versions ORDER BY created_at DESC"
    );

    res.json({ versions: rows, count: rows.length });
  } catch (err) {
    console.error("Versions list error:", err);
    res.status(500).json({ error: "Failed to load versions." });
  }
}
