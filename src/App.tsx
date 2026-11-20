import { useCallback, useEffect, useState } from 'react';
import { AdminLoginView } from './components/AdminLoginView';
import { AdminResultsView } from './components/AdminResultsView';
import { AnalyticsView } from './components/AnalyticsView';
import { AppsScriptSettingsView } from './components/AppsScriptSettingsView';
import { CbtSimulatorView } from './components/CbtSimulatorView';
import { QuestionBankView } from './components/QuestionBankView';
import { SyllabusView } from './components/SyllabusView';
import { CbtAttempt, CognitiveLevel, SyllabusDomain } from './types/olympiad';
import {
  deleteAttemptFromSheets,
  fetchAttemptsFromSheets,
  pushAttemptToSheets,
} from './utils/appsScriptSync';

type AdminTab = 'results' | 'analytics' | 'bank' | 'syllabus' | 'apps_script';

const STORAGE_ATTEMPTS_KEY = 'mgmp_banyuwangi_olympiad_2026_attempts';
const STORAGE_WEBAPP_URL_KEY = 'mgmp_banyuwangi_apps_script_url';
const STORAGE_UNSYNCED_IDS_KEY = 'smpn2kbr_unsynced_attempt_ids_v1';
const SESSION_ADMIN_AUTH_KEY = 'mgmp_banyuwangi_admin_auth';
const ENV_APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined)?.trim() ?? '';

function loadUnsyncedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_UNSYNCED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function loadStoredAttempts(): CbtAttempt[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInitialWebAppUrl(): string {
  const envFallback = (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined)?.trim() ?? '';
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('api');
    if (fromQuery && fromQuery.startsWith('https://script.google.com/')) {
      window.localStorage.setItem(STORAGE_WEBAPP_URL_KEY, fromQuery.trim());
      params.delete('api');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
      return fromQuery.trim();
    }
    return window.localStorage.getItem(STORAGE_WEBAPP_URL_KEY) || envFallback;
  } catch {
    return envFallback;
  }
}

function mergeAttempts(primary: CbtAttempt[], secondary: CbtAttempt[]): CbtAttempt[] {
  const map = new Map<string, CbtAttempt>();
  for (const item of secondary) map.set(item.id, item);
  for (const item of primary) map.set(item.id, item);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}

