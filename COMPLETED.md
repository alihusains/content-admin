# COMPLETED.md — Implementation Tracker

## Status: All Core Features Implemented

### Backend — Library Helpers
- [x] `lib/db.js` — Turso client wrapper with retry/backoff, query(), execute(), batch()
- [x] `lib/auth.js` — signToken, verifyToken, requireAuth, requireRole, CORS helpers

### Backend — API Endpoints
- [x] `api/register.js` — POST, guarded registration (ALLOW_INITIAL_REGISTER env var)
- [x] `api/login.js` — POST, email/password auth, returns JWT + user info
- [x] `api/content-create.js` — POST, creates content node, auto-sequence
- [x] `api/content-update.js` — POST, updates content fields, validates parent references
- [x] `api/content-delete.js` — POST, soft-deletes with recursive children
- [x] `api/content-tree.js` — GET, returns flat list, supports mode=with-language
- [x] `api/content-children.js` — GET, lazy-load children with has_children indicator
- [x] `api/content-reorder.js` — POST, reorders siblings by updating sequence
- [x] `api/translation-save.js` — POST, upsert translation (ON CONFLICT)
- [x] `api/translations-get.js` — GET, returns translations for a content node by language
- [x] `api/versions-list.js` — GET, lists all versions ordered by created_at DESC
- [x] `api/versions-download.js` — GET, redirects to version file URL
- [x] `api/export-db.js` — POST, admin-only, generates SQL dump, records version
- [x] `api/stats.js` — GET, dashboard statistics (counts, breakdowns, languages)

### Frontend — Infrastructure
- [x] `public/css/styles.css` — Full custom design system (CSS variables, components, responsive)
- [x] `public/js/api.js` — API client wrapper with auth, error handling, auto-logout
- [x] `public/js/utils.js` — Toast notifications, Loading states, confirm dialogs, date formatting

### Frontend — Pages
- [x] `public/index.html` — Login page with validation, password toggle, loading states
- [x] `public/dashboard.html` — Stats cards, quick actions, version history, export modal
- [x] `public/editor.html` — Full tree sidebar, tabbed editor (structure + 4 languages), drag-drop, search
- [x] `public/preview.html` — Mobile phone-frame preview, RTL support, navigation, language switcher

### Configuration
- [x] `vercel.json` — Routing configuration for API, static assets, and pages
- [x] `package.json` — ES module, production dependencies only

### Security
- [x] JWT-based authentication with 12h expiry
- [x] bcrypt password hashing (10 rounds)
- [x] Role-based access control (admin/editor)
- [x] Registration guarded by environment variable
- [x] CORS headers on all API routes
- [x] Input validation on all endpoints
- [x] Parameterized queries (SQL injection prevention)

### UX Features
- [x] Editors never see or input IDs — parent selection via dropdown
- [x] Auto-sequence on content creation
- [x] Drag-and-drop reorder in tree
- [x] Ctrl+S keyboard shortcut for save
- [x] Tree search/filter
- [x] Breadcrumb navigation in editor
- [x] Toast notifications for all operations
- [x] Confirmation dialogs for destructive actions
- [x] Loading spinners on buttons during API calls
- [x] Soft-delete with cascade to children
- [x] Mobile-responsive layout
- [x] RTL text support for Arabic and Urdu
