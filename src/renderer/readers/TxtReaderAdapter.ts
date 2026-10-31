import type { ReadingLocator, TxtLocator } from '../../shared/models';
import type { ReaderAdapter } from './ReaderAdapter';

export class TxtReaderAdapter implements ReaderAdapter {
  private container: HTMLElement | null = null;
  private locator: TxtLocator = { type: 'text-offset', offset: 0, percentage: 0 };
  private listeners = new Set<(locator: ReadingLocator) => void>();
  private frame = 0;

  constructor(private readonly text: string) {}

  async mount(container: HTMLElement) {
    this.container = container;
    const article = document.createElement('article');
    article.className = 'txt-content';
    article.textContent = this.text;
    container.replaceChildren(article);
    container.addEventListener('scroll', this.onScroll, { passive: true });
  }

  async restore(locator: ReadingLocator) {
    if (!this.container || locator.type !== 'text-offset') return;
    const percentage = this.text.length ? Math.min(locator.offset / this.text.length, 1) : locator.percentage;
    requestAnimationFrame(() => { if (this.container) this.container.scrollTop = percentage * (this.container.scrollHeight - this.container.clientHeight); });
  }

  getCurrentLocator() { return this.locator; }
  subscribeLocationChange(listener: (locator: ReadingLocator) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async destroy() {
    cancelAnimationFrame(this.frame);
    this.container?.removeEventListener('scroll', this.onScroll);
    this.container = null;
    this.listeners.clear();
  }

  private onScroll = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      if (!this.container) return;
      const max = Math.max(this.container.scrollHeight - this.container.clientHeight, 1);
      const percentage = Math.min(Math.max(this.container.scrollTop / max, 0), 1);
      const offset = Math.round(percentage * this.text.length);
      this.locator = { type: 'text-offset', offset, context: this.text.slice(offset, offset + 80), percentage };
      this.listeners.forEach((listener) => listener(this.locator));
    });
  };
}
