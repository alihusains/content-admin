# vercel-plan.md

Project: Content Admin — Vercel Production Plan
Owner: Claude (implementation)
Prepared for: Ali Husain Sorathiya

Overview
--------
Objective: Convert the starter template deployed on Vercel into a production-ready admin panel for a Flutter app. The admin must implement authentication, role-based access, infinite nesting content management, multilingual translations, preview, safe soft-deletes, versioned SQLite export, and non-technical editor workflows (auto-mapped IDs, preview, CRUD). Exports will be produced by server-side logic but long-running scheduled/manual exports will be delegated to GitHub Actions for reliability.

Deliverables (Vercel)
---------------------
1. Completed serverless API endpoints (Node.js, /api):
   - register.js (one-time, guarded)
   - login.js
   - content-create.js
   - content-update.js
   - content-delete.js (soft delete)
   - content-tree.js
   - content-children.js (lazy load)
   - content-reorder.js
   - translation-save.js
   - versions-list.js
   - versions-download.js
   - export-db.js (admin-triggered, immediate upload/stream)
2. Lib helpers:
   - lib/db.js — Turso client wrapper (query/execute helpers, retry)
   - lib/auth.js — JWT utilities, requireAuth, requireRole
3. Frontend (public/):
   - index.html (login)
   - dashboard.html (buttons & versions)
   - editor.html (editor layout with tree + tabs and preview)
   - preview.html (WYSIWYG preview)
   - public/js/*, public/css/* (Bootstrap 5 + jQuery + small helpers)
4. Configuration:
   - package.json (type: module, dependencies)
   - vercel.json ({ "version": 2 })
   - README.md and ADMIN_QUICKSTART.md (editor instructions)
5. Tests: simple smoke test scripts for key APIs (local or serverless invocation).

Environment & Secrets
---------------------
Vercel Environment Variables (Project Settings):
- TURSO_DATABASE_URL — Turso connection URL
- TURSO_AUTH_TOKEN — Turso auth token
- JWT_SECRET — strong secret for signing JWTs
- OPTIONAL: GITHUB_TOKEN — if you want serverless exports to create releases (not required; Actions handles releases)

Ensure Vercel project has these configured prior to deployment.

API Design & Behavior (detailed)
-------------------------------

lib/db.js
- createClient(@libsql/client) using TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.
- Exports:
  - async query(sql, args) → returns rows array
  - async execute(sql, args) → returns execution result
- Behavior:
  - Parameterized queries only (args array)
  - Simple retry/backoff on transient failures

lib/auth.js
- signToken(payload) → jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
- verifyTokenFromHeader(req) → returns decoded token or null
- requireAuth(req, res) → if invalid -> res.status(401).json({ error })
- requireRole(req, res, roles[]) → if role not allowed -> res.status(403)

API Endpoints
- register.js (POST)
  - Input: { email, password }
  - Guards: Only enabled if env ALLOW_INITIAL_REGISTER=true OR run manually.
  - Action: Hash & insert user with role 'admin'
  - Post-condition: Recommend delete endpoint or set ALLOW_INITIAL_REGISTER=false

- login.js (POST)
  - Input: { email, password }
  - Action: Verify credentials, return { token }

- content-create.js (POST)
  - Auth: requireAuth
  - Input: { parent_id (nullable), type, sequence }
  - Action: Insert into content; return { id, row }

- content-update.js (POST)
  - Auth: requireAuth
  - Input: { id, parent_id, type, sequence, audio_url, video_url, css, duas_url }
  - Action: Update content, set updated_at

- content-delete.js (POST)
  - Auth: requireAuth
  - Input: { id }
  - Action: set is_deleted = 1, updated_at = CURRENT_TIMESTAMP

- content-tree.js (GET)
  - Auth: requireAuth
  - Query params:
    - mode=structure (default)
    - mode=with-language & language_code=xx -> joins content_translation for that language
  - Action: return flat list sorted by parent_id, sequence; frontend assembles tree

- content-children.js (GET)
  - Auth: requireAuth
  - Input: parent_id
  - Action: return immediate children of parent_id (is_deleted = 0, ordered by sequence)

- content-reorder.js (POST)
  - Auth: requireAuth
  - Input: { parent_id, ordered_ids:[id...] }
  - Action: update sequence values in a controlled loop/transaction

- translation-save.js (POST)
  - Auth: requireAuth
  - Input: { content_id, language_code, title, transliteration, translation, original_text, search_text }
  - Action: INSERT ... ON CONFLICT(content_id, language_code) DO UPDATE ... ; set updated_at

- versions-list.js (GET)
  - Auth: requireAuth
  - Action: return versions from versions table ordered by created_at desc

- versions-download.js (GET)
  - Auth: requireAuth
  - Input: version id
  - Action: return file_url or stream asset (if available via ephemeral store)

- export-db.js (POST)
  - Auth: requireRole(admin)
  - Input: { version_number, notes }
  - Action:
    1. Query all content rows where is_deleted = 0.
    2. Query all content_translation rows for those content ids.
    3. Create temporary SQLite file (node sqlite3) in /tmp (or workspace).
    4. Create content and content_translation tables and batch-insert rows in transactions.
    5. Upload file to a persistent host:
       - Preferred: Trigger GitHub Actions to produce release (recommended)
       - Alternative: Use server-side upload via GITHUB_TOKEN to create a release (if allowed)
       - Fallback: Stream file to HTTP response for immediate download
    6. Insert record to versions table with file_url and metadata.
  - Notes:
    - Chunk inserts for large datasets.
    - Use short-term lock (store in versions table with in_progress flag or simple in-memory lock) to avoid parallel exports.

Frontend (public)
-----------------
- index.html
  - Login form, posts to /api/login, stores token in localStorage, redirects to /dashboard.html

- dashboard.html
  - Buttons: Add Category, Add Content, Manage Languages, Preview, Generate Version, View Versions
  - Versions list fetches /api/versions-list and shows downloads

- editor.html
  - Layout: left tree pane, right editor pane
  - Tree:
    - Built from /api/content-tree (or lazy load via /api/content-children)
    - Expand/collapse; drag-and-drop for reorder (use small DND helper)
  - Right pane:
    - Tabs: Structure + configured languages (EN, GU, AR, UR default)
    - Structure tab: parent picker, type, audio/video URLs, css, duas_url, sequence
    - Language tabs: Title, Transliteration, Translation, Original Text, Search Text
    - Save buttons per area; preview button to open preview.html?content_id=..&lang=en
  - Behavior:
    - All API requests include Authorization: Bearer <token>
    - Toast notifications for success and errors

Preview (preview.html)
- Renders selected content_id using selected language by calling content-tree with language filter or content-specific API
- Matches Flutter render (basic HTML, right-to-left handling for Arabic)

UX & non-technical requirements
-------------------------------
- Editors never see or input IDs: parent selection via dropdown/tree picker.
- Auto-mapping: when creating content, API returns new id and frontend inserts node into tree automatically.
- Validation and helpful messages for editors.
- Soft-delete only; versions preserved and export ignores deleted items.
- Preview shows actual formatting and media URLs (audio/video fields are links).

Performance & scale considerations
---------------------------------
- Use content-children lazy-loading for nodes to avoid fetching 20k+ items at once.
- Indexes required on Turso (already created):
  - idx_content_parent, idx_content_sequence, unique_translation, idx_translation_lookup
- For translations, always query single language when rendering app.
- Export scripts must use batching/chunking when inserting into local SQLite.

Security
--------
- Hash passwords with bcrypt (10 salt rounds).
- JWT tokens with reasonable TTL (12h recommended).
- Store JWT in localStorage (or better, secure cookie if you evolve stack).
- Limit register.js usage: either remove after first admin or gate with env var.
- Do not expose TURSO credentials; use Vercel secrets.
- Use role checks (admin vs editor) for privileged operations (export, version delete, manage languages).

Testing & QA
-----------
- Smoke tests for each API endpoint (use node scripts or Postman):
  - register -> login -> content-create -> translation-save -> content-tree -> export
- Manual UI test flows: create nested content, add translations, reorder, preview, generate version.
- Export verification: open database.sqlite locally and validate content and content_translation tables match Turso data.

Deployment checklist (Vercel)
----------------------------
1. Set Vercel env vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, ALLOW_INITIAL_REGISTER (optional).
2. Ensure vercel.json is { "version": 2 }.
3. Ensure package.json has "type": "module".
4. Commit & push to GitHub.
5. Import / redeploy on Vercel.
6. Run /api/register once (if enabled) to create admin; delete/register disabled afterward.
7. Login and confirm UI and APIs behave as expected.

Handoff docs
------------
- ADMIN_QUICKSTART.md: short non-technical instructions for editors.
- DEV_RUNBOOK.md: how to run locally, env variables, how to create initial admin, how to export manually.

Acceptance criteria
-------------------
- Admin UI allows non-technical editors to CRUD content and translations without touching IDs.
- Preview accurately renders multilingual content.
- Export endpoint produces valid SQLite for Flutter and records versions in Turso.
- Vercel deployment is stable and secure.

Estimated effort
----------------
- Development: 2–5 days for one developer to implement and test the Vercel plan (depending on UI polishing and testing).