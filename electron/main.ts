import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExportVectorPdfOptions,
  HttpFetchOptions,
  OpenFileOptions,
  SaveBinaryFileOptions,
  SaveFileOptions,
} from './types';

let mainWindow: BrowserWindow | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'mutmap-settings.json');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#f8fafc',
    title: 'MutMap Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('file:save-text', async (_event, options: SaveFileOptions) => {
    const target = mainWindow ?? undefined;
    const dialogOpts = {
      defaultPath: options.defaultPath,
      filters: options.filters,
    };
    const res = target
      ? await dialog.showSaveDialog(target, dialogOpts)
      : await dialog.showSaveDialog(dialogOpts);
    if (res.canceled || !res.filePath) {
      return { canceled: true };
    }
    await fs.promises.writeFile(res.filePath, options.content, 'utf-8');
    return { canceled: false, filePath: res.filePath };
  });

  ipcMain.handle('file:save-binary', async (_event, options: SaveBinaryFileOptions) => {
    const target = mainWindow ?? undefined;
    const dialogOpts = {
      defaultPath: options.defaultPath,
      filters: options.filters,
    };
    const res = target
      ? await dialog.showSaveDialog(target, dialogOpts)
      : await dialog.showSaveDialog(dialogOpts);
    if (res.canceled || !res.filePath) {
      return { canceled: true };
    }
    const buffer = Buffer.from(options.base64Data, 'base64');
    await fs.promises.writeFile(res.filePath, buffer);
    return { canceled: false, filePath: res.filePath };
  });

  ipcMain.handle('file:open-text', async (_event, options: OpenFileOptions) => {
    const target = mainWindow ?? undefined;
    const dialogOpts = {
      properties: ['openFile'] as Array<'openFile'>,
      filters: options.filters,
    };
    const res = target
      ? await dialog.showOpenDialog(target, dialogOpts)
      : await dialog.showOpenDialog(dialogOpts);
    if (res.canceled || res.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = res.filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  });

  ipcMain.handle('export:pdf', async (_event, options: ExportVectorPdfOptions) => {
    const target = mainWindow ?? undefined;
    const dialogOpts = {
      defaultPath: options.defaultPath,
      filters: [{ name: 'PDF Belgesi', extensions: ['pdf'] }],
    };
    const res = target
      ? await dialog.showSaveDialog(target, dialogOpts)
      : await dialog.showSaveDialog(dialogOpts);
    if (res.canceled || !res.filePath) {
      return { canceled: true };
    }

    const pdfWindow = new BrowserWindow({
      show: false,
      width: Math.max(200, Math.round(options.widthPx)),
      height: Math.max(200, Math.round(options.heightPx)),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${options.widthPx}px ${options.heightPx}px; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${options.widthPx}px;
    height: ${options.heightPx}px;
    overflow: hidden;
    background: #ffffff;
  }
  svg {
    display: block;
    width: ${options.widthPx}px;
    height: ${options.heightPx}px;
  }
</style>
</head>
<body>${options.svgMarkup}</body>
</html>`;

      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: {
          width: options.widthPx / 96,
          height: options.heightPx / 96,
        },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      await fs.promises.writeFile(res.filePath, pdfBuffer);
      return { canceled: false, filePath: res.filePath };
    } finally {
      if (!pdfWindow.isDestroyed()) {
        pdfWindow.close();
      }
    }
  });

  ipcMain.handle('net:fetch', async (_event, options: HttpFetchOptions) => {
    const isAllowedUrl =
      typeof options.url === 'string' &&
      (options.url.startsWith('https://') ||
        /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(options.url));
    if (!isAllowedUrl) {
      throw new Error(
        'Güvenlik kuralı: Yalnızca HTTPS veya yerel localhost isteklerine izin verilir.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
    try {
      const response = await fetch(options.url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
      };
    } finally {
      clearTimeout(timeout);
    }
  });

  ipcMain.handle('settings:load', async () => {
    const filePath = getSettingsPath();
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const decryptField = (encKey: string): string => {
        const val = parsed[encKey];
        if (typeof val !== 'string' || !val) return '';
        if (val.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
          const buf = Buffer.from(val.slice(4), 'base64');
          return safeStorage.decryptString(buf);
        }
        if (val.startsWith('plain:')) {
          return Buffer.from(val.slice(6), 'base64').toString('utf-8');
        }
        return val;
      };

      const result: Record<string, unknown> = { ...parsed };
      if ('geminiApiKeyEncrypted' in parsed) {
        result.geminiApiKey = decryptField('geminiApiKeyEncrypted');
        delete result.geminiApiKeyEncrypted;
      }
      if ('openaiApiKeyEncrypted' in parsed) {
        result.openaiApiKey = decryptField('openaiApiKeyEncrypted');
        delete result.openaiApiKeyEncrypted;
      }
      if ('openrouterApiKeyEncrypted' in parsed) {
        result.openrouterApiKey = decryptField('openrouterApiKeyEncrypted');
        delete result.openrouterApiKeyEncrypted;
      }
      return result;
    } catch {
      return null;
    }
  });

  ipcMain.handle('settings:save', async (_event, settings: Record<string, unknown>) => {
    const filePath = getSettingsPath();
    const encryptField = (plain: unknown): string => {
      if (typeof plain !== 'string' || !plain) return '';
      if (safeStorage.isEncryptionAvailable()) {
        return 'enc:' + safeStorage.encryptString(plain).toString('base64');
      }
      return 'plain:' + Buffer.from(plain, 'utf-8').toString('base64');
    };

    const persisted: Record<string, unknown> = { ...settings };
    if ('geminiApiKey' in persisted) {
      persisted.geminiApiKeyEncrypted = encryptField(persisted.geminiApiKey);
      delete persisted.geminiApiKey;
    }
    if ('openaiApiKey' in persisted) {
      persisted.openaiApiKeyEncrypted = encryptField(persisted.openaiApiKey);
      delete persisted.openaiApiKey;
    }
    if ('openrouterApiKey' in persisted) {
      persisted.openrouterApiKeyEncrypted = encryptField(persisted.openrouterApiKey);
      delete persisted.openrouterApiKey;
    }

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(persisted, null, 2), 'utf-8');
    return true;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
