import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { db } from "../lib/db";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const filePath = "/tmp/app.db";

  const sqlite = await open({
    filename: filePath,
    driver: sqlite3.Database,
  });

  await sqlite.exec(`
    CREATE TABLE content AS SELECT * FROM main.content;
    CREATE TABLE content_translation AS SELECT * FROM main.content_translation;
  `);

  const file = fs.readFileSync(filePath);

  res.setHeader("Content-Type", "application/octet-stream");
  res.send(file);
}