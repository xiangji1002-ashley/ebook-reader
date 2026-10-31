import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { LibraryService } from './library/service';
import { LibraryDatabase } from './storage/database';
import { bookIdSchema, readingLocatorSchema } from '../shared/schemas';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let database: LibraryDatabase | null = null;

function registerIpc(service: LibraryService, db: LibraryDatabase) {
  ipcMain.handle('library:selectAndImport', async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, {
      title: '导入电子书', properties: ['openFile'],
      filters: [{ name: '电子书', extensions: ['txt', 'epub'] }]
    });
    if (selection.canceled || selection.filePaths.length === 0) return { status: 'cancelled' };
    return service.importPath(selection.filePaths[0]);
  });
  ipcMain.handle('library:list', () => service.list());
  ipcMain.handle('library:delete', (_event, value) => service.delete(bookIdSchema.parse(value)));
  ipcMain.handle('library:getSource', (_event, value) => service.getSource(bookIdSchema.parse(value)));
  ipcMain.handle('progress:get', (_event, value) => db.getProgress(bookIdSchema.parse(value)));
  ipcMain.handle('progress:save', (_event, bookValue, locatorValue) => {
    const bookId = bookIdSchema.parse(bookValue);
    if (!db.get(bookId)) throw new Error('图书不存在。');
    db.saveProgress(bookId, readingLocatorSchema.parse(locatorValue));
  });
}

async function createWindow() {
  if (!database) {
    const dataRoot = join(app.getPath('userData'), 'EBookReader');
    const booksDir = join(dataRoot, 'books');
    const tempDir = join(dataRoot, 'temp');
    await Promise.all([mkdir(booksDir, { recursive: true }), rm(tempDir, { recursive: true, force: true }), mkdir(tempDir, { recursive: true })]);
    database = new LibraryDatabase(join(dataRoot, 'data', 'library.sqlite'));
    registerIpc(new LibraryService(database, booksDir, tempDir), database);
  }

  mainWindow = new BrowserWindow({
    width: 1180, height: 780, minWidth: 760, minHeight: 560,
    backgroundColor: '#f4f0e8',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, 'index.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)
      : url.startsWith('file:');
    if (!allowed) event.preventDefault();
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else await mainWindow.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}

app.whenReady().then(createWindow).catch((error) => { console.error(error); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
app.on('before-quit', () => { database?.close(); database = null; });
