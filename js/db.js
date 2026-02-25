/**
 * Turso HTTP API Client
 * Communicates directly with Turso's v2 pipeline endpoint from the browser.
 * No server-side proxy needed — credentials are stored in localStorage.
 *
 * Turso HTTP API format:
 *   POST https://<db>.turso.io/v2/pipeline
 *   Authorization: Bearer <token>
 *   Body: { requests: [{ type: "execute", stmt: { sql, args } }, { type: "close" }] }
 */

const TursoDB = {
  /**
   * Get stored Turso credentials
   * @returns {{ url: string, token: string } | null}
   */
  getCredentials() {
    const url = localStorage.getItem("turso_url");
    const token = localStorage.getItem("turso_token");
    if (!url || !token) return null;
    return { url, token };
  },

  /**
   * Store Turso credentials
   */
  setCredentials(url, token) {
    // Normalize URL: libsql:// → https://, strip trailing slash
    url = url.trim().replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
    if (!url.startsWith("https://")) url = "https://" + url;
    localStorage.setItem("turso_url", url);
    localStorage.setItem("turso_token", token.trim());
  },

  /**
   * Clear stored credentials
   */
  clearCredentials() {
    localStorage.removeItem("turso_url");
    localStorage.removeItem("turso_token");
  },

  /**
   * Check if Turso is configured
   */
  isConfigured() {
    return this.getCredentials() !== null;
  },

  /**
   * Convert a JS value to a Turso HTTP API typed arg
   */
  _toArg(value) {
    if (value === null || value === undefined) {
      return { type: "null" };
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        return { type: "integer", value: String(value) };
      }
      return { type: "float", value };
    }
    return { type: "text", value: String(value) };
  },

  /**
   * Parse a Turso HTTP API response row into a plain object
   */
  _parseRows(result) {
    if (!result || !result.cols || !result.rows) return [];
    const cols = result.cols.map((c) => c.name);
    return result.rows.map((row) => {
      const obj = {};
      row.forEach((cell, i) => {
        // cell is { type, value } — extract the value
        if (cell.type === "null") {
          obj[cols[i]] = null;
        } else if (cell.type === "integer") {
          obj[cols[i]] = parseInt(cell.value, 10);
        } else if (cell.type === "float") {
          obj[cols[i]] = parseFloat(cell.value);
        } else {
          obj[cols[i]] = cell.value;
        }
      });
      return obj;
    });
  },

  /**
   * Execute a single SQL statement against Turso
   * @param {string} sql - SQL statement
   * @param {Array} args - Parameterized arguments
   * @returns {Promise<{ rows: Array, rowsAffected: number, lastInsertRowid: number|null }>}
   */
  async execute(sql, args = []) {
    const creds = this.getCredentials();
    if (!creds) throw new Error("Database not configured. Please set up Turso credentials.");

    const typedArgs = args.map((a) => this._toArg(a));

    const response = await fetch(`${creds.url}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          { type: "execute", stmt: { sql, args: typedArgs } },
          { type: "close" },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) throw new Error("Invalid Turso credentials. Please reconfigure.");
      throw new Error(`Database error (${response.status}): ${text}`);
    }

    const data = await response.json();

    // Check for statement-level errors
    const stmtResult = data.results?.[0];
    if (stmtResult?.type === "error") {
      throw new Error(`SQL error: ${stmtResult.error?.message || "Unknown error"}`);
    }

    const result = stmtResult?.response?.result;
    return {
      rows: this._parseRows(result),
      rowsAffected: result?.affected_row_count || 0,
      lastInsertRowid: result?.last_insert_rowid ? parseInt(result.last_insert_rowid, 10) : null,
    };
  },

  /**
   * Query rows (convenience wrapper)
   * @param {string} sql
   * @param {Array} args
   * @returns {Promise<Array>}
   */
  async query(sql, args = []) {
    const result = await this.execute(sql, args);
    return result.rows;
  },

  /**
   * Execute multiple statements in a single pipeline request
   * @param {Array<{ sql: string, args: Array }>} statements
   * @returns {Promise<Array>}
   */
  async batch(statements) {
    const creds = this.getCredentials();
    if (!creds) throw new Error("Database not configured.");

    const requests = statements.map((stmt) => ({
      type: "execute",
      stmt: {
        sql: stmt.sql,
        args: (stmt.args || []).map((a) => this._toArg(a)),
      },
    }));
    requests.push({ type: "close" });

    const response = await fetch(`${creds.url}/v2/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Batch error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.results
      .filter((r) => r.type === "ok" && r.response?.type === "execute")
      .map((r) => ({
        rows: this._parseRows(r.response.result),
        rowsAffected: r.response.result?.affected_row_count || 0,
        lastInsertRowid: r.response.result?.last_insert_rowid
          ? parseInt(r.response.result.last_insert_rowid, 10)
          : null,
      }));
  },

  /**
   * Test the database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  },
};
