export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SaveFileOptions {
  defaultPath: string;
  filters: FileFilter[];
  content: string;
}

export interface SaveBinaryFileOptions {
  defaultPath: string;
  filters: FileFilter[];
  base64Data: string;
}

export interface OpenFileOptions {
  filters: FileFilter[];
}

export interface ExportVectorPdfOptions {
  svgMarkup: string;
  widthPx: number;
  heightPx: number;
  defaultPath: string;
}

export interface HttpFetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
}

export interface FileDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface OpenTextFileResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

export interface ElectronAPI {
  saveTextFile(options: SaveFileOptions): Promise<FileDialogResult>;
  saveBinaryFile(options: SaveBinaryFileOptions): Promise<FileDialogResult>;
  openTextFile(options: OpenFileOptions): Promise<OpenTextFileResult>;
  exportVectorPdf(options: ExportVectorPdfOptions): Promise<FileDialogResult>;
  httpFetch(options: HttpFetchOptions): Promise<HttpFetchResponse>;
  loadSettings(): Promise<Record<string, unknown> | null>;
  saveSettings(settings: Record<string, unknown>): Promise<boolean>;
}
