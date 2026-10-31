import type { ReadingLocator } from '../../shared/models';

export interface ReaderAdapter {
  mount(container: HTMLElement): Promise<void>;
  restore(locator: ReadingLocator): Promise<void>;
  getCurrentLocator(): ReadingLocator | null;
  subscribeLocationChange(listener: (locator: ReadingLocator) => void): () => void;
  destroy(): Promise<void>;
}
