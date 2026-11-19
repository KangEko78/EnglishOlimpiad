import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Filter,
  Lightbulb,
  Play,
  Printer,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { analyzeAttempt, QUESTION_BANK, QUESTION_BY_ID } from '../data/questionBank';
import {
  CbtAttempt,
  CognitiveLevel,
  JUKNIS_CONSTANTS,
  OptionKey,
  StudentProfile,
  SYLLABUS_BLUEPRINT,
  SyllabusDomain,
} from '../types/olympiad';
import { formatTimer } from '../utils/exportQuestions';

interface AnalyticsViewProps {
  attempts: CbtAttempt[];
  selectedAttemptId: string | null;
  onSelectAttempt: (id: string) => void;
  onDeleteAttempt: (id: string) => void;
  onAddManualAttempt: (attempt: CbtAttempt) => void;
  onGoToResults: () => void;
  onLaunchDrill: (domain: SyllabusDomain | 'ALL', level: CognitiveLevel | 'ALL') => void;
}

type ReviewFilter = 'ALL' | 'WRONG' | 'HOTS' | 'UNANSWERED';
type ScopeMode = 'individual' | 'cohort';

export function AnalyticsView({
  attempts,
  selectedAttemptId,
  onSelectAttempt,
  onDeleteAttempt,
  onAddManualAttempt,
  onGoToResults,
  onLaunchDrill,
}: AnalyticsViewProps) {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('individual');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('ALL');
  const [domainFilter, setDomainFilter] = useState<SyllabusDomain | 'ALL'>('ALL');
  const [showManualModal, setShowManualModal] = useState(false);

  const [manualStudent, setManualStudent] = useState<StudentProfile>({
    name: '',
    school: JUKNIS_CONSTANTS.SCHOOL_NAME,
    grade: '8',
  });
  const [manualRawAnswers, setManualRawAnswers] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const activeAttempt = useMemo(() => {
    if (attempts.length === 0) return null;
    return attempts.find((a) => a.id === selectedAttemptId) ?? attempts[0];
  }, [attempts, selectedAttemptId]);

  const analysis = useMemo(() => {
    if (!activeAttempt) return null;
    return analyzeAttempt(activeAttempt);
  }, [activeAttempt]);

  const cohortAnalysis = useMemo(() => {
    if (attempts.length === 0) return null;
    const allAnalyses = attempts.map((a) => analyzeAttempt(a));

    const domainAgg = SYLLABUS_BLUEPRINT.map((bp) => {
      let totalCorrect = 0;
      let totalItems = 0;
      let totalWrong = 0;
      let readyCount = 0;
      let participatingAttempts = 0;

      for (const res of allAnalyses) {
        const found = res.domainBreakdown.find((d) => d.domain === bp.domain);
        if (found) {
          participatingAttempts += 1;
          totalCorrect += found.correct;
          totalWrong += found.wrong;
          totalItems += found.total;
          if (found.accuracyPercent >= 75) readyCount += 1;
        }
      }

      const avgAccuracy = totalItems > 0 ? Math.round((totalCorrect / totalItems) * 100) : 0;
      let status: 'Siap' | 'Perlu Penguatan' | 'Prioritas Remedial' = 'Siap';
      if (avgAccuracy < 50) status = 'Prioritas Remedial';
      else if (avgAccuracy < 75) status = 'Perlu Penguatan';

      return {
        domain: bp.domain as SyllabusDomain,
        participatingAttempts,
        totalItems,
        totalCorrect,
        totalWrong,
        avgAccuracy,
        readyCount,
        status,
      };
    });

    const cogAgg = (['LOTS', 'MOTS', 'HOTS'] as CognitiveLevel[]).map((level) => {
      let totalCorrect = 0;
      let totalItems = 0;
      for (const res of allAnalyses) {
        const found = res.cognitiveBreakdown.find((c) => c.level === level);
        if (found) {
          totalCorrect += found.correct;
          totalItems += found.total;
        }
      }
      const avgAccuracy = totalItems > 0 ? Math.round((totalCorrect / totalItems) * 100) : 0;
      return { level, totalCorrect, totalItems, avgAccuracy };
    });

    const tierCounts = {
      sangatSiap: allAnalyses.filter((a) => a.readinessTier === 'Sangat Siap (Target Top 25 Finalis)').length,
      kompetitif: allAnalyses.filter((a) => a.readinessTier === 'Kompetitif (Potensi Lolos)').length,
      penguatan: allAnalyses.filter((a) => a.readinessTier === 'Perlu Penguatan Intensif').length,
      dasar: allAnalyses.filter((a) => a.readinessTier === 'Pembinaan Dasar').length,
    };

    // Generate actionable cohort recommendations
    const cohortRecommendations: string[] = [];
    const avgPenaltyLost = Math.round(
      allAnalyses.reduce((acc, a) => acc + a.penaltyLostPoints, 0) / allAnalyses.length
    );
    const lotsAvg = cogAgg.find((c) => c.level === 'LOTS')?.avgAccuracy ?? 0;
    const motsAvg = cogAgg.find((c) => c.level === 'MOTS')?.avgAccuracy ?? 0;
    const hotsAvg = cogAgg.find((c) => c.level === 'HOTS')?.avgAccuracy ?? 0;

    if (avgPenaltyLost >= 10) {
      cohortRecommendations.push(
        `Manajemen Risiko Penalti (-1): Rata-rata peserta kehilangan ${avgPenaltyLost} poin akibat jawaban salah. Adakan simulasi strategi "skip soal ragu" (0 poin) pada pembinaan berikutnya.`
      );
    }
    if (lotsAvg >= 70 && hotsAvg < 55) {
      cohortRecommendations.push(
        `Fokus Penalaran HOTS (LOTS ${lotsAvg}% vs HOTS ${hotsAvg}%): Kelas sudah memahami teks literal, namun masih kesulitan pada inferensi implisit, sintesis dua premis, dan inversi/error recognition.`
      );
    } else if (lotsAvg < 65) {
      cohortRecommendations.push(
        `Penguatan Fondasi Dasar (LOTS ${lotsAvg}% & MOTS ${motsAvg}%): Perbanyak drill kosakata akademik SMP kelas 7–9 dan pola kalimat dasar sebelum menargetkan soal HOTS.`
      );
    }

    const weakCohortDomains = domainAgg
      .filter((d) => d.participatingAttempts > 0 && d.avgAccuracy < 65)
      .sort((a, b) => a.avgAccuracy - b.avgAccuracy);

    if (weakCohortDomains.length > 0) {
      const names = weakCohortDomains
        .slice(0, 3)
        .map((d) => `${d.domain} (${d.avgAccuracy}%)`)
        .join(', ');
      cohortRecommendations.push(
        `Agenda Klinik Materi Terlemah: Prioritaskan sesi bedah soal bersama pada domain ${names}.`
      );
    }

    if (cohortRecommendations.length === 0) {
      cohortRecommendations.push(
        'Kesiapan klasikal sangat baik di semua domain kisi-kisi. Lanjutkan ke latihan intensif Babak Final (Listening Test 20 soal) dan manajemen waktu 120 menit.'
      );
    }

    return {
      participantCount: attempts.length,
      domainAgg,
      cogAgg,
      tierCounts,
      cohortRecommendations,
    };
  }, [attempts]);

  const reviewQuestions = useMemo(() => {
    if (!activeAttempt) return [];
    return activeAttempt.questionIds
      .map((id) => QUESTION_BY_ID[id])
      .filter((q) => {
        if (!q) return false;
        if (domainFilter !== 'ALL' && q.domain !== domainFilter) return false;
        const picked = activeAttempt.answers[q.id];
        if (reviewFilter === 'WRONG') return Boolean(picked) && picked !== q.correctAnswer;
        if (reviewFilter === 'HOTS') return q.cognitiveLevel === 'HOTS';
        if (reviewFilter === 'UNANSWERED') return !picked;
        return true;
      });
  }, [activeAttempt, reviewFilter, domainFilter]);

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
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-700">
            Admin Panel {JUKNIS_CONSTANTS.SCHOOL_NAME} · Diagnostik Kisi-Kisi & Kesiapan (+4 / -1 / 0)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Analisa Kemampuan, Kesiapan & Saran Pembinaan
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Klik pada baris kisi-kisi atau level kognitif untuk memfilter butir soal secara interaktif dan temukan prioritas pembinaan siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setScopeMode('individual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scopeMode === 'individual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analisa Per Siswa
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('cohort')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scopeMode === 'cohort'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agregat Klasikal ({attempts.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Input LJK Manual
          </button>
        </div>
      </section>

      {/* Empty State */}
      {!activeAttempt || !analysis || !cohortAnalysis ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4"
        >
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900">
              Belum Ada Data Pengerjaan Siswa
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Setelah siswa menyelesaikan ujian di Halaman CBT (atau data ditarik dari Google Spreadsheet), analisa kesiapan per kisi-kisi dan saran pembinaan otomatis akan tampil di sini.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onGoToResults}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
            >
              Buka Tabel Hasil Siswa
            </button>
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Koreksi Jawaban LJK Manual
            </button>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {scopeMode === 'cohort' ? (
            /* ================= COHORT / CLASS-WIDE AGGREGATE ANALYSIS ================= */
            <motion.div
              key="cohort"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Sangat Siap (Target Top 25)',
                    value: `${cohortAnalysis.tierCounts.sangatSiap} Siswa`,
                    sub: 'Kesiapan ≥ 70% & HOTS ≥ 60%',
                    color: 'text-emerald-700',
                  },
                  {
                    label: 'Kompetitif (Potensi Lolos)',
                    value: `${cohortAnalysis.tierCounts.kompetitif} Siswa`,
                    sub: 'Kesiapan 50%–69%',
                    color: 'text-blue-700',
                  },
                  {
                    label: 'Perlu Penguatan Intensif',
                    value: `${cohortAnalysis.tierCounts.penguatan} Siswa`,
                    sub: 'Kesiapan 30%–49%',
                    color: 'text-amber-700',
                  },
                  {
                    label: 'Pembinaan Dasar',
                    value: `${cohortAnalysis.tierCounts.dasar} Siswa`,
                    sub: 'Kesiapan < 30%',
                    color: 'text-rose-700',
                  },
                ].map((kpi, idx) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="bg-white border border-slate-200 rounded-xl p-5"
                  >
                    <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
                    <div className={`mt-2 text-2xl font-bold font-mono tabular-nums ${kpi.color}`}>
                      {kpi.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{kpi.sub}</div>
                  </motion.div>
                ))}
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Rata-Rata Penguasaan Kognitif Klasikal ({cohortAnalysis.participantCount} Peserta)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Menunjukkan tingkat serapan dari pemahaman dasar (LOTS) hingga penalaran Olimpiade (HOTS).
                    </p>
                  </div>
                  <div className="space-y-4">
                    {cohortAnalysis.cogAgg.map((c, idx) => {
                      const barColor =
                        c.level === 'LOTS'
                          ? 'bg-emerald-600'
                          : c.level === 'MOTS'
                          ? 'bg-amber-600'
                          : 'bg-rose-600';
                      return (
                        <div key={c.level} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-900">{c.level}</span>
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-800">
                              {c.avgAccuracy}% ({c.totalCorrect}/{c.totalItems})
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: c.avgAccuracy / 100 }}
                              transition={{ duration: 0.5, delay: idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                              className={`h-full w-full origin-left rounded-full ${barColor}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cohort Actionable Advice */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                    <h2 className="text-base font-semibold text-slate-900">
                      Saran Strategi Pembinaan Klasikal
                    </h2>
                  </div>
                  <ul className="space-y-3 text-sm text-slate-700 leading-relaxed">
                    {cohortAnalysis.cohortRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs font-bold text-blue-700 mt-0.5 shrink-0">
                          0{i + 1}.
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">
                    Peta Penguasaan Kisi-Kisi Seluruh Siswa
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Identifikasi domain kisi-kisi yang paling membutuhkan pengayaan pembinaan.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-6">Domain Kisi-Kisi</th>
                        <th className="py-3 px-4 text-right font-mono">Peserta</th>
                        <th className="py-3 px-4 text-right font-mono">Benar / Total</th>
                        <th className="py-3 px-4 min-w-[180px]">Rata-Rata Penguasaan</th>
                        <th className="py-3 px-4 text-right font-mono">Siap</th>
                        <th className="py-3 px-6 text-right">Status Klasikal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {cohortAnalysis.domainAgg.map((d, idx) => {
                        const barColor =
                          d.status === 'Siap'
                            ? 'bg-emerald-600'
                            : d.status === 'Perlu Penguatan'
                            ? 'bg-amber-600'
                            : 'bg-rose-600';
                        const textColor =
                          d.status === 'Siap'
                            ? 'text-emerald-700'
                            : d.status === 'Perlu Penguatan'
                            ? 'text-amber-700'
                            : 'text-rose-700';

                        return (
                          <tr key={d.domain} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-6 font-medium text-slate-900">{d.domain}</td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                              {d.participatingAttempts}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                              {d.totalCorrect} / {d.totalItems}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: d.avgAccuracy / 100 }}
                                    transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                    className={`h-full w-full origin-left rounded-full ${barColor}`}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 w-9 text-right">
                                  {d.avgAccuracy}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                              {d.readyCount}/{d.participatingAttempts}
                            </td>
                            <td className={`py-3.5 px-6 text-right text-xs font-semibold ${textColor}`}>
                              {d.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          ) : (
            /* ================= INDIVIDUAL STUDENT ANALYSIS ================= */
            <motion.div
              key={`individual-${activeAttempt.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              {/* Student Selector Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <label htmlFor="attempt-select" className="text-xs font-semibold text-slate-600">
                    Pilih Peserta:
                  </label>
                  <select
                    id="attempt-select"
                    value={activeAttempt.id}
                    onChange={(e) => {
                      onSelectAttempt(e.target.value);
                      setDomainFilter('ALL');
                    }}
                    className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 max-w-md flex-1"
                  >
                    {attempts.map((att) => (
                      <option key={att.id} value={att.id}>
                        {att.student.name} ({att.student.school} · Kls {att.student.grade}) — {att.configTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 no-print">
                  <span className="font-mono tabular-nums">
                    Durasi: {formatTimer(activeAttempt.durationUsedSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak Rapor
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAttempt(activeAttempt.id)}
                    className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>

              {/* Coach Executive Verdict Card */}
              {(() => {
                const sorted = [...analysis.domainBreakdown].sort(
                  (a, b) => a.accuracyPercent - b.accuracyPercent
                );
                const weakest = sorted[0];
                const strongest = sorted[sorted.length - 1];
                const scoreIfSkippedWrong = analysis.netScore + analysis.penaltyLostPoints;
                const verdictText =
                  analysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
                    ? 'Layak Diutus sebagai Kontingen Utama SMP Negeri 2 Kalibaru'
                    : analysis.readinessTier === 'Kompetitif (Potensi Lolos)'
                    ? 'Layak Bertanding dengan Penguatan Materi Prioritas'
                    : 'Perlu Pembinaan Terstruktur Sebelum Lomba';

                return (
                  <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-blue-700">
                          Kesimpulan Cepat untuk Guru Pembimbing
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{verdictText}</h2>
                      </div>
                      {weakest && (
                        <button
                          type="button"
                          onClick={() => onLaunchDrill(weakest.domain, 'ALL')}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer no-print"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Buat Sesi Latihan: {weakest.domain}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                      <div className="bg-slate-50 rounded-lg p-3.5 space-y-1">
                        <div className="text-xs font-medium text-slate-500">Kekuatan Utama</div>
                        <div className="font-semibold text-emerald-700">
                          {strongest ? `${strongest.domain} (${strongest.accuracyPercent}%)` : '-'}
                        </div>
                        <p className="text-xs text-slate-600">
                          Pertahankan ketelitian agar menjadi lumbung poin aman.
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-3.5 space-y-1">
                        <div className="text-xs font-medium text-slate-500">Prioritas Remedial</div>
                        <div className="font-semibold text-rose-700">
                          {weakest ? `${weakest.domain} (${weakest.accuracyPercent}%)` : '-'}
                        </div>
                        <p className="text-xs text-slate-600">
                          Domain paling mendesak untuk dibedah bersama pembina.
                        </p>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-3.5 space-y-1">
                        <div className="text-xs font-medium text-slate-500">Simulasi Penalti (-1)</div>
                        <div className="font-semibold text-slate-900 font-mono tabular-nums">
                          {analysis.netScore} → {scoreIfSkippedWrong} poin
                        </div>
                        <p className="text-xs text-slate-600">
                          {analysis.penaltyLostPoints > 0
                            ? `Jika ${analysis.wrongCount} soal ragu dikosongkan (0), skor naik +${analysis.penaltyLostPoints} poin.`
                            : 'Strategi penghindaran penalti -1 sudah sangat disiplin.'}
                        </p>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* 4-Column KPI Summary Strip */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0 }}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5"
                >
                  <div className="text-xs font-medium text-slate-500">Skor Bersih Olimpiade</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {analysis.netScore} / {analysis.maxScore}
                  </div>
                  <div className="text-xs text-slate-600 font-mono tabular-nums">
                    Benar {analysis.correctCount} · Salah {analysis.wrongCount} · Kosong {analysis.unansweredCount}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.05 }}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5"
                >
                  <div className="text-xs font-medium text-slate-500">Indeks Kesiapan</div>
                  <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums">
                    {analysis.normalizedPercent}%
                  </div>
                  <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <span>{analysis.readinessTier}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.1 }}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5"
                >
                  <div className="text-xs font-medium text-slate-500">Akurasi Jawaban Terisi</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {analysis.accuracyWhenAnswered}%
                  </div>
                  <div className="text-xs text-slate-600">
                    Ketepatan pada soal yang dipilih untuk dijawab
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: 0.15 }}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5"
                >
                  <div className="text-xs font-medium text-slate-500">Poin Hilang Akibat Penalti (-1)</div>
                  <div className="text-2xl font-bold text-rose-700 font-mono tabular-nums">
                    -{analysis.penaltyLostPoints} poin
                  </div>
                  <div className="text-xs text-slate-600">
                    Pengurangan dari {analysis.wrongCount} butir jawaban salah
                  </div>
                </motion.div>
              </section>

              {/* Cognitive Profile & Recommendations */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Profil Kemampuan Kognitif (LOTS · MOTS · HOTS)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mengukur daya serap dari pemahaman literal hingga penalaran tingkat tinggi.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {analysis.cognitiveBreakdown.map((cog, idx) => {
                      const barColor =
                        cog.level === 'LOTS'
                          ? 'bg-emerald-600'
                          : cog.level === 'MOTS'
                          ? 'bg-amber-600'
                          : 'bg-rose-600';

                      return (
                        <button
                          key={cog.level}
                          type="button"
                          onClick={() => {
                            if (cog.level === 'HOTS') setReviewFilter('HOTS');
                            else setReviewFilter('ALL');
                          }}
                          className="w-full text-left space-y-1.5 group cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {cog.level}
                            </span>
                            <span className="font-mono tabular-nums text-xs text-slate-600">
                              {cog.correct}/{cog.total} benar ({cog.accuracyPercent}%) · Skor {cog.netScore}
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: cog.accuracyPercent / 100 }}
                              transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                              className={`h-full w-full origin-left rounded-full ${barColor}`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Saran & Rekomendasi Pembinaan Siswa
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Disusun otomatis dari pola kesalahan, penalti, dan kesenjangan kognitif.
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-3 text-sm text-slate-700 leading-relaxed">
                    {analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs font-bold text-blue-700 mt-0.5 shrink-0">
                          0{i + 1}.
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Interactive Kisi-Kisi Mastery Matrix */}
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Analisa Penguasaan per Kisi-Kisi Juknis (Klik Baris untuk Filter Butir)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ambang batas kategori Siap adalah akurasi ≥ 75% per domain materi.
                    </p>
                  </div>
                  {domainFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setDomainFilter('ALL')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filter: {domainFilter}</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-6">Domain Kisi-Kisi</th>
                        <th className="py-3 px-4 text-right font-mono">Soal</th>
                        <th className="py-3 px-4 text-right font-mono">Benar</th>
                        <th className="py-3 px-4 text-right font-mono">Salah</th>
                        <th className="py-3 px-4 text-right font-mono">Kosong</th>
                        <th className="py-3 px-4 w-44">Penguasaan</th>
                        <th className="py-3 px-4 text-right font-mono">Skor</th>
                        <th className="py-3 px-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {analysis.domainBreakdown.map((d, idx) => {
                        const isSelected = domainFilter === d.domain;
                        const statusIcon =
                          d.status === 'Siap' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          ) : d.status === 'Perlu Penguatan' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                          );

                        const statusColor =
                          d.status === 'Siap'
                            ? 'text-emerald-700'
                            : d.status === 'Perlu Penguatan'
                            ? 'text-amber-700'
                            : 'text-rose-700';

                        const barColor =
                          d.status === 'Siap'
                            ? 'bg-emerald-600'
                            : d.status === 'Perlu Penguatan'
                            ? 'bg-amber-600'
                            : 'bg-rose-600';

                        return (
                          <tr
                            key={d.domain}
                            onClick={() =>
                              setDomainFilter((prev) => (prev === d.domain ? 'ALL' : d.domain))
                            }
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3.5 px-6 font-medium text-slate-900">
                              {d.domain}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                              {d.total}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                              {d.correct}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-rose-700 font-medium">
                              {d.wrong}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                              {d.unanswered}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: d.accuracyPercent / 100 }}
                                    transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                                    className={`h-full w-full origin-left rounded-full ${barColor}`}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 w-9 text-right">
                                  {d.accuracyPercent}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {d.netScore}/{d.maxPossibleScore}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <span className={`inline-flex items-center justify-end gap-1.5 text-xs font-semibold ${statusColor}`}>
                                {statusIcon}
                                <span>{d.status}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Cards */}
                <div className="md:hidden divide-y divide-slate-200">
                  {analysis.domainBreakdown.map((d) => {
                    const isSelected = domainFilter === d.domain;
                    const barColor =
                      d.status === 'Siap'
                        ? 'bg-emerald-600'
                        : d.status === 'Perlu Penguatan'
                        ? 'bg-amber-600'
                        : 'bg-rose-600';
                    const statusColor =
                      d.status === 'Siap'
                        ? 'text-emerald-700'
                        : d.status === 'Perlu Penguatan'
                        ? 'text-amber-700'
                        : 'text-rose-700';

                    return (
                      <button
                        key={d.domain}
                        type="button"
                        onClick={() =>
                          setDomainFilter((prev) => (prev === d.domain ? 'ALL' : d.domain))
                        }
                        className={`w-full text-left p-4 space-y-2.5 cursor-pointer ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-900">{d.domain}</span>
                          <span className={`text-xs font-semibold ${statusColor}`}>{d.status}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${d.accuracyPercent}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
                            {d.accuracyPercent}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-mono tabular-nums text-slate-500">
                          <span>
                            B:{d.correct} S:{d.wrong} K:{d.unanswered}
                          </span>
                          <span>
                            Skor {d.netScore}/{d.maxPossibleScore}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Item-by-Item Diagnostic Review */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Telaah Jawaban & Pembahasan Per Butir
                    </h2>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Menampilkan {reviewQuestions.length} butir
                      {domainFilter !== 'ALL' ? ` · Domain ${domainFilter}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                    {(
                      [
                        ['ALL', 'Semua Butir'],
                        ['WRONG', 'Salah (-1)'],
                        ['HOTS', 'Khusus HOTS'],
                        ['UNANSWERED', 'Kosong (0)'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setReviewFilter(key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          reviewFilter === key
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {reviewQuestions.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    Tidak ada butir soal pada kombinasi filter ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewQuestions.map((q) => {
                      const picked = activeAttempt.answers[q.id];
                      const isCorrect = picked === q.correctAnswer;
                      const isBlank = !picked;

                      const pointText = isBlank ? '0 poin' : isCorrect ? '+4 poin' : '-1 poin';
                      const pointColor = isBlank
                        ? 'text-slate-500'
                        : isCorrect
                        ? 'text-emerald-700'
                        : 'text-rose-700';

                      return (
                        <div
                          key={q.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2 text-slate-500">
                              <span className="font-mono font-bold text-slate-900">
                                Soal #{String(q.id).padStart(3, '0')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{q.domain}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-700">{q.cognitiveLevel}</span>
                              <span aria-hidden="true">·</span>
                              <span>{q.topic}</span>
                            </div>
                            <span className={`font-mono font-bold tabular-nums ${pointColor}`}>
                              {pointText}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-slate-900 whitespace-pre-line">
                            {q.question}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                            <span className="text-slate-600">
                              Jawaban Siswa:{' '}
                              <strong className="font-mono text-slate-900">
                                {picked ? `${picked}. ${q.options[picked]}` : 'Tidak dijawab'}
                              </strong>
                            </span>
                            <span className="text-emerald-700">
                              Kunci Benar:{' '}
                              <strong className="font-mono">
                                {q.correctAnswer}. {q.options[q.correctAnswer]}
                              </strong>
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                            <strong className="text-slate-800">Pembahasan:</strong> {q.explanation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Manual LJK Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                Koreksi Jawaban LJK / CBT Eksternal (100 Soal)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tempelkan jawaban siswa dari ujian kertas (PBT) atau platform CBT luar untuk langsung dianalisa per kisi-kisi dan level LOTS/MOTS/HOTS.
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
                placeholder="Format berurutan: B,A,B,C,-,... atau tanpa spasi: BABC-B... (gunakan - untuk kosong), atau format bernomor: 1:B, 2:A"
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
                Proses & Analisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
