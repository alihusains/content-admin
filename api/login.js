/**
 * POST /api/login
 * Authenticates user with email/password and returns a JWT token.
 */
import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { signToken, handleCors } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Find user
    const rows = await query("SELECT * FROM users WHERE email = ?", [
      email.toLowerCase().trim(),
    ]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate token
    const token = signToken({
      id: Number(user.id),
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: Number(user.id),
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}
