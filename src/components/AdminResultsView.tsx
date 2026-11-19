import { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { analyzeAttempt, QUESTION_BANK } from '../data/questionBank';
import { CbtAttempt, OptionKey, StudentProfile } from '../types/olympiad';
import { formatTimer } from '../utils/exportQuestions';

interface AdminResultsViewProps {
  attempts: CbtAttempt[];
  webAppUrl: string;
  isSyncing: boolean;
  onSyncFromSheets: () => Promise<void>;
  onInspectAttempt: (attemptId: string) => void;
  onDeleteAttempt: (attemptId: string) => void;
  onAddManualAttempt: (attempt: CbtAttempt) => void;
  onGoToAppsScript: () => void;
}

export function AdminResultsView({
  attempts,
  webAppUrl,
  isSyncing,
  onSyncFromSheets,
  onInspectAttempt,
  onDeleteAttempt,
  onAddManualAttempt,
  onGoToAppsScript,
}: AdminResultsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [showManualModal, setShowManualModal] = useState(false);

  const [manualStudent, setManualStudent] = useState<StudentProfile>({
    name: '',
    school: '',
    grade: '8',
  });
  const [manualRawAnswers, setManualRawAnswers] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const enrichedRows = useMemo(() => {
    return attempts
      .map((attempt) => ({
        attempt,
        analysis: analyzeAttempt(attempt),
      }))
      .sort((a, b) => b.analysis.netScore - a.analysis.netScore);
  }, [attempts]);

  const cohortStats = useMemo(() => {
    if (enrichedRows.length === 0) {
      return {
        totalStudents: 0,
        avgNetScore: 0,
        avgReadiness: 0,
        readyCount: 0,
        weakestDomain: '-',
      };
    }

    const totalStudents = enrichedRows.length;
    const sumNet = enrichedRows.reduce((acc, r) => acc + r.analysis.netScore, 0);
    const sumReady = enrichedRows.reduce((acc, r) => acc + r.analysis.normalizedPercent, 0);
    const readyCount = enrichedRows.filter(
      (r) => r.analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
    ).length;

    const domainTotals: Record<string, { sumAcc: number; count: number }> = {};
    for (const r of enrichedRows) {
      for (const d of r.analysis.domainBreakdown) {
        if (!domainTotals[d.domain]) domainTotals[d.domain] = { sumAcc: 0, count: 0 };
        domainTotals[d.domain].sumAcc += d.accuracyPercent;
        domainTotals[d.domain].count += 1;
      }
    }

    let weakestDomain = '-';
    let minAvg = Infinity;
    for (const [domain, val] of Object.entries(domainTotals)) {
      const avg = val.sumAcc / val.count;
      if (avg < minAvg) {
        minAvg = avg;
        weakestDomain = `${domain} (${Math.round(avg)}%)`;
      }
    }

    return {
      totalStudents,
      avgNetScore: Math.round(sumNet / totalStudents),
      avgReadiness: Math.round(sumReady / totalStudents),
      readyCount,
      weakestDomain,
    };
  }, [enrichedRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRows.filter(({ attempt, analysis }) => {
      if (tierFilter !== 'ALL' && analysis.readinessTier !== tierFilter) return false;
      if (!q) return true;
      return (
        attempt.student.name.toLowerCase().includes(q) ||
        attempt.student.school.toLowerCase().includes(q) ||
        attempt.configTitle.toLowerCase().includes(q)
      );
    });
  }, [enrichedRows, searchQuery, tierFilter]);

  const handleExportResultsCsv = () => {
    const headers = [
      'Peringkat',
      'Nama Siswa',
      'Sekolah',
      'Kelas',
      'Paket Ujian',
      'Benar',
      'Salah',
      'Kosong',
      'Skor Olimpiade',
      'Skor Maks',
      'Kesiapan (%)',
      'Kategori Kesiapan',
      'LOTS (%)',
      'MOTS (%)',
      'HOTS (%)',
    ];
    const rows = filteredRows.map(({ attempt, analysis }, index) => {
      const lots = analysis.cognitiveBreakdown.find((c) => c.level === 'LOTS')?.accuracyPercent ?? 0;
      const mots = analysis.cognitiveBreakdown.find((c) => c.level === 'MOTS')?.accuracyPercent ?? 0;
      const hots = analysis.cognitiveBreakdown.find((c) => c.level === 'HOTS')?.accuracyPercent ?? 0;
      return [
        index + 1,
        attempt.student.name,
        attempt.student.school,
        attempt.student.grade,
        attempt.configTitle,
        analysis.correctCount,
        analysis.wrongCount,
        analysis.unansweredCount,
        analysis.netScore,
        analysis.maxScore,
        analysis.normalizedPercent,
        analysis.readinessTier,
        lots,
        mots,
        hots,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rekap-hasil-olimpiade-2026.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEvaluateManual = () => {
    if (!manualStudent.name.trim() || !manualStudent.school.trim()) {
      setManualError('Isi Nama Siswa dan Asal Sekolah terlebih dahulu.');
      return;
    }
    const cleaned = manualRawAnswers.trim().toUpperCase();
    if (!cleaned) {
      setManualError('Masukkan deretan jawaban siswa (A/B/C/D atau - untuk kosong).');
      return;
    }

    const parsedAnswers: Record<number, OptionKey> = {};
    if (cleaned.includes(':')) {
      const pairs = cleaned.split(/[\s,;]+/).filter(Boolean);
      for (const pair of pairs) {
        const match = pair.match(/^(\d+)[:.]([A-D])$/);
        if (match) {
          const qNum = Number(match[1]);
          if (qNum >= 1 && qNum <= 100) parsedAnswers[qNum] = match[2] as OptionKey;
        }
      }
    } else {
      const tokens =
        cleaned.includes(',') || cleaned.includes(' ')
          ? cleaned.split(/[\s,]+/).filter(Boolean)
          : cleaned.split('');
      tokens.forEach((tok, idx) => {
        const qNum = idx + 1;
        if (qNum <= 100 && (tok === 'A' || tok === 'B' || tok === 'C' || tok === 'D')) {
          parsedAnswers[qNum] = tok;
        }
      });
    }

    const newAttempt: CbtAttempt = {
      id: `manual-${Date.now()}`,
      student: {
        name: manualStudent.name.trim(),
        school: manualStudent.school.trim(),
        grade: manualStudent.grade,
      },
      mode: 'full_preliminary',
      configTitle: 'Evaluasi Jawaban LJK / CBT Eksternal (100 Soal)',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationUsedSeconds: 7200,
      totalQuestions: 100,
      questionIds: QUESTION_BANK.map((q) => q.id),
      answers: parsedAnswers,
      flaggedIds: [],
    };

    onAddManualAttempt(newAttempt);
    setShowManualModal(false);
    setManualRawAnswers('');
    setManualError(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-700">
            Admin Panel · Rekapitulasi Peringkat & Kesiapan Peserta
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Hasil CBT Siswa & Pemetaan Kesiapan
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Pantau peringkat nilai Olimpiade (+4 / -1 / 0), tarik data dari Google Spreadsheet, atau klik Analisa untuk menelaah penguasaan kisi-kisi tiap siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {webAppUrl ? (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncFromSheets}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sinkron Spreadsheet
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToAppsScript}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100/70 cursor-pointer"
            >
              Hubungkan Apps Script
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Input LJK Manual
          </button>

          <button
            type="button"
            disabled={filteredRows.length === 0}
            onClick={handleExportResultsCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Rekap CSV
          </button>
        </div>
      </section>

      {/* Cohort KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Hasil Peserta</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {cohortStats.totalStudents} Siswa
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {webAppUrl ? 'Tersambung ke Spreadsheet' : 'Penyimpanan lokal browser'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Rata-Rata Skor & Kesiapan</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {cohortStats.avgNetScore} poin ({cohortStats.avgReadiness}%)
          </div>
          <div className="mt-1 text-xs text-slate-500">Berdasarkan bobot +4 / -1 / 0</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Kategori Target Top 25 Finalis</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {cohortStats.readyCount} Siswa
          </div>
          <div className="mt-1 text-xs text-slate-500">Kesiapan ≥ 70% & HOTS ≥ 60%</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Kisi-Kisi Terlemah Klasikal</div>
          <div className="mt-2 text-lg font-bold text-rose-700 truncate">
            {cohortStats.weakestDomain}
          </div>
          <div className="mt-1 text-xs text-slate-500">Prioritas penguatan pembinaan</div>
        </div>
      </section>

      {/* Filters & Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa atau asal sekolah..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="ALL">Semua Kategori Kesiapan</option>
            <option value="Sangat Siap (Target Top 25 Finalis)">Sangat Siap (Target Top 25 Finalis)</option>
            <option value="Kompetitif (Potensi Lolos)">Kompetitif (Potensi Lolos)</option>
            <option value="Perlu Penguatan Intensif">Perlu Penguatan Intensif</option>
            <option value="Pembinaan Dasar">Pembinaan Dasar</option>
          </select>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              Belum ada data hasil CBT siswa
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Siswa dapat mengerjakan simulasi dari Mode Siswa, atau Anda dapat menginput jawaban LJK manual dan menarik data dari Google Spreadsheet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 font-mono">#</th>
                  <th className="py-3 px-4">Peserta & Sekolah</th>
                  <th className="py-3 px-4">Paket Ujian</th>
                  <th className="py-3 px-4 text-right font-mono">B / S / K</th>
                  <th className="py-3 px-4 text-right font-mono">Skor</th>
                  <th className="py-3 px-4 text-right font-mono">Kesiapan</th>
                  <th className="py-3 px-4">Status Olimpiade</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredRows.map(({ attempt, analysis }, idx) => {
                  const tierColor =
                    analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
                      ? 'text-emerald-700'
                      : analysis.readinessTier === 'Kompetitif (Potensi Lolos)'
                      ? 'text-blue-700'
                      : analysis.readinessTier === 'Perlu Penguatan Intensif'
                      ? 'text-amber-700'
                      : 'text-rose-700';

                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{attempt.student.name}</div>
                        <div className="text-xs text-slate-500">
                          {attempt.student.school} · Kelas {attempt.student.grade}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800 max-w-[200px] truncate">
                          {attempt.configTitle}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-400">
                          Durasi {formatTimer(attempt.durationUsedSeconds)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                        <span className="text-emerald-700 font-semibold">{analysis.correctCount}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-rose-700 font-semibold">{analysis.wrongCount}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-slate-600">{analysis.unansweredCount}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {analysis.netScore}
                        <span className="text-xs font-normal text-slate-400">/{analysis.maxScore}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {analysis.normalizedPercent}%
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-semibold ${tierColor}`}>
                          {analysis.readinessTier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectAttempt(attempt.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            Analisa
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAttempt(attempt.id)}
                            aria-label="Hapus hasil"
                            className="p-1.5 text-slate-400 hover:text-rose-700 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Manual LJK Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                Koreksi Jawaban LJK / CBT Eksternal (100 Soal)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tempelkan jawaban siswa dari ujian kertas (PBT) atau CBT luar untuk disimpan ke rekap hasil dan Spreadsheet.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Nama Siswa</label>
                <input
                  type="text"
                  value={manualStudent.name}
                  onChange={(e) => setManualStudent((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Nama siswa"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Asal Sekolah</label>
                <input
                  type="text"
                  value={manualStudent.school}
                  onChange={(e) => setManualStudent((s) => ({ ...s, school: e.target.value }))}
                  placeholder="SMP/MTs"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Kelas</label>
                <select
                  value={manualStudent.grade}
                  onChange={(e) =>
                    setManualStudent((s) => ({ ...s, grade: e.target.value as '7' | '8' | '9' }))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Deretan Jawaban (Nomor 1–100)
              </label>
              <textarea
                rows={4}
                value={manualRawAnswers}
                onChange={(e) => setManualRawAnswers(e.target.value)}
                placeholder="Format berurutan: B,A,B,C,-,... atau BABC-B... (gunakan - untuk kosong), atau format bernomor: 1:B, 2:A"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {manualError && <p className="text-xs text-rose-700 font-medium">{manualError}</p>}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setManualError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEvaluateManual}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                Simpan & Analisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
