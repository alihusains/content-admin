# INSTRUCTIONS — Deploying Content Admin on GitHub Pages

## Overview

Content Admin is a fully static web application that runs entirely in the browser. It connects directly to your Turso database via its HTTP API — no server needed.

---

## Step 1: Push Code to GitHub

If not already done, create a GitHub repository and push this code:

```bash
cd content-admin
git init
git add -A
git commit -m "Content Admin — static GitHub Pages deployment"
git remote add origin https://github.com/YOUR_USERNAME/content-admin.git
git branch -M main
git push -u origin main
```

---

## Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar, under "Code and automation")
4. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**
6. Wait 1–2 minutes for deployment
7. Your site will be available at: `https://YOUR_USERNAME.github.io/content-admin/`

---

## Step 3: Set Up Your Turso Database

If you haven't already created your database tables, run the SQL in `schema.sql` on your Turso database.

You can do this via the Turso CLI:

```bash
# Install Turso CLI (if not installed)
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Open a shell to your database
turso db shell YOUR_DB_NAME

# Then paste the contents of schema.sql and press Enter
```

Or use the Turso web dashboard to run the SQL.

---

## Step 4: Create Your Admin Account

After the tables are created, insert your first admin user. Run this SQL on your Turso database:

**Option A — Via Turso CLI shell:**
```sql
-- First, generate a bcrypt hash of your password
-- You can use https://bcrypt-generator.com/ to generate one
-- Example: password "admin123" → hash below (DO NOT use this in production)

INSERT INTO users (email, password_hash, role)
VALUES ('your-email@example.com', '$2a$10$YOUR_BCRYPT_HASH_HERE', 'admin');
```

**Option B — Via the app itself (recommended):**

If you want to create the user through the app, you can temporarily add this to `index.html` to show a register option, or run this quick script in the browser console after connecting the database:

```javascript
// Open your deployed site, complete the database setup step, then run in console:
const bcrypt = window.dcodeIO.bcrypt;
const hash = bcrypt.hashSync("YOUR_PASSWORD_HERE", 10);
await TursoDB.execute(
  "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
  ["your-email@example.com", hash]
);
console.log("Admin user created!");
// Then refresh the page and log in
```

---

## Step 5: First Login

1. Open your GitHub Pages URL
2. On first visit, you'll see the **Database Setup** screen
3. Enter your Turso credentials:
   - **Database URL**: `libsql://your-db-name.turso.io` (from Turso dashboard)
   - **Auth Token**: Your Turso auth token (from Turso dashboard)
4. Click **Connect Database**
5. Once connected, enter your email and password
6. You're in!

---

## How It Works

```
Browser (GitHub Pages)
    ↓ fetch()
Turso HTTP API (v2/pipeline)
    ↓ SQL
Turso Database (libSQL)
```

- All code runs in your browser — there is no server
- Database credentials are stored in your browser's `localStorage`
- Your login session is stored in `sessionStorage` (clears when you close the tab)
- SQL queries are sent directly to Turso's HTTP API

---

## Security Notes

- **Database credentials** are stored in the browser and visible to anyone with access to your computer. Only use this on trusted devices.
- **Turso auth tokens** have full read/write access. Treat them like passwords.
- The site itself is public (GitHub Pages), but you need both the Turso credentials AND the admin password to access any data.
- For additional security, you can use a **private GitHub repository** — GitHub Pages still works with private repos (on paid plans).

---

## File Structure

```
content-admin/
├── index.html          ← Login + database setup
├── dashboard.html      ← Stats, quick actions, version history
├── editor.html         ← Content tree + translation editor
├── preview.html        ← Mobile phone-frame preview
├── css/
│   └── styles.css      ← Custom design system
├── js/
│   ├── db.js           ← Turso HTTP API client
│   ├── auth.js         ← Session management + bcrypt login
│   ├── api.js          ← Application data layer
│   └── utils.js        ← Toast, Loading, confirmAction helpers
├── schema.sql          ← Database schema (run once on Turso)
├── INSTRUCTIONS.md     ← This file
├── COMPLETED.md        ← Feature tracking
├── LOGIC_FLOW.md       ← Architecture docs
└── ADMIN_QUICKSTART.md ← Editor user guide
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Database not configured" | Enter your Turso URL and token on the login page |
| "Invalid Turso credentials" | Check your auth token hasn't expired. Generate a new one from Turso dashboard |
| "Invalid email or password" | Make sure you created a user in the `users` table (see Step 4) |
| CORS errors | Turso should allow browser requests. If not, check if your token is valid |
| Page not loading | Make sure GitHub Pages is enabled and pointing to `main` branch, root folder |
| Changes not showing | GitHub Pages can take 1–2 minutes to update after a push |

---

## Updating the App

1. Make changes to the files locally
2. Commit and push:
   ```bash
   git add -A
   git commit -m "Update content admin"
   git push
   ```
3. GitHub Pages will auto-deploy within 1–2 minutes

---

## Optional: Custom Domain

1. In your repo Settings → Pages, add a custom domain
2. Add a `CNAME` file to the root with your domain name
3. Configure DNS (CNAME record pointing to `YOUR_USERNAME.github.io`)
