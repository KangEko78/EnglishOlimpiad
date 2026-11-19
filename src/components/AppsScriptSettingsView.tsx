import { useState } from 'react';
import {
  Check,
  CloudUpload,
  Copy,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  CODE_GS_SOURCE,
  PingResult,
  pingAppsScript,
  SPREADSHEET_ID,
  SPREADSHEET_URL,
} from '../utils/appsScriptSync';

interface AppsScriptSettingsViewProps {
  webAppUrl: string;
  onSaveWebAppUrl: (url: string) => void;
  onSyncAllFromSheets: () => Promise<void>;
  onPushLocalToSheets: () => Promise<{ pushed: number; failed: number }>;
  localAttemptCount: number;
  isSyncing: boolean;
  lastSyncMessage: string | null;
}

export function AppsScriptSettingsView({
  webAppUrl,
  onSaveWebAppUrl,
  onSyncAllFromSheets,
  onPushLocalToSheets,
  localAttemptCount,
  isSyncing,
  lastSyncMessage,
}: AppsScriptSettingsViewProps) {
  const [draftUrl, setDraftUrl] = useState(webAppUrl);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pingState, setPingState] = useState<{
    loading: boolean;
    result: PingResult | null;
  }>({ loading: false, result: null });
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  const handleSaveAndTest = async () => {
    const clean = draftUrl.trim();
    onSaveWebAppUrl(clean);
    if (!clean) {
      setPingState({ loading: false, result: null });
      return;
    }
    setPingState({ loading: true, result: null });
    try {
      const res = await pingAppsScript(clean);
      setPingState({ loading: false, result: res });
    } catch (err) {
      setPingState({
        loading: false,
        result: {
          ok: false,
          error: err instanceof Error ? err.message : 'Gagal menghubungi Web App URL',
        },
      });
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(CODE_GS_SOURCE);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const shareableStudentUrl = draftUrl.trim()
    ? `${window.location.origin}${window.location.pathname}?api=${encodeURIComponent(draftUrl.trim())}`
    : '';

  const handleCopyShareLink = async () => {
    if (!shareableStudentUrl) return;
    try {
      await navigator.clipboard.writeText(shareableStudentUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handlePushLocal = async () => {
    setPushFeedback(null);
    const res = await onPushLocalToSheets();
    setPushFeedback(
      `Sinkronisasi selesai: ${res.pushed} data terkirim ke Spreadsheet${
        res.failed > 0 ? `, ${res.failed} gagal` : ''
      }.`
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs font-medium text-blue-700">
            Integrasi Database · Google Apps Script & Spreadsheet
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Database Spreadsheet & Script Code.gs
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Seluruh hasil CBT siswa otomatis disimpan ke Spreadsheet target dan ditarik ke Admin Panel melalui Google Apps Script Web App.
          </p>
        </div>

        <a
          href={SPREADSHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Database className="w-3.5 h-3.5 text-emerald-700" />
          <span>Buka Google Spreadsheet</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </section>

      {/* Spreadsheet Info + Connection Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              1. Koneksi Web App Apps Script
            </h2>
            <p className="text-xs text-slate-500">
              Spreadsheet ID aktif:{' '}
              <span className="font-mono font-semibold text-slate-800 select-all">
                {SPREADSHEET_ID}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="webapp-url" className="block text-xs font-semibold text-slate-700">
              URL Deployment Web App (berakhiran /exec)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="webapp-url"
                type="url"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleSaveAndTest}
                disabled={pingState.loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {pingState.loading ? 'Menguji...' : 'Simpan & Uji Koneksi'}
              </button>
            </div>
          </div>

          {pingState.result && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                pingState.result.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {pingState.result.ok ? (
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <TriangleAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                {pingState.result.ok ? (
                  <>
                    <div className="font-semibold">
                      Terhubung ke Spreadsheet: {pingState.result.spreadsheetName}
                    </div>
                    <div className="font-mono tabular-nums">
                      Sheet: {pingState.result.sheetName} · Tersimpan {pingState.result.rowCount} baris hasil siswa
                    </div>
                  </>
                ) : (
                  <div>
                    Koneksi gagal: {pingState.result.error}. Pastikan Web App di-deploy dengan akses{' '}
                    <strong>Anyone</strong>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!webAppUrl || isSyncing}
              onClick={onSyncAllFromSheets}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Tarik Data dari Spreadsheet
            </button>

            <button
              type="button"
              disabled={!webAppUrl || isSyncing || localAttemptCount === 0}
              onClick={handlePushLocal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Kirim Data Lokal ke Spreadsheet ({localAttemptCount})
            </button>
          </div>

          {(lastSyncMessage || pushFeedback) && (
            <p className="text-xs text-slate-600 font-medium">
              {pushFeedback ?? lastSyncMessage}
            </p>
          )}

          {/* Shareable Student Link */}
          {shareableStudentUrl && (
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Tautan Ujian Siswa (Otomatis Sinkron ke Spreadsheet)
              </div>
              <p className="text-xs text-slate-500">
                Bagikan tautan ini ke perangkat siswa agar setiap hasil CBT yang diselesaikan langsung terkirim ke Spreadsheet tanpa perlu mengatur ulang URL di tiap laptop.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableStudentUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Tersalin' : 'Salin Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Step-by-step Setup Guide */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Panduan Pemasangan Code.gs
          </h2>
          <ol className="space-y-3 text-xs sm:text-sm text-slate-600 list-decimal pl-5 leading-relaxed">
            <li>
              Buka Google Spreadsheet Anda atau kunjungi <span className="font-mono text-slate-800">script.google.com</span>.
            </li>
            <li>
              Salin seluruh skrip <span className="font-mono font-semibold text-slate-900">Code.gs</span> di bawah ini, tempel ke editor Apps Script, lalu tekan <strong className="text-slate-900">Save (Ctrl+S)</strong>.
            </li>
            <li>
              Pilih fungsi <span className="font-mono font-semibold text-slate-900">setupOlympiadSystem</span> pada dropdown toolbar lalu klik <strong className="text-slate-900">Run</strong> (sekali saja untuk izin akses & membuat sheet <span className="font-mono">Hasil_CBT</span>).
            </li>
            <li>
              Klik <strong className="text-slate-900">Deploy → New deployment → Web app</strong>. Atur <em>Execute as</em> ke <strong className="text-slate-900">Me</strong> dan <em>Who has access</em> ke <strong className="text-slate-900">Anyone</strong>.
            </li>
            <li>
              Salin URL Web App (<span className="font-mono">/exec</span>), tempel pada kolom di samping, lalu klik <strong className="text-slate-900">Simpan & Uji Koneksi</strong>.
            </li>
          </ol>
        </aside>
      </div>

      {/* Code.gs Viewer */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-mono">Code.gs</h2>
            <p className="text-xs text-slate-500">
              Otomatis membuat sheet <span className="font-mono">Hasil_CBT</span> dengan 30 kolom analitik (Skor Olimpiade, Penguasaan 7 Kisi-Kisi, LOTS/MOTS/HOTS, dan JSON Jawaban).
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? 'Code.gs Tersalin' : 'Salin Code.gs'}
          </button>
        </div>

        <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-[520px]">
          <code>{CODE_GS_SOURCE}</code>
        </pre>
      </section>
    </div>
  );
}
