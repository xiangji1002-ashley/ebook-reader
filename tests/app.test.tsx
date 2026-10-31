import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/App';
import type { DesktopApi } from '../src/shared/models';

const api: DesktopApi = {
  library: { selectAndImport: vi.fn(), list: vi.fn(), delete: vi.fn(), getSource: vi.fn() },
  progress: { get: vi.fn(), save: vi.fn() }
};

beforeEach(() => { vi.clearAllMocks(); window.desktopApi = api; });

describe('App', () => {
  it('shows the empty library and imports a book', async () => {
    vi.mocked(api.library.list).mockResolvedValue([]);
    vi.mocked(api.library.selectAndImport).mockResolvedValue({ status: 'cancelled' });
    render(<App />);
    expect(await screen.findByText('书架还是空的')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择一本书' }));
    await waitFor(() => expect(api.library.selectAndImport).toHaveBeenCalledOnce());
  });

  it('shows imported books and deletes after confirmation', async () => {
    const book = { id: 'f6a5ac37-5b2a-4e7b-881d-94126586ca6b', title: '群山', format: 'txt' as const, originalName: '群山.txt', fileSize: 10, importedAt: 1, lastOpenedAt: null, percentage: .25 };
    vi.mocked(api.library.list).mockResolvedValue([book]);
    vi.mocked(api.library.delete).mockResolvedValue();
    render(<App />);
    expect(await screen.findByRole('button', { name: '打开《群山》' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除《群山》' }));
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() => expect(api.library.delete).toHaveBeenCalledWith(book.id));
  });
});
