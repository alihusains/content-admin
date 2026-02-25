# LOGIC_FLOW.md — Architecture & Data Flow

## System Overview

```
┌─────────────────────────────────────────────┐
│         GitHub Pages (Static Hosting)        │
│  ┌────────────┐  ┌───────────────────────┐  │
│  │  HTML Pages │  │  JavaScript Modules   │  │
│  │  ├ index    │  │  ├ db.js    (Turso)   │  │
│  │  ├ dashboard│  │  ├ auth.js  (Session) │  │
│  │  ├ editor   │  │  ├ api.js   (Data)    │  │
│  │  └ preview  │  │  └ utils.js (UI)      │  │
│  └────────────┘  └───────────┬────────────┘  │
│                              │               │
│                     fetch() to Turso         │
└──────────────────────────────┼───────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Turso HTTP API   │
                    │  /v2/pipeline     │
                    │  ├ users          │
                    │  ├ content        │
                    │  ├ content_trans  │
                    │  └ versions       │
                    └──────────────────┘
```

**Key difference from Vercel version:** Everything runs in the browser.
No serverless functions, no Node.js, no npm dependencies.

## Database Schema

### users
| Column        | Type    | Notes              |
|--------------|---------|--------------------|
| id           | INTEGER | PK, auto-increment |
| email        | TEXT    | UNIQUE             |
| password_hash| TEXT    | bcrypt hashed      |
| role         | TEXT    | 'admin' or 'editor'|

### content
| Column     | Type    | Notes                      |
|-----------|---------|----------------------------|
| id        | INTEGER | PK, auto-increment         |
| parent_id | INTEGER | FK → content.id (nullable) |
| type      | TEXT    | category/content/section/item |
| sequence  | INTEGER | Sort order within siblings |
| audio_url | TEXT    | Optional                   |
| video_url | TEXT    | Optional                   |
| css       | TEXT    | Optional custom styling    |
| duas_url  | TEXT    | Optional link              |
| is_deleted| INTEGER | 0=active, 1=soft-deleted   |

### content_translation
| Column          | Type    | Notes                |
|----------------|---------|----------------------|
| content_id     | INTEGER | FK → content.id      |
| language_code  | TEXT    | en/gu/ar/ur          |
| title          | TEXT    | Display title        |
| transliteration| TEXT    | Phonetic             |
| translation    | TEXT    | Translated text      |
| original_text  | TEXT    | Source text           |
| search_text    | TEXT    | Search keywords      |
| UNIQUE(content_id, language_code)              |

### versions
| Column           | Type    | Notes           |
|-----------------|---------|-----------------|
| version_number  | TEXT    | e.g., '1.0'    |
| notes           | TEXT    | Release notes   |
| content_count   | INTEGER | Items exported  |
| translation_count| INTEGER| Translations    |

## Authentication Flow

```
1. First visit → Setup: user enters Turso URL + auth token
2. Credentials stored in localStorage
3. Test connection: SELECT 1 via Turso HTTP API
4. Login: user enters email + password
5. Query users table → bcrypt.compare() in browser (CDN lib)
6. Session stored in sessionStorage ({ id, email, role })
7. Each page checks Auth.requireLogin() on load
8. Logout clears sessionStorage
```

## Data Flow: Turso HTTP API

```
Browser sends:
  POST https://<db>.turso.io/v2/pipeline
  Authorization: Bearer <token>
  Content-Type: application/json
  {
    "requests": [
      { "type": "execute", "stmt": { "sql": "...", "args": [...] } },
      { "type": "close" }
    ]
  }

Turso responds:
  {
    "results": [{
      "type": "ok",
      "response": {
        "result": {
          "cols": [{ "name": "id" }, ...],
          "rows": [[{ "type": "integer", "value": "1" }, ...]]
        }
      }
    }]
  }

db.js parses this into plain JS objects: [{ id: 1, ... }]
```

## Export Flow (Client-Side)

```
1. User clicks Export → enters version number
2. api.js queries all content + translations from Turso
3. Builds SQL dump string in memory (CREATE TABLE + INSERT)
4. Records version in versions table
5. Creates Blob → URL.createObjectURL → triggers download
6. No server involved at any point
```

## File Structure

```
content-admin/
├── index.html          # Login + Turso setup
├── dashboard.html      # Stats, actions, versions
├── editor.html         # Tree + tabbed editor
├── preview.html        # Mobile preview
├── css/
│   └── styles.css      # Design system
├── js/
│   ├── db.js           # Turso HTTP API client
│   ├── auth.js         # Session + bcrypt login
│   ├── api.js          # All data operations
│   └── utils.js        # UI helpers
├── schema.sql          # DB init script
├── INSTRUCTIONS.md     # Deployment guide
├── COMPLETED.md        # Feature tracker
├── LOGIC_FLOW.md       # This file
└── ADMIN_QUICKSTART.md # Editor guide
```

## Key Design Decisions

1. **No build step**: Pure HTML/CSS/JS. Deploy by pushing to GitHub.
2. **Turso HTTP API direct**: No proxy/serverless needed. Browser → Turso.
3. **bcrypt via CDN**: `bcryptjs` loaded from jsDelivr for password verification.
4. **sessionStorage for login**: Session clears when tab closes (security).
5. **localStorage for Turso creds**: Persists across sessions (convenience).
6. **SQL dump export**: Generated client-side as text, no binary dependencies.
