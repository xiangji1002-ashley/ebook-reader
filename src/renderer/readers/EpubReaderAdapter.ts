import ePub, { type Book, type Rendition } from 'epubjs';
import type { EpubLocator, ReadingLocator } from '../../shared/models';
import type { ReaderAdapter } from './ReaderAdapter';

export class EpubReaderAdapter implements ReaderAdapter {
  private book: Book | null = null;
  private rendition: Rendition | null = null;
  private locator: EpubLocator | null = null;
  private listeners = new Set<(locator: ReadingLocator) => void>();

  constructor(private readonly data: Uint8Array) {}

  async mount(container: HTMLElement) {
    this.book = ePub(this.data.buffer as ArrayBuffer);
    await this.book.ready;
    this.rendition = this.book.renderTo(container, {
      width: '100%', height: '100%', flow: 'scrolled-doc', manager: 'continuous',
      allowScriptedContent: false
    });
    this.rendition.themes.default({
      body: { color: '#2d2a26', 'font-family': 'Georgia, "Noto Serif SC", serif', 'font-size': '19px', 'line-height': '1.85', padding: '24px 7% !important' },
      img: { 'max-width': '100% !important', height: 'auto !important' },
      a: { color: '#8a4f2d' }
    });
    this.rendition.on('relocated', this.onRelocated);
    await this.rendition.display();
  }

  async restore(locator: ReadingLocator) {
    if (locator.type === 'epub-cfi' && this.rendition) await this.rendition.display(locator.cfi).catch(() => undefined);
  }
  getCurrentLocator() { return this.locator; }
  subscribeLocationChange(listener: (locator: ReadingLocator) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async destroy() { this.rendition?.off('relocated', this.onRelocated); this.book?.destroy(); this.rendition = null; this.book = null; this.listeners.clear(); }

  private onRelocated = (location: any) => {
    const cfi = location?.start?.cfi;
    if (!cfi) return;
    this.locator = { type: 'epub-cfi', cfi, spineHref: location.start.href, percentage: location.start.percentage };
    this.listeners.forEach((listener) => listener(this.locator!));
  };
}
