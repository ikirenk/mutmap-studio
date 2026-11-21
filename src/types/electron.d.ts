export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ElectronAPI {
  saveTextFile(options: {
    defaultPath: string;
    filters: FileFilter[];
    content: string;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  saveBinaryFile(options: {
    defaultPath: string;
    filters: FileFilter[];
    base64Data: string;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  openTextFile(options: {
    filters: FileFilter[];
  }): Promise<{ canceled: boolean; filePath?: string; content?: string }>;
  exportVectorPdf(options: {
    svgMarkup: string;
    widthPx: number;
    heightPx: number;
    defaultPath: string;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  httpFetch(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; status: number; statusText: string; text: string }>;
  loadSettings(): Promise<Record<string, unknown> | null>;
  saveSettings(settings: Record<string, unknown>): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
