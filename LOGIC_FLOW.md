# LOGIC_FLOW.md — Architecture & Data Flow

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Vercel (Hosting)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ public/       │  │ api/         │  │ lib/          │  │
│  │ ├ index.html  │  │ ├ login      │  │ ├ db.js       │  │
│  │ ├ dashboard   │  │ ├ register   │  │ └ auth.js     │  │
│  │ ├ editor      │  │ ├ content-*  │  │               │  │
│  │ ├ preview     │  │ ├ translation│  │               │  │
│  │ ├ css/        │  │ ├ versions-* │  │               │  │
│  │ └ js/         │  │ ├ export-db  │  │               │  │
│  │               │  │ └ stats      │  │               │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│          │                 │                  │           │
│          │    HTTP/JSON    │    SQL (libSQL)   │           │
│          └────────────────>│─────────────────>│           │
└──────────────────────────────┼────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │   Turso (DB)     │
                    │  ├ users         │
                    │  ├ content       │
                    │  ├ content_trans │
                    │  └ versions      │
                    └──────────────────┘
```

## Database Schema

### users
| Column        | Type    | Notes                     |
|--------------|---------|---------------------------|
| id           | INTEGER | PK, auto-increment        |
| email        | TEXT    | UNIQUE                    |
| password_hash| TEXT    | bcrypt hashed             |
| role         | TEXT    | 'admin' or 'editor'       |

### content
| Column     | Type    | Notes                         |
|-----------|---------|-------------------------------|
| id        | INTEGER | PK, auto-increment            |
| parent_id | INTEGER | FK → content.id (nullable)    |
| type      | TEXT    | 'category','content','section','item' |
| sequence  | INTEGER | Display order within siblings |
| audio_url | TEXT    | Optional media URL            |
| video_url | TEXT    | Optional media URL            |
| css       | TEXT    | Optional custom styling       |
| duas_url  | TEXT    | Optional link                 |
| is_deleted| INTEGER | 0 = active, 1 = soft-deleted  |
| created_at| TEXT    | Timestamp                     |
| updated_at| TEXT    | Timestamp                     |

### content_translation
| Column          | Type    | Notes                          |
|----------------|---------|--------------------------------|
| id             | INTEGER | PK, auto-increment             |
| content_id     | INTEGER | FK → content.id                |
| language_code  | TEXT    | 'en','gu','ar','ur'            |
| title          | TEXT    | Display title                  |
| transliteration| TEXT    | Phonetic transliteration       |
| translation    | TEXT    | Translated text                |
| original_text  | TEXT    | Source language text            |
| search_text    | TEXT    | Keywords for search            |
| updated_at     | TEXT    | Timestamp                      |
| UNIQUE(content_id, language_code)                             |

### versions
| Column           | Type    | Notes                    |
|-----------------|---------|--------------------------|
| id              | INTEGER | PK, auto-increment       |
| version_number  | TEXT    | e.g., '1.0', '2.0'      |
| notes           | TEXT    | Release notes            |
| file_url        | TEXT    | Download URL (if stored) |
| content_count   | INTEGER | Items exported           |
| translation_count| INTEGER| Translations exported    |
| created_at      | TEXT    | Timestamp                |

## Authentication Flow

```
1. User → POST /api/login { email, password }
2. Server → bcrypt.compare(password, hash)
3. Server → jwt.sign({ id, email, role }, SECRET, { expiresIn: '12h' })
4. Server → { token, user: { id, email, role } }
5. Client → localStorage.setItem('token', token)
6. Client → All requests include: Authorization: Bearer <token>
7. Server → jwt.verify(token, SECRET) on every protected endpoint
8. On 401 → Client auto-redirects to login page
```

## Content Tree Flow

```
1. Editor loads → GET /api/content-tree
2. API returns flat list sorted by parent_id, sequence
3. Frontend builds tree structure:
   - Root nodes: parent_id IS NULL
   - Children: filter by parent_id, sort by sequence
