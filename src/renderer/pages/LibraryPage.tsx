import { useState, type CSSProperties } from 'react';
import type { BookSummary } from '../../shared/models';

interface Props {
  books: BookSummary[]; loading: boolean; error: string | null;
  onOpen(book: BookSummary): void; onRefresh(): Promise<void>;
  onError(reason: unknown): void; onDismissError(): void;
}

export function LibraryPage({ books, loading, error, onOpen, onRefresh, onError, onDismissError }: Props) {
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<BookSummary | null>(null);

  const importBook = async () => {
    setImporting(true);
    try {
      const result = await window.desktopApi.library.selectAndImport();
      if (result.status !== 'cancelled') await onRefresh();
      if (result.status === 'duplicate') onError(new Error(`《${result.book.title}》已经在书架中。`));
    } catch (reason) { onError(reason); }
    finally { setImporting(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try { await window.desktopApi.library.delete(deleting.id); setDeleting(null); await onRefresh(); }
    catch (reason) { onError(reason); }
  };

  return (
    <div className="app-shell">
      <header className="topbar library-topbar">
        <div className="brand"><span className="brand-mark">E</span><span>页间</span></div>
        <button className="primary-button" onClick={() => void importBook()} disabled={importing}>
          <span aria-hidden="true">＋</span>{importing ? '正在导入…' : '导入电子书'}
        </button>
      </header>

      <main className="library-main">
        <div className="library-heading">
          <div><p className="eyebrow">你的私人书架</p><h1>继续阅读</h1></div>
          {books.length > 0 && <span className="book-count">{books.length} 本藏书</span>}
        </div>

        {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="关闭错误提示" onClick={onDismissError}>×</button></div>}
        {loading ? <div className="loading-state">正在整理书架…</div> : books.length === 0 ? (
          <section className="empty-state">
            <div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div>
            <h2>书架还是空的</h2>
            <p>导入一本 TXT 或 EPUB，让安静的阅读从这里开始。</p>
            <button className="secondary-button" onClick={() => void importBook()} disabled={importing}>选择一本书</button>
          </section>
        ) : (
          <section className="book-grid" aria-label="电子书列表">
            {books.map((book, index) => (
              <article className="book-card" key={book.id} style={{ '--index': index } as CSSProperties}>
                <button className={`book-cover cover-${index % 5}`} onClick={() => onOpen(book)} aria-label={`打开《${book.title}》`}>
                  <span className="cover-title">{book.title}</span><span className="cover-format">{book.format.toUpperCase()}</span>
                </button>
                <div className="book-details">
                  <button className="book-title" onClick={() => onOpen(book)}>{book.title}</button>
                  <div className="book-meta"><span>{book.format.toUpperCase()}</span><span>{formatSize(book.fileSize)}</span></div>
                  <div className="progress-track" title={`阅读进度 ${Math.round((book.percentage ?? 0) * 100)}%`}><span style={{ width: `${(book.percentage ?? 0) * 100}%` }} /></div>
                </div>
                <button className="delete-button" aria-label={`删除《${book.title}》`} onClick={() => setDeleting(book)}>•••</button>
              </article>
            ))}
          </section>
        )}
      </main>

      {deleting && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleting(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <p className="eyebrow">移出书架</p><h2 id="delete-title">删除《{deleting.title}》？</h2>
            <p>图书文件和阅读进度都会从此设备删除，此操作无法撤销。</p>
            <div className="dialog-actions"><button className="ghost-button" onClick={() => setDeleting(null)}>取消</button><button className="danger-button" onClick={() => void confirmDelete()}>删除</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
