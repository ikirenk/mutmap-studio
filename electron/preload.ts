import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  ExportVectorPdfOptions,
  HttpFetchOptions,
  OpenFileOptions,
  SaveBinaryFileOptions,
  SaveFileOptions,
} from './types';

const electronAPI: ElectronAPI = {
  saveTextFile: (options: SaveFileOptions) => ipcRenderer.invoke('file:save-text', options),
  saveBinaryFile: (options: SaveBinaryFileOptions) =>
    ipcRenderer.invoke('file:save-binary', options),
  openTextFile: (options: OpenFileOptions) => ipcRenderer.invoke('file:open-text', options),
  exportVectorPdf: (options: ExportVectorPdfOptions) => ipcRenderer.invoke('export:pdf', options),
  httpFetch: (options: HttpFetchOptions) => ipcRenderer.invoke('net:fetch', options),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', settings),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
