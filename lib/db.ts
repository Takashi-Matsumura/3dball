import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "nfc.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS nfc_cards (
      uid TEXT PRIMARY KEY,
      card_id TEXT NOT NULL
    )
  `);

  return db;
}

export function loadCards(): Map<string, string> {
  const rows = getDb().prepare("SELECT uid, card_id FROM nfc_cards").all() as {
    uid: string;
    card_id: string;
  }[];
  return new Map(rows.map((r) => [r.uid, r.card_id]));
}

export function upsertCard(uid: string, cardId: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO nfc_cards (uid, card_id) VALUES (?, ?)")
    .run(uid, cardId);
}

export function deleteCard(uid: string): void {
  getDb().prepare("DELETE FROM nfc_cards WHERE uid = ?").run(uid);
}
