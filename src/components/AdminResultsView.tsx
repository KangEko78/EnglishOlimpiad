import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Lightbulb,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { analyzeAttempt, QUESTION_BANK } from '../data/questionBank';
import {
  CbtAttempt,
  CognitiveLevel,
  OptionKey,
  StudentProfile,
  SyllabusDomain,
} from '../types/olympiad';
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
  onLaunchDrill: (domain: SyllabusDomain | 'ALL', level: CognitiveLevel | 'ALL') => void;
}

type TriageFilter = 'ALL' | 'READY' | 'POTENTIAL' | 'BASIC';

export function AdminResultsView({
  attempts,
  webAppUrl,
  isSyncing,
  onSyncFromSheets,
  onInspectAttempt,
  onDeleteAttempt,
  onAddManualAttempt,
  onGoToAppsScript,
  onLaunchDrill,
}: AdminResultsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      .map((attempt) => {
        const analysis = analyzeAttempt(attempt);
        const sortedDomains = [...analysis.domainBreakdown].sort(
          (a, b) => a.accuracyPercent - b.accuracyPercent
        );
        const weakest = sortedDomains[0] ?? null;

        let triageGroup: Exclude<TriageFilter, 'ALL'> = 'BASIC';
        if (analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)') {
          triageGroup = 'READY';
        } else if (
          analysis.readinessTier === 'Kompetitif (Potensi Lolos)' ||
          analysis.readinessTier === 'Perlu Penguatan Intensif'
        ) {
          triageGroup = 'POTENTIAL';
        }

        return {
          attempt,
          analysis,
          weakest,
          triageGroup,
        };
      })
      .sort((a, b) => b.analysis.netScore - a.analysis.netScore);
  }, [attempts]);

  const cohortStats = useMemo(() => {
    if (enrichedRows.length === 0) {
      return {
        totalStudents: 0,
        avgNetScore: 0,
        avgReadiness: 0,
        readyCount: 0,
        potentialCount: 0,
        basicCount: 0,
        weakestDomain: '-',
      };
    }

    const totalStudents = enrichedRows.length;
    const sumNet = enrichedRows.reduce((acc, r) => acc + r.analysis.netScore, 0);
    const sumReady = enrichedRows.reduce((acc, r) => acc + r.analysis.normalizedPercent, 0);
    const readyCount = enrichedRows.filter((r) => r.triageGroup === 'READY').length;
    const potentialCount = enrichedRows.filter((r) => r.triageGroup === 'POTENTIAL').length;
    const basicCount = enrichedRows.filter((r) => r.triageGroup === 'BASIC').length;

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
      potentialCount,
      basicCount,
      weakestDomain,
    };
  }, [enrichedRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRows.filter(({ attempt, triageGroup }) => {
      if (triageFilter !== 'ALL' && triageGroup !== triageFilter) return false;
      if (!q) return true;
      return (
        attempt.student.name.toLowerCase().includes(q) ||
        attempt.student.school.toLowerCase().includes(q) ||
        attempt.configTitle.toLowerCase().includes(q)
      );
    });
  }, [enrichedRows, searchQuery, triageFilter]);

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
      'Materi Terlemah',
      'LOTS (%)',
      'MOTS (%)',
      'HOTS (%)',
    ];
    const rows = filteredRows.map(({ attempt, analysis, weakest }, index) => {
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
        weakest ? `${weakest.domain} (${weakest.accuracyPercent}%)` : '-',
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-700">
            Admin Panel · Rekapitulasi Peringkat & Keputusan Pembimbing
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Hasil CBT Siswa & Pemetaan Tindakan Pembinaan
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Lihat langsung pengelompokan kesiapan peserta, kisi-kisi terlemah tiap siswa, dan tindak lanjuti dengan sesi latihan terfokus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {webAppUrl ? (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncFromSheets}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sinkron Spreadsheet
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToAppsScript}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100/70 cursor-pointer whitespace-nowrap shrink-0"
            >
              Hubungkan Apps Script
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Input LJK Manual
          </button>

          <button
            type="button"
            disabled={filteredRows.length === 0}
            onClick={handleExportResultsCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Rekap CSV
          </button>
        </div>
      </section>

      {/* Cohort KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Hasil Peserta',
            val: `${cohortStats.totalStudents} Siswa`,
            sub: webAppUrl ? 'Tersambung ke Spreadsheet' : 'Penyimpanan lokal browser',
            cls: 'text-slate-900',
          },
          {
            label: 'Rata-Rata Skor & Kesiapan',
            val: `${cohortStats.avgNetScore} poin (${cohortStats.avgReadiness}%)`,
            sub: 'Berdasarkan bobot +4 / -1 / 0',
            cls: 'text-slate-900',
          },
          {
            label: 'Siap Utus (Target Top 25)',
            val: `${cohortStats.readyCount} Siswa`,
            sub: 'Kesiapan ≥ 70% & HOTS ≥ 60%',
            cls: 'text-emerald-700',
          },
          {
            label: 'Kisi-Kisi Terlemah Klasikal',
            val: cohortStats.weakestDomain,
            sub: 'Prioritas penguatan pembinaan',
            cls: 'text-rose-700',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04 }}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <div className="text-xs font-medium text-slate-500">{card.label}</div>
            <div className={`mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums truncate ${card.cls}`}>
              {card.val}
            </div>
            <div className="mt-1 text-xs text-slate-500">{card.sub}</div>
          </motion.div>
        ))}
      </section>

      {/* Coach Triage Decision Cards (Click to filter cohort) */}
      {enrichedRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Keputusan Cepat Pembimbing (Klik Kelompok untuk Menyaring Daftar)
            </h2>
            {triageFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setTriageFilter('ALL')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Tampilkan Semua Peserta
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setTriageFilter((f) => (f === 'READY' ? 'ALL' : 'READY'))}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                triageFilter === 'READY'
                  ? 'bg-emerald-50/70 border-emerald-500'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">1. Siap Utus Lomba</span>
                <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                  {cohortStats.readyCount} Siswa
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Layak didaftarkan sebagai kontingen utama. Fokuskan pembinaan pada kecepatan 120 menit & Listening Test final.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter((f) => (f === 'POTENTIAL' ? 'ALL' : 'POTENTIAL'))}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                triageFilter === 'POTENTIAL'
                  ? 'bg-amber-50/70 border-amber-500'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700">2. Potensial (Poles Materi)</span>
                <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                  {cohortStats.potentialCount} Siswa
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Berpeluang lolos jika mengurangi tebakan salah (-1) serta menguatkan 1–2 kisi-kisi terlemahnya.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter((f) => (f === 'BASIC' ? 'ALL' : 'BASIC'))}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                triageFilter === 'BASIC'
                  ? 'bg-rose-50/70 border-rose-500'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700">3. Pendampingan Dasar</span>
                <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                  {cohortStats.basicCount} Siswa
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Perlu penguatan fondasi kosakata LOTS & tata bahasa dasar sebelum mengikuti tryout penuh 100 soal.
              </p>
            </button>
          </div>
        </section>
      )}

      {/* Filters & Results */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa atau asal sekolah..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-500">
            Menampilkan {filteredRows.length} dari {enrichedRows.length} peserta
          </div>
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
              Siswa dapat mengerjakan simulasi dari halaman depan, atau Anda dapat menginput jawaban LJK manual serta menyinkronkan data dari Google Spreadsheet.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 font-mono">#</th>
                    <th className="py-3 px-4">Peserta & Sekolah</th>
                    <th className="py-3 px-4">Kisi-Kisi Terlemah</th>
                    <th className="py-3 px-4 text-right font-mono">B / S / K</th>
                    <th className="py-3 px-4 text-right font-mono">Skor</th>
                    <th className="py-3 px-4 text-right font-mono">Kesiapan</th>
                    <th className="py-3 px-4">Rekomendasi Status</th>
                    <th className="py-3 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredRows.map(({ attempt, analysis, weakest }, idx) => {
                    const isExpanded = expandedId === attempt.id;
                    const tierColor =
                      analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
                        ? 'text-emerald-700'
                        : analysis.readinessTier === 'Kompetitif (Potensi Lolos)'
                        ? 'text-blue-700'
                        : analysis.readinessTier === 'Perlu Penguatan Intensif'
                        ? 'text-amber-700'
                        : 'text-rose-700';

                    return (
                      <Fragment key={attempt.id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId((prev) => (prev === attempt.id ? null : attempt.id))
                              }
                              className="text-left group cursor-pointer"
                            >
                              <div className="font-semibold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5">
                                <span>{attempt.student.name}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {attempt.student.school} · Kelas {attempt.student.grade} · {formatTimer(attempt.durationUsedSeconds)}
                              </div>
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            {weakest ? (
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  {weakest.domain}
                                </div>
                                <div className="text-xs font-mono tabular-nums text-rose-700">
                                  Akurasi {weakest.accuracyPercent}% ({weakest.correct}/{weakest.total})
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer whitespace-nowrap shrink-0"
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

                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={8} className="px-6 py-4">
                              <AnimatePresence>
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="grid grid-cols-1 xl:grid-cols-12 gap-5"
                                >
                                  <div className="xl:col-span-7 space-y-2.5">
                                    <div className="text-xs font-semibold text-slate-900">
                                      Penguasaan 7 Kisi-Kisi ({attempt.student.name})
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                      {analysis.domainBreakdown.map((d) => (
                                        <div
                                          key={d.domain}
                                          className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1"
                                        >
                                          <div className="text-[11px] font-medium text-slate-600 truncate">
                                            {d.domain}
                                          </div>
                                          <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                            {d.accuracyPercent}%
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="xl:col-span-5 space-y-3">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Saran Keputusan Pembimbing</span>
                                    </div>
                                    <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                                      {analysis.recommendations.map((rec, rIdx) => (
                                        <li key={rIdx} className="flex items-start gap-2">
                                          <span className="font-mono font-bold text-blue-700">
                                            0{rIdx + 1}.
                                          </span>
                                          <span>{rec}</span>
                                        </li>
                                      ))}
                                    </ul>
                                    {weakest && (
                                      <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => onLaunchDrill(weakest.domain, 'ALL')}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                                        >
                                          <Play className="w-3 h-3" />
                                          Latih Materi Terlemah ({weakest.domain})
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </AnimatePresence>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Responsive Cards */}
            <div className="lg:hidden divide-y divide-slate-200">
              {filteredRows.map(({ attempt, analysis, weakest }, idx) => {
                const isExpanded = expandedId === attempt.id;
                const tierColor =
                  analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
                    ? 'text-emerald-700'
                    : analysis.readinessTier === 'Kompetitif (Potensi Lolos)'
                    ? 'text-blue-700'
                    : analysis.readinessTier === 'Perlu Penguatan Intensif'
                    ? 'text-amber-700'
                    : 'text-rose-700';

                return (
                  <div key={attempt.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">#{idx + 1}</span>
                          <span className="font-semibold text-slate-900">{attempt.student.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {attempt.student.school} · Kelas {attempt.student.grade}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {analysis.netScore}/{analysis.maxScore}
                        </div>
                        <div className="font-mono tabular-nums text-xs text-blue-700 font-semibold">
                          {analysis.normalizedPercent}%
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className={`font-semibold ${tierColor}`}>{analysis.readinessTier}</span>
                      {weakest && (
                        <span className="text-rose-700 font-medium">
                          Terlemah: {weakest.domain} ({weakest.accuracyPercent}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === attempt.id ? null : attempt.id))
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Tutup Saran' : 'Lihat Kisi-Kisi & Saran'}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectAttempt(attempt.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          Analisa Lengkap
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAttempt(attempt.id)}
                          aria-label="Hapus hasil"
                          className="p-1.5 text-slate-400 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50 rounded-lg p-3.5 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {analysis.domainBreakdown.map((d) => (
                            <div key={d.domain} className="bg-white border border-slate-200 rounded-md p-2">
                              <div className="text-[11px] text-slate-500 truncate">{d.domain}</div>
                              <div className="text-xs font-mono font-bold text-slate-900">
                                {d.accuracyPercent}%
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-900">Saran Pembinaan:</div>
                          <ul className="space-y-1 text-xs text-slate-700">
                            {analysis.recommendations.map((rec, rIdx) => (
                              <li key={rIdx}>
                                <strong className="font-mono text-blue-700">0{rIdx + 1}.</strong> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {weakest && (
                          <button
                            type="button"
                            onClick={() => onLaunchDrill(weakest.domain, 'ALL')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-md cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            Latih {weakest.domain}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
    </motion.div>
  );
}
