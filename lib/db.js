/**
 * Database client wrapper for Turso (libSQL)
 * Provides query/execute helpers with retry logic for transient failures.
 */
import { createClient } from "@libsql/client";

// Singleton client — reused across serverless invocations within the same container
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is transient and worth retrying
 */
function isTransient(err) {
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("unavailable") ||
    msg.includes("busy")
  );
}

/**
 * Execute a SQL statement (INSERT/UPDATE/DELETE) with retry.
 * @param {string} sql - SQL statement
 * @param {Array} args - Parameterized arguments
 * @returns {Promise<object>} - Execution result ({ rowsAffected, lastInsertRowid })
 */
export async function execute(sql, args = []) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await client.execute({ sql, args });
      return result;
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === MAX_RETRIES - 1) break;
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

/**
 * Query rows from the database with retry.
 * @param {string} sql - SELECT statement
 * @param {Array} args - Parameterized arguments
 * @returns {Promise<Array>} - Array of row objects
 */
export async function query(sql, args = []) {
  const result = await execute(sql, args);
  return result.rows;
}

/**
 * Execute multiple statements in a batch/transaction.
 * @param {Array<{sql: string, args: Array}>} statements
 * @returns {Promise<Array>} - Array of results
 */
export async function batch(statements) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await client.batch(statements, "write");
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === MAX_RETRIES - 1) break;
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// Legacy export for backward compatibility
export const db = client;
