import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BookSummary, ReadingLocator } from '../../shared/models';

interface BookRow {
  id: string;
  title: string;
  format: 'txt' | 'epub';
  original_name: string;
  stored_name: string;
  file_hash: string;
  file_size: number;
  imported_at: number;
  last_opened_at: number | null;
  percentage: number | null;
}

export interface NewBook {
  id: string;
  title: string;
  format: 'txt' | 'epub';
  originalName: string;
  storedName: string;
  fileHash: string;
  fileSize: number;
  importedAt: number;
}

export class LibraryDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY, title TEXT NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('txt', 'epub')),
        original_name TEXT NOT NULL, stored_name TEXT NOT NULL,
        file_hash TEXT NOT NULL, file_size INTEGER NOT NULL,
        import_status TEXT NOT NULL DEFAULT 'ready',
        imported_at INTEGER NOT NULL, last_opened_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS books_file_hash_idx ON books(file_hash);
      CREATE TABLE IF NOT EXISTS reading_progress (
        book_id TEXT PRIMARY KEY, locator_type TEXT NOT NULL,
        locator TEXT NOT NULL, percentage REAL, updated_at INTEGER NOT NULL,
        FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
    `);
  }

  list(): BookSummary[] {
    const rows = this.db.prepare(`
      SELECT b.*, p.percentage FROM books b
      LEFT JOIN reading_progress p ON p.book_id = b.id
      WHERE b.import_status = 'ready'
      ORDER BY COALESCE(b.last_opened_at, b.imported_at) DESC
    `).all() as unknown as BookRow[];
    return rows.map(this.toSummary);
  }

  get(id: string): (BookSummary & { storedName: string; fileHash: string }) | null {
    const row = this.db.prepare(`SELECT b.*, p.percentage FROM books b LEFT JOIN reading_progress p ON p.book_id = b.id WHERE b.id = ?`).get(id) as unknown as BookRow | undefined;
    if (!row) return null;
    return { ...this.toSummary(row), storedName: row.stored_name, fileHash: row.file_hash };
  }

  getByHash(hash: string): BookSummary | null {
    const row = this.db.prepare(`SELECT b.*, p.percentage FROM books b LEFT JOIN reading_progress p ON p.book_id = b.id WHERE b.file_hash = ?`).get(hash) as unknown as BookRow | undefined;
    return row ? this.toSummary(row) : null;
  }

  insert(book: NewBook) {
    this.db.prepare(`INSERT INTO books (id,title,format,original_name,stored_name,file_hash,file_size,imported_at) VALUES (?,?,?,?,?,?,?,?)`).run(
      book.id, book.title, book.format, book.originalName, book.storedName, book.fileHash, book.fileSize, book.importedAt
    );
  }

  delete(id: string) { this.db.prepare('DELETE FROM books WHERE id = ?').run(id); }

  touch(id: string) { this.db.prepare('UPDATE books SET last_opened_at = ? WHERE id = ?').run(Date.now(), id); }

  getProgress(bookId: string): ReadingLocator | null {
    const row = this.db.prepare('SELECT locator FROM reading_progress WHERE book_id = ?').get(bookId) as { locator: string } | undefined;
    return row ? JSON.parse(row.locator) as ReadingLocator : null;
  }

  saveProgress(bookId: string, locator: ReadingLocator) {
    const percentage = locator.percentage ?? null;
    this.db.prepare(`
      INSERT INTO reading_progress(book_id, locator_type, locator, percentage, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET locator_type=excluded.locator_type, locator=excluded.locator, percentage=excluded.percentage, updated_at=excluded.updated_at
    `).run(bookId, locator.type, JSON.stringify(locator), percentage, Date.now());
  }

  close() { this.db.close(); }

  private toSummary(row: BookRow): BookSummary {
    return {
      id: row.id, title: row.title, format: row.format, originalName: row.original_name,
      fileSize: row.file_size, importedAt: row.imported_at, lastOpenedAt: row.last_opened_at,
      percentage: row.percentage
    };
  }
}
