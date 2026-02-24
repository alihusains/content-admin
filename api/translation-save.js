import { db } from "../lib/db";
import { verifyToken } from "../lib/auth";

export default async function handler(req, res) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const {
    content_id,
    language_code,
    title,
    transliteration,
    translation,
    original_text,
    search_text,
  } = req.body;

  await db.execute({
    sql: `
    INSERT INTO content_translation
    (content_id, language_code, title, transliteration, translation, original_text, search_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(content_id, language_code)
    DO UPDATE SET
      title=excluded.title,
      transliteration=excluded.transliteration,
      translation=excluded.translation,
      original_text=excluded.original_text,
      search_text=excluded.search_text,
      updated_at=CURRENT_TIMESTAMP
    `,
    args: [
      content_id,
      language_code,
      title,
      transliteration,
      translation,
      original_text,
      search_text,
    ],
  });

  res.json({ success: true });
}