import type { FileFilter } from '../types/electron';

const BROWSER_SETTINGS_KEY = 'mutmap_studio_ai_settings_v1';

function getElectronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

export function isElectronEnv(): boolean {
  return Boolean(getElectronApi());
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveTextFile(options: {
  defaultPath: string;
  filters: FileFilter[];
  content: string;
  mimeType?: string;
}): Promise<{ canceled: boolean; filePath?: string }> {
  const api = getElectronApi();
  if (api) {
    return api.saveTextFile({
      defaultPath: options.defaultPath,
      filters: options.filters,
      content: options.content,
    });
  }
  const blob = new Blob([options.content], {
    type: options.mimeType ?? 'text/plain;charset=utf-8',
  });
  triggerBrowserDownload(blob, options.defaultPath);
  return { canceled: false, filePath: options.defaultPath };
}

export async function saveBinaryFile(options: {
  defaultPath: string;
  filters: FileFilter[];
  bytes: Uint8Array;
  mimeType: string;
}): Promise<{ canceled: boolean; filePath?: string }> {
  const api = getElectronApi();
  if (api) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < options.bytes.length; i += chunk) {
      binary += String.fromCharCode(...options.bytes.subarray(i, i + chunk));
    }
    const base64Data = btoa(binary);
    return api.saveBinaryFile({
      defaultPath: options.defaultPath,
      filters: options.filters,
      base64Data,
    });
  }
  const copy = new Uint8Array(options.bytes);
  const blob = new Blob([copy.buffer], { type: options.mimeType });
  triggerBrowserDownload(blob, options.defaultPath);
  return { canceled: false, filePath: options.defaultPath };
}

export async function openTextFile(options: {
  filters: FileFilter[];
}): Promise<{ canceled: boolean; filePath?: string; content?: string }> {
  const api = getElectronApi();
  if (api) {
    return api.openTextFile(options);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    const accept = options.filters
      .flatMap((f) => f.extensions.map((ext) => `.${ext}`))
      .join(',');
    if (accept) input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ canceled: true });
        return;
      }
      const content = await file.text();
      resolve({ canceled: false, filePath: file.name, content });
    };
    input.oncancel = () => resolve({ canceled: true });
    input.click();
  });
}

export async function platformFetch(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status: number; statusText: string; text: string }> {
  const api = getElectronApi();
  if (api) {
    return api.httpFetch({
      url: options.url,
      method: options.method,
      headers: options.headers,
      body: options.body,
      timeoutMs: options.timeoutMs,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      text,
    };
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export async function loadPersistedSettings(): Promise<Record<string, unknown> | null> {
  const api = getElectronApi();
  if (api) {
    return api.loadSettings();
  }
  try {
    const raw = localStorage.getItem(BROWSER_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function savePersistedSettings(settings: Record<string, unknown>): Promise<boolean> {
  const api = getElectronApi();
  if (api) {
    return api.saveSettings(settings);
  }
  try {
    localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
