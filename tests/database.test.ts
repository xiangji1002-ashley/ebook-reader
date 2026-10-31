import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryDatabase } from '../src/main/storage/database';

const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe('LibraryDatabase', () => {
  it('persists books and progress after reopening', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ebook-db-')); dirs.push(dir);
    const path = join(dir, 'library.sqlite');
    const book = { id: 'f6a5ac37-5b2a-4e7b-881d-94126586ca6b', title: '示例', format: 'txt' as const, originalName: 'a.txt', storedName: 'id.txt', fileHash: 'hash', fileSize: 12, importedAt: 1 };
    let db = new LibraryDatabase(path);
    db.insert(book);
    db.saveProgress(book.id, { type: 'text-offset', offset: 5, percentage: 0.5 });
    db.close();
    db = new LibraryDatabase(path);
    expect(db.list()).toHaveLength(1);
    expect(db.getProgress(book.id)).toEqual({ type: 'text-offset', offset: 5, percentage: 0.5 });
    db.delete(book.id);
    expect(db.getProgress(book.id)).toBeNull();
    db.close();
  });
});
