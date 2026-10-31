export type BookFormat = 'txt' | 'epub';

export interface BookSummary {
  id: string;
  title: string;
  format: BookFormat;
  originalName: string;
  fileSize: number;
  importedAt: number;
  lastOpenedAt: number | null;
  percentage: number | null;
}

export interface TxtLocator {
  type: 'text-offset';
  offset: number;
  context?: string;
  percentage: number;
}

export interface EpubLocator {
  type: 'epub-cfi';
  cfi: string;
  spineHref?: string;
  percentage?: number;
}

export type ReadingLocator = TxtLocator | EpubLocator;

export type BookSource =
  | { format: 'txt'; title: string; text: string }
  | { format: 'epub'; title: string; data: Uint8Array };

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'imported'; book: BookSummary }
  | { status: 'duplicate'; book: BookSummary };

export interface DesktopApi {
  library: {
    selectAndImport(): Promise<ImportResult>;
    list(): Promise<BookSummary[]>;
    delete(bookId: string): Promise<void>;
    getSource(bookId: string): Promise<BookSource>;
  };
  progress: {
    get(bookId: string): Promise<ReadingLocator | null>;
    save(bookId: string, locator: ReadingLocator): Promise<void>;
  };
}
