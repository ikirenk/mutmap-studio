import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Loader2,
  Settings2,
  StopCircle,
} from 'lucide-react';
import { SAMPLE_ITGB2_RAW_TEXT } from '../data/sampleITGB2';
import { useT } from '../i18n/translations';
import { splitTableIntoChunks } from '../services/ai/chunker';
import { parseMutationsLocally } from '../services/ai/localParser';
import { AIParseProgress, parseMutationsWithAI } from '../services/ai/parser';
import { useProjectStore } from '../store/useProjectStore';

export interface DataInputPanelProps {
  onOpenSettings: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DataInputPanel: React.FC<DataInputPanelProps> = ({
  onOpenSettings,
  onNotify,
}) => {
  const { t } = useT();
  const rawInputText = useProjectStore((s) => s.rawInputText);
  const setRawInputText = useProjectStore((s) => s.setRawInputText);
  const aiSettings = useProjectStore((s) => s.aiSettings);
  const setMutations = useProjectStore((s) => s.setMutations);
  const appendMutations = useProjectStore((s) => s.appendMutations);

  const [mergeMode, setMergeMode] = useState<'replace' | 'append'>('replace');
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState<AIParseProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const estimatedChunks = rawInputText.trim()
    ? splitTableIntoChunks(rawInputText, {
        maxLinesPerChunk: aiSettings.chunkMaxLines,
        overlapLines: aiSettings.chunkOverlapLines,
      }).length
    : 0;

  const hasApiKey =
    aiSettings.provider === 'gemini'
      ? Boolean(aiSettings.geminiApiKey.trim())
      : aiSettings.provider === 'openai'
        ? Boolean(aiSettings.openaiApiKey.trim())
        : Boolean(aiSettings.openrouterApiKey.trim());

  const handleAIParse = async () => {
    if (!rawInputText.trim()) {
      setErrorMsg(t.errPasteFirst);
      return;
    }

    setErrorMsg(null);
    setWarnings([]);
    setIsParsing(true);
    setProgress({ completedChunks: 0, totalChunks: Math.max(1, estimatedChunks), extractedCount: 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await parseMutationsWithAI(rawInputText, aiSettings, {
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });

      if (result.mutations.length === 0) {
        setErrorMsg(t.errAiNoRows);
      } else {
        if (mergeMode === 'replace') {
          setMutations(result.mutations);
        } else {
          appendMutations(result.mutations);
        }
        setWarnings(result.warnings);
        onNotify(t.aiParseSuccess(result.mutations.length, result.chunksProcessed), 'success');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onNotify(t.aiParseCancelled, 'info');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
      }
    } finally {
      setIsParsing(false);
      abortRef.current = null;
    }
  };

  const handleLocalParse = () => {
    setErrorMsg(null);
    setWarnings([]);
    const parsed = parseMutationsLocally(rawInputText);
    if (parsed.length === 0) {
      setErrorMsg(t.errLocalParseFailed);
      return;
    }
    if (mergeMode === 'replace') {
      setMutations(parsed);
    } else {
      appendMutations(parsed);
    }
    onNotify(t.localParseSuccess(parsed.length), 'success');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4 text-indigo-600" />
            {t.rawInputTitle}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{t.rawInputSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setRawInputText(SAMPLE_ITGB2_RAW_TEXT)}
          className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
        >
          {t.sampleRawBtn}
        </button>
      </div>

      {/* AI Status Bar */}
      <div className="px-4 py-2 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasApiKey ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-medium text-slate-700">
            {t.providerLabel}{' '}
            <strong className="text-indigo-700">
              {aiSettings.provider === 'gemini'
                ? 'Google Gemini'
                : aiSettings.provider === 'openai'
                  ? (() => {
                      const custom = aiSettings.openaiBaseUrl.trim();
                      if (!custom) return 'OpenAI';
                      try {
                        return `OpenAI (${new URL(custom).host})`;
                      } catch {
                        return `OpenAI (${t.customUrlTag})`;
                      }
                    })()
                  : 'OpenRouter'}
            </strong>{' '}
            ({aiSettings.model})
          </span>
          {estimatedChunks > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[11px] text-indigo-700">
              {t.chunksLabel(estimatedChunks)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-medium"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {hasApiKey ? t.apiSettingsBtn : t.addApiKeyBtn}
        </button>
      </div>

      {/* Textarea */}
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <textarea
          value={rawInputText}
          onChange={(e) => setRawInputText(e.target.value)}
          placeholder={t.rawInputPlaceholder}
          className="w-full flex-1 min-h-[180px] p-3 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
        />

        {progress && isParsing && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center justify-between text-xs text-indigo-900 font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t.aiParsingProgress(progress.completedChunks, progress.totalChunks)}
              </span>
              <span>{t.rowsUnit(progress.extractedCount)}</span>
            </div>
            <div className="w-full h-1.5 bg-indigo-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{
                  width: `${Math.round(
                    (progress.completedChunks / Math.max(1, progress.totalChunks)) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="mergeMode"
              checked={mergeMode === 'replace'}
              onChange={() => setMergeMode('replace')}
              className="text-indigo-600"
            />
            <span>{t.replaceTable}</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="mergeMode"
              checked={mergeMode === 'append'}
              onChange={() => setMergeMode('append')}
              className="text-indigo-600"
            />
            <span>{t.appendToTable}</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLocalParse}
            disabled={isParsing || !rawInputText.trim()}
            title={t.quickLocalParseTitle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-45"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t.quickLocalParse}
          </button>

          {isParsing ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm"
            >
              <StopCircle className="w-3.5 h-3.5" />
              {t.cancel}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAIParse}
              disabled={!rawInputText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-45"
            >
              <Bot className="w-3.5 h-3.5" />
              {t.parseWithAi}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
