import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookSummary, ReadingLocator } from '../../shared/models';
import { readError } from '../App';
import type { ReaderAdapter } from '../readers/ReaderAdapter';
import { EpubReaderAdapter } from '../readers/EpubReaderAdapter';
import { TxtReaderAdapter } from '../readers/TxtReaderAdapter';

export function ReaderPage({ book, onBack }: { book: BookSummary; onBack(): void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<ReaderAdapter | null>(null);
  const latestRef = useRef<ReadingLocator | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(book.percentage ?? 0);

  const save = useCallback(async (locator: ReadingLocator) => {
    try { await window.desktopApi.progress.save(book.id, locator); }
    catch { /* Keep the latest in memory; a later location change retries. */ }
  }, [book.id]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const open = async () => {
      try {
        const [source, saved] = await Promise.all([window.desktopApi.library.getSource(book.id), window.desktopApi.progress.get(book.id)]);
        if (cancelled || !hostRef.current) return;
        const adapter = source.format === 'txt' ? new TxtReaderAdapter(source.text) : new EpubReaderAdapter(source.data);
        adapterRef.current = adapter;
        await adapter.mount(hostRef.current);
        unsubscribe = adapter.subscribeLocationChange((locator) => {
          latestRef.current = locator;
          setPercentage(locator.percentage ?? 0);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => void save(locator), 700);
        });
        if (saved) { latestRef.current = saved; await adapter.restore(saved); }
      } catch (reason) { if (!cancelled) setError(readError(reason)); }
      finally { if (!cancelled) setLoading(false); }
    };
    void open();
    return () => {
      cancelled = true; unsubscribe?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (latestRef.current) void save(latestRef.current);
      void adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [book.id, save]);

  const goBack = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const locator = latestRef.current ?? adapterRef.current?.getCurrentLocator();
    if (locator) await save(locator);
    onBack();
  };

  return (
    <div className="reader-shell">
      <header className="reader-header">
        <button className="back-button" onClick={() => void goBack()}><span aria-hidden="true">←</span> 书架</button>
        <div className="reader-title"><span>{book.title}</span><small>{Math.round(percentage * 100)}%</small></div>
        <span className="reader-format">{book.format.toUpperCase()}</span>
      </header>
      <div className="reader-progress"><span style={{ width: `${percentage * 100}%` }} /></div>
      <main className="reader-host" ref={hostRef} aria-label={`${book.title} 正文`} />
      {loading && <div className="reader-overlay">正在打开书页…</div>}
      {error && <div className="reader-overlay error-view"><h2>无法打开这本书</h2><p>{error}</p><button className="secondary-button" onClick={onBack}>返回书架</button></div>}
    </div>
  );
}
