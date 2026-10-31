import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryService } from '../src/main/library/service';
import { LibraryDatabase } from '../src/main/storage/database';

const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'ebook-service-')); dirs.push(root);
  const books = join(root, 'books'); const temp = join(root, 'temp');
  mkdirSync(books); mkdirSync(temp);
  const db = new LibraryDatabase(join(root, 'data', 'db.sqlite'));
  return { root, books, db, service: new LibraryService(db, books, temp) };
}

describe('LibraryService', () => {
  it('imports a managed copy, reads it, detects duplicates and deletes it', async () => {
    const { root, books, db, service } = setup();
    const source = join(root, '我的书.txt'); writeFileSync(source, '第一章\n这是一段文字。');
    const result = await service.importPath(source);
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') throw new Error('unexpected');
    const stored = db.get(result.book.id)!;
    expect(readFileSync(join(books, stored.storedName), 'utf8')).toContain('第一章');
    await expect(service.getSource(result.book.id)).resolves.toMatchObject({ format: 'txt', title: '我的书' });
    await expect(service.importPath(source)).resolves.toMatchObject({ status: 'duplicate' });
    await service.delete(result.book.id);
    expect(service.list()).toHaveLength(0);
    db.close();
  });

  it('rejects unsupported formats without creating a record', async () => {
    const { root, db, service } = setup();
    const source = join(root, 'bad.pdf'); writeFileSync(source, 'fake');
    await expect(service.importPath(source)).rejects.toThrow('仅支持');
    expect(service.list()).toEqual([]);
    db.close();
  });
});
