import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";

export default async function handler(req, res) {
  const { email, password } = req.body;

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email],
  });

  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid" });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET
  );

  res.json({ token });
}