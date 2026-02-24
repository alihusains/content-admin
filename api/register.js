import bcrypt from "bcryptjs";
import { db } from "../lib/db";

export default async function handler(req, res) {
  const { email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await db.execute({
    sql: "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
    args: [email, hash],
  });

  res.json({ success: true });
}