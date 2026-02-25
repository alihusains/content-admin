# Content Admin — Quick Start Guide

Welcome to Content Admin! This guide will help you get started with managing content.

## Logging In

1. Open the admin panel URL in your browser
2. Enter your email and password
3. Click **Sign In**

## Dashboard

After login you'll see the dashboard with:
- **Stats**: Total content items, translations, categories, and versions
- **Quick Actions**: Shortcuts to common tasks
- **Version History**: List of all database exports

## Managing Content (Editor)

### Opening the Editor
Click **Content Editor** on the dashboard or **Editor** in the navigation bar.

### Understanding the Layout
- **Left side**: Content tree showing all your items
- **Right side**: Editor area with tabs for structure and translations

### Adding Content
1. Click the **+** button at the top of the tree to add a root item
2. Or hover over any item and click **+** to add a child
3. Choose the content type (Category, Content, Section, or Item)
4. Click **Add**

### Editing Content
1. Click on any item in the tree
2. The editor panel will show on the right
3. **Structure tab**: Set type, parent, display order, media URLs
4. **Language tabs**: Add translations in English, Gujarati, Arabic, Urdu
5. Click the **Save** button in each section to save your changes
6. You can also press **Ctrl+S** (or Cmd+S on Mac) to save the current tab

### Reordering Content
- Drag and drop items in the tree to reorder them
- Items can also be moved to different parents by dragging

### Searching Content
- Use the search box at the top of the tree
- Search matches content titles, types, and IDs

### Deleting Content
- Hover over an item and click the trash icon
- Or select an item and click **Delete** in the editor header
- Deletions are soft-deletes (data is preserved but hidden)

## Previewing Content

1. Select a content item in the editor
2. Click the **Preview** button in the editor header
3. A new tab opens with a mobile-phone style preview
4. Use the language dropdown to switch between translations
5. Click on children items to navigate deeper into the content tree

## Exporting Database

1. Go to the Dashboard
2. Click **Export Database**
3. Enter a version number (e.g., "1.0" or "2.0")
4. Optionally add release notes
5. Click **Export**
6. A SQL file will download automatically
7. The export is recorded in the Version History

## Tips

- All content changes are saved individually per section/language
- The tree auto-refreshes after creating, deleting, or reordering items
- Arabic and Urdu fields automatically use right-to-left text direction
- You never need to manage IDs — the system handles them automatically