export default function App() {
  const [isAdminAuth, setIsAdminAuth] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(SESSION_ADMIN_AUTH_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('admin') === '1';
    } catch {
      return false;
    }
  });

  const [adminTab, setAdminTab] = useState<AdminTab>('results');

  const [attempts, setAttempts] = useState<CbtAttempt[]>(loadStoredAttempts);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(() => {
    const stored = loadStoredAttempts();
    return stored.length > 0 ? stored[0].id : null;
  });

  const [webAppUrl, setWebAppUrl] = useState<string>(loadInitialWebAppUrl);
  const [unsyncedIds, setUnsyncedIds] = useState<string[]>(loadUnsyncedIds);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const [cbtPreset, setCbtPreset] = useState<{
    domain: SyllabusDomain | 'ALL';
    level: CognitiveLevel | 'ALL';
    autoFocusMode?: 'full' | 'focused';
  } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch {
      // Ignore storage quota errors
    }
  }, [attempts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_UNSYNCED_IDS_KEY, JSON.stringify(unsyncedIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [unsyncedIds]);

  const handleSaveWebAppUrl = (url: string) => {
    setWebAppUrl(url);
    try {
      if (url) {
        window.localStorage.setItem(STORAGE_WEBAPP_URL_KEY, url);
      } else {
        window.localStorage.removeItem(STORAGE_WEBAPP_URL_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const syncFromSheets = useCallback(async () => {
    if (!webAppUrl) return;
    setIsSyncing(true);
    try {
      const remote = await fetchAttemptsFromSheets(webAppUrl);
      setAttempts((local) => {
        const merged = mergeAttempts(remote, local);
        if (!selectedAttemptId && merged.length > 0) {
          setSelectedAttemptId(merged[0].id);
        }
        return merged;
      });
      setLastSyncMessage(`Berhasil menarik ${remote.length} data hasil CBT dari Google Spreadsheet.`);
    } catch (err) {
      setLastSyncMessage(
        err instanceof Error ? err.message : 'Gagal menarik data dari Spreadsheet.'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [webAppUrl, selectedAttemptId]);

  useEffect(() => {
    if (isAdminAuth && webAppUrl) {
      void syncFromSheets();
    }
  }, [isAdminAuth, webAppUrl, syncFromSheets]);

  const handlePushLocalToSheets = async (): Promise<{ pushed: number; failed: number }> => {
    if (!webAppUrl) return { pushed: 0, failed: attempts.length };
    setIsSyncing(true);
    let pushed = 0;
    let failed = 0;
    const syncedNow: string[] = [];
    for (const att of attempts) {
      try {
        const res = await pushAttemptToSheets(webAppUrl, att);
        if (res.ok) {
          pushed += 1;
          syncedNow.push(att.id);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
    if (syncedNow.length > 0) {
      setUnsyncedIds((prev) => prev.filter((id) => !syncedNow.includes(id)));
    }
    setIsSyncing(false);
    return { pushed, failed };
  };

  const retrySingleAttempt = useCallback(
    async (
      attempt: CbtAttempt
    ): Promise<{ syncedToSheets: boolean; syncError?: string; missingUrl?: boolean }> => {
      if (!webAppUrl) {
        setUnsyncedIds((prev) => (prev.includes(attempt.id) ? prev : [attempt.id, ...prev]));
        return {
          syncedToSheets: false,
          missingUrl: true,
          syncError: 'URL Web App Apps Script belum aktif di halaman ini.',
        };
      }

      try {
        const res = await pushAttemptToSheets(webAppUrl, attempt);
        if (res.ok) {
          setUnsyncedIds((prev) => prev.filter((id) => id !== attempt.id));
          return { syncedToSheets: true };
        }
        setUnsyncedIds((prev) => (prev.includes(attempt.id) ? prev : [attempt.id, ...prev]));
        return {
          syncedToSheets: false,
          syncError: res.error || 'Apps Script menolak penyimpanan data.',
        };
      } catch (err) {
        setUnsyncedIds((prev) => (prev.includes(attempt.id) ? prev : [attempt.id, ...prev]));
        const msg =
          err instanceof Error
            ? err.name === 'AbortError'
              ? 'Koneksi ke Google Apps Script melebihi batas waktu (12 detik).'
              : err.message
            : 'Gagal terhubung ke jaringan.';
        return { syncedToSheets: false, syncError: msg };
      }
    },
    [webAppUrl]
  );

  // Auto-retry pending uploads whenever internet reconnects or webAppUrl becomes available
  useEffect(() => {
    if (!webAppUrl || unsyncedIds.length === 0) return;
    const flushPending = async () => {
      const pending = attempts.filter((a) => unsyncedIds.includes(a.id));
      for (const att of pending) {
        await retrySingleAttempt(att);
      }
    };
    void flushPending();
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [webAppUrl, unsyncedIds, attempts, retrySingleAttempt]);

  const handleCompleteAttempt = async (
    attempt: CbtAttempt
  ): Promise<{ syncedToSheets: boolean; syncError?: string; missingUrl?: boolean }> => {
    setAttempts((prev) => mergeAttempts([attempt], prev));
    setSelectedAttemptId(attempt.id);
    return retrySingleAttempt(attempt);
  };

  const handleAddManualAttempt = (attempt: CbtAttempt) => {
    void handleCompleteAttempt(attempt);
    setAdminTab('analytics');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAttempt = (id: string) => {
    setAttempts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (selectedAttemptId === id) {
        setSelectedAttemptId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
    if (webAppUrl) {
      void deleteAttemptFromSheets(webAppUrl, id).catch(() => {});
    }
  };

  const handleLoginSuccess = () => {
    setIsAdminAuth(true);
    setShowAdminLogin(false);
    setAdminTab('results');
    try {
      window.sessionStorage.setItem(SESSION_ADMIN_AUTH_KEY, '1');
    } catch {
      // Ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoutAdmin = () => {
    setIsAdminAuth(false);
    setShowAdminLogin(false);
    try {
      window.sessionStorage.removeItem(SESSION_ADMIN_AUTH_KEY);
    } catch {
      // Ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartFocusedCbtFromAdmin = (
    domain: SyllabusDomain | 'ALL',
    level: CognitiveLevel | 'ALL'
  ) => {
    setCbtPreset({ domain, level, autoFocusMode: 'focused' });
    handleLogoutAdmin();
  };

  const handleStartFullCbtFromAdmin = () => {
    setCbtPreset({ domain: 'ALL', level: 'ALL', autoFocusMode: 'full' });
    handleLogoutAdmin();
  };

  const inAdminWorkspace = isAdminAuth && !showAdminLogin;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: Student mode hides nav links while keeping Admin Panel trigger clearly visible */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => {
              if (inAdminWorkspace) {
                setAdminTab('results');
              } else {
                setShowAdminLogin(false);
              }
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            SMPN 2 Kalibaru · Olympiad CBT
          </button>

          {inAdminWorkspace ? (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {(
                [
                  ['results', 'Hasil Siswa'],
                  ['analytics', 'Analisa Kisi-Kisi'],
                  ['bank', 'Bank 100 Soal'],
                  ['syllabus', 'Kisi-Kisi Juknis'],
                  ['apps_script', 'Code.gs & DB'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAdminTab(tab)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                    adminTab === tab
                      ? 'border-blue-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          ) : (
            <div className="hidden md:block" aria-hidden="true" />
          )}

          <div className="shrink-0">
            {inAdminWorkspace ? (
              <button
                type="button"
                onClick={handleLogoutAdmin}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Keluar Admin
              </button>
            ) : showAdminLogin ? (
              <button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kembali ke CBT
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminLogin(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Admin Panel
              </button>
            )}
          </div>
        </div>

        {inAdminWorkspace && (
          <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
            {(
              [
                ['results', 'Hasil Siswa'],
                ['analytics', 'Analisa Kisi-Kisi'],
                ['bank', 'Bank 100 Soal'],
                ['syllabus', 'Kisi-Kisi'],
                ['apps_script', 'Code.gs'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAdminTab(tab)}
                className={`py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  adminTab === tab ? 'text-blue-700 font-semibold' : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {showAdminLogin ? (
          <AdminLoginView
            onSuccess={handleLoginSuccess}
            onBackToStudent={() => setShowAdminLogin(false)}
          />
        ) : inAdminWorkspace ? (
          <>
            {adminTab === 'results' && (
              <AdminResultsView
                attempts={attempts}
                webAppUrl={webAppUrl}
                isSyncing={isSyncing}
                onSyncFromSheets={syncFromSheets}
                onInspectAttempt={(id) => {
                  setSelectedAttemptId(id);
                  setAdminTab('analytics');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDeleteAttempt={handleDeleteAttempt}
                onAddManualAttempt={handleAddManualAttempt}
                onGoToAppsScript={() => setAdminTab('apps_script')}
                onLaunchDrill={handleStartFocusedCbtFromAdmin}
              />
            )}
            {adminTab === 'analytics' && (
              <AnalyticsView
                attempts={attempts}
                selectedAttemptId={selectedAttemptId}
                onSelectAttempt={setSelectedAttemptId}
                onDeleteAttempt={handleDeleteAttempt}
                onAddManualAttempt={handleAddManualAttempt}
                onGoToResults={() => setAdminTab('results')}
                onLaunchDrill={handleStartFocusedCbtFromAdmin}
              />
            )}
            {adminTab === 'bank' && (
              <QuestionBankView onStartFocusedCbt={handleStartFocusedCbtFromAdmin} />
            )}
            {adminTab === 'syllabus' && (
              <SyllabusView
                onStartFullCbt={handleStartFullCbtFromAdmin}
                onBrowseBank={() => setAdminTab('bank')}
              />
            )}
            {adminTab === 'apps_script' && (
              <AppsScriptSettingsView
                webAppUrl={webAppUrl}
                envWebAppUrl={ENV_APPS_SCRIPT_URL}
                onSaveWebAppUrl={handleSaveWebAppUrl}
                onSyncAllFromSheets={syncFromSheets}
                onPushLocalToSheets={handlePushLocalToSheets}
                localAttemptCount={attempts.length}
                isSyncing={isSyncing}
                lastSyncMessage={lastSyncMessage}
              />
            )}
          </>
        ) : (
          <CbtSimulatorView
            initialPreset={cbtPreset}
            isAdminMode={false}
            onCompleteAttempt={handleCompleteAttempt}
            onRetrySyncAttempt={retrySingleAttempt}
          />
        )}
      </main>

      {/* Quiet Footer with discreet Admin Panel access */}
      <footer className="border-t border-slate-200 bg-white no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Pembinaan Olimpiade Bahasa Inggris · SMP Negeri 2 Kalibaru (Standar Juknis 2026)</span>
          <div className="flex items-center gap-4">
            <span className="font-mono tabular-nums">100 Soal Penyisihan · Skor +4 / -1 / 0</span>
            {!inAdminWorkspace && !showAdminLogin && (
              <button
                type="button"
                onClick={() => setShowAdminLogin(true)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Admin Panel
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
