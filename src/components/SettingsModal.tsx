import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  X,
  AlertCircle,
} from 'lucide-react';
import { resolveOpenAICompletionsUrl, testAIConnection } from '../services/ai/parser';
import { useProjectStore } from '../store/useProjectStore';
import {
  AIProvider,
  AISettings,
  GEMINI_MODELS,
  OPENAI_MODELS,
  OPENROUTER_MODELS,
} from '../types/schema';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const aiSettings = useProjectStore((s) => s.aiSettings);
  const saveAISettingsToDisk = useProjectStore((s) => s.saveAISettingsToDisk);

  const [draft, setDraft] = useState<AISettings>(aiSettings);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (isOpen) {
      setDraft(aiSettings);
      setTestResult(null);
    }
  }, [isOpen, aiSettings]);

  if (!isOpen) return null;

  const presets =
    draft.provider === 'gemini'
      ? GEMINI_MODELS
      : draft.provider === 'openai'
        ? OPENAI_MODELS
        : OPENROUTER_MODELS;
  const activeKey =
    draft.provider === 'gemini'
      ? draft.geminiApiKey
      : draft.provider === 'openai'
        ? draft.openaiApiKey
        : draft.openrouterApiKey;

  const handleProviderChange = (provider: AIProvider) => {
    const defaultModel =
      provider === 'gemini'
        ? GEMINI_MODELS[0].id
        : provider === 'openai'
          ? OPENAI_MODELS[0].id
          : OPENROUTER_MODELS[0].id;
    setDraft((prev) => ({
      ...prev,
      provider,
      model: defaultModel,
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(draft);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    await saveAISettingsToDisk(draft);
    onNotify('Yapay zeka ayarları güvenli olarak kaydedildi.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            Yapay Zeka (AI Parser) Ayarları
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Provider */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              API Sağlayıcısı
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`py-2 px-2.5 rounded-lg border font-semibold ${
                  draft.provider === 'gemini'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`py-2 px-2.5 rounded-lg border font-semibold ${
                  draft.provider === 'openai'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('openrouter')}
                className={`py-2 px-2.5 rounded-lg border font-semibold ${
                  draft.provider === 'openrouter'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                OpenRouter
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {draft.provider === 'gemini'
                ? 'Gemini API Anahtarı'
                : draft.provider === 'openai'
                  ? 'OpenAI API Anahtarı'
                  : 'OpenRouter API Anahtarı'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={activeKey}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.provider === 'gemini'
                      ? { ...prev, geminiApiKey: e.target.value }
                      : prev.provider === 'openai'
                        ? { ...prev, openaiApiKey: e.target.value }
                        : { ...prev, openrouterApiKey: e.target.value },
                  )
                }
                placeholder={
                  draft.provider === 'gemini'
                    ? 'AIzaSy...'
                    : draft.provider === 'openai'
                      ? 'sk-...'
                      : 'sk-or-v1-...'
                }
                className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Anahtarlarınız Electron safeStorage ile yerel cihazınızda şifrelenerek saklanır; proje
              JSON dosyalarına dahil edilmez.
            </p>
          </div>

          {/* Custom OpenAI URL */}
          {draft.provider === 'openai' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Özel API URL (İsteğe Bağlı)
                </label>
                {draft.openaiBaseUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, openaiBaseUrl: '' }))}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Varsayılan
                  </button>
                )}
              </div>
              <input
                type="url"
                value={draft.openaiBaseUrl}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, openaiBaseUrl: e.target.value }))
                }
                placeholder="https://api.openai.com/v1/chat/completions (ör. https://api.axforge.ai/v1/chat/completions)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              {(() => {
                try {
                  const preview = resolveOpenAICompletionsUrl(draft.openaiBaseUrl);
                  return (
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      Hedef uç nokta: <span className="font-mono text-slate-700">{preview}</span>
                    </p>
                  );
                } catch (err) {
                  return (
                    <p className="text-[11px] text-red-600 mt-1">
                      {err instanceof Error ? err.message : String(err)}
                    </p>
                  );
                }
              })()}
            </div>
          )}

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">Model Seçimi</label>
            <select
              value={presets.some((m) => m.id === draft.model) ? draft.model : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setDraft((prev) => ({ ...prev, model: e.target.value }));
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {presets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="__custom__">Özel Model Kimliği Gir...</option>
            </select>

            <input
              type="text"
              value={draft.model}
              onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
              placeholder="Model adı (ör. gemini-2.5-flash, gpt-4o-mini, anthropic/claude-3.5-sonnet)"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-xs"
            />
          </div>

          {/* Chunking Params */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Parça Başına Maks. Satır
              </label>
              <input
                type="number"
                min={5}
                max={80}
                value={draft.chunkMaxLines}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    chunkMaxLines: Math.max(5, parseInt(e.target.value, 10) || 25),
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Örtüşme (Overlap) Satırı
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={draft.chunkOverlapLines}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    chunkOverlapLines: Math.max(0, Math.min(5, parseInt(e.target.value, 10) || 0)),
                  }))
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !activeKey.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-45"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlugZap className="w-3.5 h-3.5 text-indigo-600" />
            )}
            Bağlantıyı Test Et
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
