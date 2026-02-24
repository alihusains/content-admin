import { db } from "../lib/db";
import { verifyToken } from "../lib/auth";

export default async function handler(req, res) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const result = await db.execute(
    "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
  );

  res.json(result.rows);
}