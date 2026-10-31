import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { BookSource, ImportResult } from '../../shared/models';
import type { LibraryDatabase } from '../storage/database';
import { validateEpub } from './epub';
import { decodeText } from './text';

const MAX_BOOK_SIZE = 200 * 1024 * 1024;

export class LibraryService {
  constructor(private readonly db: LibraryDatabase, private readonly booksDir: string, private readonly tempDir: string) {}

  list() { return this.db.list(); }

  async importPath(sourcePath: string): Promise<Exclude<ImportResult, { status: 'cancelled' }>> {
    const extension = extname(sourcePath).toLowerCase();
    if (extension !== '.txt' && extension !== '.epub') throw new Error('仅支持 TXT 和 EPUB 文件。');
    const info = await stat(sourcePath);
    if (!info.isFile() || info.size === 0) throw new Error('文件为空或不可读取。');
    if (info.size > MAX_BOOK_SIZE) throw new Error('单本图书不能超过 200 MB。');
    const data = await readFile(sourcePath);
    const hash = createHash('sha256').update(data).digest('hex');
    const duplicate = this.db.getByHash(hash);
    if (duplicate) return { status: 'duplicate', book: duplicate };

    const format = extension.slice(1) as 'txt' | 'epub';
    let title = basename(sourcePath, extension);
    if (format === 'txt') decodeText(data);
    else title = (await validateEpub(data)).title || title;

    const id = randomUUID();
    const storedName = `${id}.${format}`;
    await mkdir(this.booksDir, { recursive: true });
    await mkdir(this.tempDir, { recursive: true });
    const temporary = join(this.tempDir, storedName);
    const destination = join(this.booksDir, storedName);
    try {
      await copyFile(sourcePath, temporary);
      await rename(temporary, destination);
      this.db.insert({ id, title, format, originalName: basename(sourcePath), storedName, fileHash: hash, fileSize: info.size, importedAt: Date.now() });
    } catch (error) {
      await rm(temporary, { force: true });
      await rm(destination, { force: true });
      throw error;
    }
    return { status: 'imported', book: this.db.get(id)! };
  }

  async getSource(id: string): Promise<BookSource> {
    const book = this.db.get(id);
    if (!book) throw new Error('图书不存在或已被删除。');
    let data: Buffer;
    try { data = await readFile(join(this.booksDir, book.storedName)); }
    catch { throw new Error('图书文件丢失，请从书架删除后重新导入。'); }
    this.db.touch(id);
    return book.format === 'txt'
      ? { format: 'txt', title: book.title, text: decodeText(data) }
      : { format: 'epub', title: book.title, data: new Uint8Array(data) };
  }

  async delete(id: string): Promise<void> {
    const book = this.db.get(id);
    if (!book) throw new Error('图书不存在。');
    await unlink(join(this.booksDir, book.storedName)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    this.db.delete(id);
  }
}
