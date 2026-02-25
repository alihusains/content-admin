/**
 * POST /api/register
 * One-time admin registration endpoint.
 * Guarded by ALLOW_INITIAL_REGISTER env var.
 */
import bcrypt from "bcryptjs";
import { execute, query } from "../lib/db.js";
import { handleCors } from "../lib/auth.js";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Guard: only enabled when ALLOW_INITIAL_REGISTER is 'true'
  if (process.env.ALLOW_INITIAL_REGISTER !== "true") {
    return res.status(403).json({
      error: "Registration is disabled. Set ALLOW_INITIAL_REGISTER=true in environment to enable.",
    });
  }

  try {
    const { email, password } = req.body || {};

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    // Check if user already exists
    const existing = await query("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Hash password and create admin user
    const hash = await bcrypt.hash(password, 10);
    const result = await execute(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
      [email.toLowerCase().trim(), hash]
    );

    res.status(201).json({
      success: true,
      message: "Admin account created. Disable ALLOW_INITIAL_REGISTER after setup.",
      userId: Number(result.lastInsertRowid),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
}
