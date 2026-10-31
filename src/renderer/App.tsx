import { useCallback, useEffect, useState } from 'react';
import type { BookSummary } from '../shared/models';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderPage } from './pages/ReaderPage';
import './styles.css';

export function App() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [activeBook, setActiveBook] = useState<BookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setBooks(await window.desktopApi.library.list()); }
    catch (reason) { setError(readError(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (activeBook) {
    return <ReaderPage book={activeBook} onBack={() => { setActiveBook(null); void refresh(); }} />;
  }

  return (
    <LibraryPage
      books={books} loading={loading} error={error}
      onDismissError={() => setError(null)} onOpen={setActiveBook}
      onRefresh={refresh} onError={(reason) => setError(readError(reason))}
    />
  );
}

export function readError(reason: unknown) {
  if (!(reason instanceof Error)) return '发生未知错误，请重试。';
  return reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