4. Tree supports:
   - Expand/collapse (tracked in expandedNodes Set)
   - Search/filter (matches label, type, or ID)
   - Drag-and-drop reorder (POST /api/content-reorder)
   - Add child (POST /api/content-create)
   - Delete (POST /api/content-delete — soft delete with cascade)
```

## Editor Tab Flow

```
Structure Tab:
  - Displays: type, parent, sequence, media URLs, CSS
  - Save → POST /api/content-update

Language Tabs (EN, GU, AR, UR):
  - On select → GET /api/translations-get?content_id=X
  - Populates: title, original_text, translation, transliteration, search_text
  - Save → POST /api/translation-save (upsert via ON CONFLICT)
```

## Export Flow

```
1. Admin clicks Export → Modal with version number + notes
2. POST /api/export-db { version_number, notes }
3. Server:
   a. Query all content WHERE is_deleted = 0
   b. Query all translations for those content IDs (chunked)
   c. Generate SQL dump (CREATE TABLE + INSERT statements)
   d. Insert version record into versions table
   e. Stream SQL file as download response
4. Version appears in dashboard versions list
```

## File Organization

```
content-admin/
├── api/                    # Serverless API endpoints (one function per file)
│   ├── content-children.js #   GET  — lazy load children
│   ├── content-create.js   #   POST — create content node
│   ├── content-delete.js   #   POST — soft delete with cascade
│   ├── content-reorder.js  #   POST — reorder siblings
│   ├── content-tree.js     #   GET  — full tree (with optional translations)
│   ├── content-update.js   #   POST — update content fields
│   ├── export-db.js        #   POST — generate SQL export (admin only)
│   ├── login.js            #   POST — authenticate user
│   ├── register.js         #   POST — create admin account (guarded)
│   ├── stats.js            #   GET  — dashboard statistics
│   ├── translation-save.js #   POST — upsert translation
│   ├── translations-get.js #   GET  — get translations for content
│   ├── versions-download.js#   GET  — download version file
│   └── versions-list.js    #   GET  — list all versions
├── lib/                    # Shared server utilities
│   ├── auth.js             #   JWT sign/verify, requireAuth, requireRole, CORS
│   └── db.js               #   Turso client, query/execute with retry
├── public/                 # Static frontend
│   ├── css/
│   │   └── styles.css      #   Custom design system (Bootstrap 5 extensions)
│   ├── js/
│   │   ├── api.js          #   API client with auth headers and error handling
│   │   └── utils.js        #   Toast, Loading, confirmAction, formatDate
│   ├── index.html          #   Login page
│   ├── dashboard.html      #   Stats, quick actions, versions
│   ├── editor.html         #   Tree sidebar + tabbed editor
│   └── preview.html        #   Mobile phone-frame content preview
├── package.json            #   Dependencies and config
├── vercel.json             #   Vercel routing
├── COMPLETED.md            #   Implementation tracker
└── LOGIC_FLOW.md           #   This file
```

## Key Design Decisions

1. **Flat list + client-side tree**: API returns flat sorted list. Frontend assembles
   tree. This avoids recursive SQL and supports any nesting depth.

2. **Soft-delete cascade**: Deleting a node marks it and all descendants as
   is_deleted=1. Exports and tree views filter on is_deleted=0.

3. **SQL dump over binary SQLite**: Export generates SQL text instead of binary
   .sqlite file to avoid native sqlite3 dependency issues on Vercel serverless.

4. **ON CONFLICT upsert**: Translation saves use INSERT ... ON CONFLICT to handle
   both create and update in a single idempotent operation.

5. **No build step**: Pure HTML/CSS/JS frontend with CDN dependencies. Zero build
   configuration needed — deploy directly to Vercel.

6. **Token in localStorage**: Simple auth model suitable for admin tools. Token
   auto-expires after 12h. Client checks expiry on page load.
