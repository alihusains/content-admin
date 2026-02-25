/**
 * Authentication utilities for JWT-based auth and role-based access control.
 * Provides middleware-style helpers for Vercel serverless functions.
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = () => process.env.JWT_SECRET;
const TOKEN_EXPIRY = "12h";

/**
 * Sign a JWT token with the given payload.
 * @param {object} payload - Data to encode (typically { id, email, role })
 * @returns {string} Signed JWT token
 */
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT from the Authorization header.
 * Expects format: "Bearer <token>"
 * @param {object} req - HTTP request object
 * @returns {object|null} Decoded token payload, or null if invalid
 */
export function verifyToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns decoded user or sends 401.
 * @param {object} req - HTTP request
 * @param {object} res - HTTP response
 * @returns {object|null} Decoded user payload, or null (response already sent)
 */
export function requireAuth(req, res) {
  const user = verifyToken(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return null;
  }
  return user;
}

/**
 * Require specific role(s). Returns decoded user or sends 403.
 * Must be called after requireAuth or verifyToken succeeds.
 * @param {object} req - HTTP request
 * @param {object} res - HTTP response
 * @param {string[]} roles - Allowed roles (e.g., ['admin'])
 * @returns {object|null} Decoded user, or null (response already sent)
 */
export function requireRole(req, res, roles) {
  const user = requireAuth(req, res);
  if (!user) return null; // 401 already sent

  if (!roles.includes(user.role)) {
    res.status(403).json({ error: "Insufficient permissions for this action." });
    return null;
  }
  return user;
}

/**
 * CORS headers helper — sets permissive CORS for API routes.
 * @param {object} res - HTTP response
 */
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Handle OPTIONS preflight and set CORS. Returns true if preflight was handled.
 * @param {object} req
 * @param {object} res
 * @returns {boolean}
 */
export function handleCors(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
