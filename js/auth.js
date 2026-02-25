/**
 * Authentication module for client-side auth.
 * Uses bcryptjs (loaded from CDN) to verify passwords against hashes in the DB.
 * Session is stored in sessionStorage (cleared when tab closes).
 */

const Auth = {
  /**
   * Get the current session
   * @returns {{ id: number, email: string, role: string } | null}
   */
  getSession() {
    const raw = sessionStorage.getItem("admin_session");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Save session data
   */
  setSession(user) {
    sessionStorage.setItem("admin_session", JSON.stringify(user));
  },

  /**
   * Clear session and redirect to login
   */
  logout() {
    sessionStorage.removeItem("admin_session");
    window.location.href = "index.html";
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.getSession() !== null;
  },

  /**
   * Login with email and password.
   * Queries the users table and compares password using bcryptjs.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ id: number, email: string, role: string }>}
   */
  async login(email, password) {
    // Query user from database
    const rows = await TursoDB.query(
      "SELECT * FROM users WHERE email = ?",
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) throw new Error("Invalid email or password.");

    // Compare password using bcryptjs (loaded from CDN, available as global `dcodeIO.bcrypt`)
    const bcrypt = window.dcodeIO?.bcrypt;
    if (!bcrypt) throw new Error("Crypto library not loaded. Please refresh the page.");

    const valid = await new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password_hash, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (!valid) throw new Error("Invalid email or password.");

    const session = { id: user.id, email: user.email, role: user.role };
    this.setSession(session);
    return session;
  },

  /**
   * Register a new admin user.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  async register(email, password) {
    const bcrypt = window.dcodeIO?.bcrypt;
    if (!bcrypt) throw new Error("Crypto library not loaded.");

    // Check if user exists
    const existing = await TursoDB.query("SELECT id FROM users WHERE email = ?", [
      email.toLowerCase().trim(),
    ]);
    if (existing.length > 0) throw new Error("An account with this email already exists.");

    // Hash password
    const hash = await new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) reject(err);
        else resolve(hash);
      });
    });

    await TursoDB.execute(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
      [email.toLowerCase().trim(), hash]
    );
  },

  /**
   * Guard: redirect to login if not authenticated.
   * Call at the top of every protected page.
   * @returns {boolean}
   */
  requireLogin() {
    if (!TursoDB.isConfigured()) {
      window.location.href = "index.html";
      return false;
    }
    if (!this.isLoggedIn()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  },
};
