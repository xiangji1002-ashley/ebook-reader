import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/models';

const api: DesktopApi = {
  library: {
    selectAndImport: () => ipcRenderer.invoke('library:selectAndImport'),
    list: () => ipcRenderer.invoke('library:list'),
    delete: (bookId) => ipcRenderer.invoke('library:delete', bookId),
    getSource: (bookId) => ipcRenderer.invoke('library:getSource', bookId)
  },
  progress: {
    get: (bookId) => ipcRenderer.invoke('progress:get', bookId),
    save: (bookId, locator) => ipcRenderer.invoke('progress:save', bookId, locator)
  }
};

contextBridge.exposeInMainWorld('desktopApi', api);
