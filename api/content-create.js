import { db } from "../lib/db";
import { verifyToken } from "../lib/auth";

export default async function handler(req, res) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { parent_id, type, sequence } = req.body;

  await db.execute({
    sql: "INSERT INTO content (parent_id, type, sequence) VALUES (?, ?, ?)",
    args: [parent_id || null, type, sequence || 0],
  });

  res.json({ success: true });
}