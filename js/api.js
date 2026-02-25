/**
 * Application API layer.
 * All data operations go through TursoDB (Turso HTTP API) directly from the browser.
 * No server-side proxy needed.
 */

const API = {
  /* ─── Content ────────────────────────────────────────── */

  /**
   * Get the full content tree as a flat list.
   * @param {string} mode - "structure" or "with-language"
   * @param {string|null} languageCode - Language code (for mode=with-language)
   */
  async getTree(mode = "structure", languageCode = null) {
    let rows;
    if (mode === "with-language" && languageCode) {
      rows = await TursoDB.query(
        `SELECT c.*,
                ct.language_code, ct.title, ct.transliteration,
                ct.translation, ct.original_text, ct.search_text,
                ct.updated_at as translation_updated_at
         FROM content c
         LEFT JOIN content_translation ct
           ON c.id = ct.content_id AND ct.language_code = ?
         WHERE c.is_deleted = 0
         ORDER BY c.parent_id, c.sequence`,
        [languageCode]
      );
    } else {
      rows = await TursoDB.query(
        "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
      );
    }
    return { rows, count: rows.length };
  },

  /**
   * Get immediate children of a parent (with child count).
   */
  async getChildren(parentId = null) {
    let rows;
    if (!parentId) {
      rows = await TursoDB.query(
        `SELECT c.*, COUNT(ch.id) as child_count
         FROM content c
         LEFT JOIN content ch ON ch.parent_id = c.id AND ch.is_deleted = 0
         WHERE c.parent_id IS NULL AND c.is_deleted = 0
         GROUP BY c.id ORDER BY c.sequence`
      );
    } else {
      rows = await TursoDB.query(
        `SELECT c.*, COUNT(ch.id) as child_count
         FROM content c
         LEFT JOIN content ch ON ch.parent_id = c.id AND ch.is_deleted = 0
         WHERE c.parent_id = ? AND c.is_deleted = 0
         GROUP BY c.id ORDER BY c.sequence`,
        [Number(parentId)]
      );
    }
    return {
      rows: rows.map((r) => ({ ...r, has_children: (r.child_count || 0) > 0 })),
      count: rows.length,
    };
  },

  /**
   * Create a new content node.
   */
  async createContent({ parent_id, type }) {
    if (!type || !type.trim()) throw new Error("Content type is required.");

    // Auto-sequence: max(sequence) + 1 among siblings
    const siblings = await TursoDB.query(
      parent_id
        ? "SELECT MAX(sequence) as max_seq FROM content WHERE parent_id = ? AND is_deleted = 0"
        : "SELECT MAX(sequence) as max_seq FROM content WHERE parent_id IS NULL AND is_deleted = 0",
      parent_id ? [parent_id] : []
    );
    const seq = (siblings[0]?.max_seq ?? -1) + 1;

    const result = await TursoDB.execute(
      `INSERT INTO content (parent_id, type, sequence, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))`,
      [parent_id || null, type.trim(), seq]
    );

    const newId = result.lastInsertRowid;
    const rows = await TursoDB.query("SELECT * FROM content WHERE id = ?", [newId]);
    return { success: true, id: newId, row: rows[0] || null };
  },

  /**
   * Update a content node's fields.
   */
  async updateContent({ id, parent_id, type, sequence, audio_url, video_url, css, duas_url }) {
    if (!id) throw new Error("Content ID is required.");

    const existing = await TursoDB.query(
      "SELECT * FROM content WHERE id = ? AND is_deleted = 0", [id]
    );
    if (existing.length === 0) throw new Error("Content not found.");

    if (parent_id !== undefined && parent_id !== null && Number(parent_id) === Number(id)) {
      throw new Error("Content cannot be its own parent.");
    }

    const updates = [];
    const args = [];
    const add = (name, val) => {
      if (val !== undefined) { updates.push(`${name} = ?`); args.push(val); }
    };
    add("parent_id", parent_id);
    add("type", type);
    add("sequence", sequence);
    add("audio_url", audio_url);
    add("video_url", video_url);
    add("css", css);
    add("duas_url", duas_url);

    if (updates.length === 0) throw new Error("No fields to update.");
    updates.push("updated_at = datetime('now')");
    args.push(id);

    await TursoDB.execute(`UPDATE content SET ${updates.join(", ")} WHERE id = ?`, args);
    const rows = await TursoDB.query("SELECT * FROM content WHERE id = ?", [id]);
    return { success: true, row: rows[0] || null };
  },

  /**
   * Soft-delete a content node and all its descendants.
   */
  async deleteContent(id) {
    if (!id) throw new Error("Content ID is required.");

    const existing = await TursoDB.query(
      "SELECT * FROM content WHERE id = ? AND is_deleted = 0", [id]
    );
    if (existing.length === 0) throw new Error("Content not found.");

    // Collect all descendant IDs
    const allIds = [Number(id)];
    const collectChildren = async (parentId) => {
      const children = await TursoDB.query(
        "SELECT id FROM content WHERE parent_id = ? AND is_deleted = 0", [parentId]
      );
      for (const child of children) {
        allIds.push(child.id);
        await collectChildren(child.id);
      }
    };
    await collectChildren(Number(id));

    for (const nodeId of allIds) {
      await TursoDB.execute(
        "UPDATE content SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?", [nodeId]
      );
    }
    return { success: true, deleted_count: allIds.length, deleted_ids: allIds };
  },

  /**
   * Reorder children under a parent.
   */
  async reorderContent(parentId, orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new Error("ordered_ids is required.");
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await TursoDB.execute(
        "UPDATE content SET sequence = ?, updated_at = datetime('now') WHERE id = ?",
        [i, orderedIds[i]]
      );
    }
    return { success: true };
  },

  /* ─── Translations ──────────────────────────────────── */

  async getTranslations(contentId) {
    if (!contentId) throw new Error("content_id is required.");
    const rows = await TursoDB.query(
      "SELECT * FROM content_translation WHERE content_id = ? ORDER BY language_code",
      [contentId]
    );
    const byLanguage = {};
    for (const row of rows) byLanguage[row.language_code] = row;
    return { translations: byLanguage, rows, count: rows.length };
  },

  async saveTranslation({ content_id, language_code, title, transliteration, translation, original_text, search_text }) {
    if (!content_id) throw new Error("content_id is required.");
    if (!language_code) throw new Error("language_code is required.");

    await TursoDB.execute(
      `INSERT INTO content_translation
       (content_id, language_code, title, transliteration, translation, original_text, search_text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(content_id, language_code)
       DO UPDATE SET title=excluded.title, transliteration=excluded.transliteration,
         translation=excluded.translation, original_text=excluded.original_text,
         search_text=excluded.search_text, updated_at=datetime('now')`,
      [content_id, language_code.trim(), title || "", transliteration || "",
       translation || "", original_text || "", search_text || ""]
    );
    return { success: true };
  },

  /* ─── Versions ──────────────────────────────────────── */

  async getVersions() {
    const rows = await TursoDB.query("SELECT * FROM versions ORDER BY created_at DESC");
    return { versions: rows, count: rows.length };
  },

  /**
   * Export: generate SQL dump client-side, record version, trigger download.
   */
  async exportDb(versionNumber, notes = "") {
    if (!versionNumber) throw new Error("version_number is required.");

    const dup = await TursoDB.query("SELECT id FROM versions WHERE version_number = ?", [versionNumber]);
    if (dup.length > 0) throw new Error(`Version ${versionNumber} already exists.`);

    const contentRows = await TursoDB.query(
      "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
    );
    const contentIds = contentRows.map((r) => r.id);
    let translationRows = [];
    for (let i = 0; i < contentIds.length; i += 200) {
      const chunk = contentIds.slice(i, i + 200);
      const ph = chunk.map(() => "?").join(",");
      const rows = await TursoDB.query(
        `SELECT * FROM content_translation WHERE content_id IN (${ph})`, chunk
      );
      translationRows = translationRows.concat(rows);
    }

    const esc = (v) => v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
    let sql = `-- Content Admin Export v${versionNumber}\n-- ${new Date().toISOString()}\n`;
    sql += `-- Content: ${contentRows.length} | Translations: ${translationRows.length}\n\n`;
    sql += "CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, parent_id INTEGER, type TEXT, sequence INTEGER DEFAULT 0, audio_url TEXT, video_url TEXT, css TEXT, duas_url TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);\n";
    sql += "CREATE TABLE IF NOT EXISTS content_translation (id INTEGER PRIMARY KEY AUTOINCREMENT, content_id INTEGER NOT NULL, language_code TEXT NOT NULL, title TEXT DEFAULT '', transliteration TEXT DEFAULT '', translation TEXT DEFAULT '', original_text TEXT DEFAULT '', search_text TEXT DEFAULT '', updated_at TEXT, UNIQUE(content_id, language_code));\n\n";
    sql += "BEGIN TRANSACTION;\n";
    for (const r of contentRows) {
      sql += `INSERT INTO content VALUES (${esc(r.id)},${esc(r.parent_id)},${esc(r.type)},${esc(r.sequence)},${esc(r.audio_url)},${esc(r.video_url)},${esc(r.css)},${esc(r.duas_url)},0,${esc(r.created_at)},${esc(r.updated_at)});\n`;
    }
    for (const r of translationRows) {
      sql += `INSERT INTO content_translation (content_id,language_code,title,transliteration,translation,original_text,search_text,updated_at) VALUES (${esc(r.content_id)},${esc(r.language_code)},${esc(r.title)},${esc(r.transliteration)},${esc(r.translation)},${esc(r.original_text)},${esc(r.search_text)},${esc(r.updated_at)});\n`;
    }
    sql += "COMMIT;\n";

    await TursoDB.execute(
      `INSERT INTO versions (version_number, notes, file_url, content_count, translation_count, created_at) VALUES (?, ?, '', ?, ?, datetime('now'))`,
      [versionNumber, notes, contentRows.length, translationRows.length]
    );

    // Trigger download
    const blob = new Blob([sql], { type: "application/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-export-v${versionNumber}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { success: true };
  },

  /**
   * Re-download an existing version (regenerated from current DB state).
   */
  async reDownloadVersion(versionNumber) {
    const contentRows = await TursoDB.query(
      "SELECT * FROM content WHERE is_deleted = 0 ORDER BY parent_id, sequence"
    );
    let translationRows = [];
    const ids = contentRows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const rows = await TursoDB.query(
        `SELECT * FROM content_translation WHERE content_id IN (${chunk.map(() => "?").join(",")})`, chunk
      );
      translationRows = translationRows.concat(rows);
    }
    const esc = (v) => v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
    let sql = `-- Re-export v${versionNumber} | ${new Date().toISOString()}\n`;
    sql += "CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, parent_id INTEGER, type TEXT, sequence INTEGER DEFAULT 0, audio_url TEXT, video_url TEXT, css TEXT, duas_url TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);\n";
    sql += "CREATE TABLE IF NOT EXISTS content_translation (id INTEGER PRIMARY KEY AUTOINCREMENT, content_id INTEGER NOT NULL, language_code TEXT NOT NULL, title TEXT DEFAULT '', transliteration TEXT DEFAULT '', translation TEXT DEFAULT '', original_text TEXT DEFAULT '', search_text TEXT DEFAULT '', updated_at TEXT, UNIQUE(content_id, language_code));\nBEGIN TRANSACTION;\n";
    for (const r of contentRows) sql += `INSERT INTO content VALUES (${esc(r.id)},${esc(r.parent_id)},${esc(r.type)},${esc(r.sequence)},${esc(r.audio_url)},${esc(r.video_url)},${esc(r.css)},${esc(r.duas_url)},0,${esc(r.created_at)},${esc(r.updated_at)});\n`;
    for (const r of translationRows) sql += `INSERT INTO content_translation (content_id,language_code,title,transliteration,translation,original_text,search_text,updated_at) VALUES (${esc(r.content_id)},${esc(r.language_code)},${esc(r.title)},${esc(r.transliteration)},${esc(r.translation)},${esc(r.original_text)},${esc(r.search_text)},${esc(r.updated_at)});\n`;
    sql += "COMMIT;\n";
    const blob = new Blob([sql], { type: "application/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-export-v${versionNumber}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /* ─── Stats ─────────────────────────────────────────── */

  async getStats() {
    const [contentCount] = await TursoDB.query("SELECT COUNT(*) as count FROM content WHERE is_deleted = 0");
    const [translationCount] = await TursoDB.query("SELECT COUNT(*) as count FROM content_translation");
    const [versionCount] = await TursoDB.query("SELECT COUNT(*) as count FROM versions");
    const [rootCount] = await TursoDB.query("SELECT COUNT(*) as count FROM content WHERE parent_id IS NULL AND is_deleted = 0");
    const typeBreakdown = await TursoDB.query("SELECT type, COUNT(*) as count FROM content WHERE is_deleted = 0 GROUP BY type ORDER BY count DESC");
    const languages = await TursoDB.query("SELECT language_code, COUNT(*) as count FROM content_translation GROUP BY language_code ORDER BY count DESC");
    const latestVersion = await TursoDB.query("SELECT * FROM versions ORDER BY created_at DESC LIMIT 1");
    return {
      content_count: contentCount?.count || 0,
      translation_count: translationCount?.count || 0,
      version_count: versionCount?.count || 0,
      root_count: rootCount?.count || 0,
      type_breakdown: typeBreakdown,
      languages,
      latest_version: latestVersion[0] || null,
    };
  },
};
