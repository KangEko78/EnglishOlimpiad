import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Trash2,
  XCircle,
} from 'lucide-react';
import { analyzeAttempt, QUESTION_BANK, QUESTION_BY_ID } from '../data/questionBank';
import {
  CbtAttempt,
  CognitiveLevel,
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
}: AnalyticsViewProps) {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('individual');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('ALL');
  const [showManualModal, setShowManualModal] = useState(false);

  const [manualStudent, setManualStudent] = useState<StudentProfile>({
    name: '',
    school: '',
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

    return {
      participantCount: attempts.length,
      domainAgg,
      cogAgg,
      tierCounts,
    };
  }, [attempts]);

  const reviewQuestions = useMemo(() => {
    if (!activeAttempt) return [];
    return activeAttempt.questionIds
      .map((id) => QUESTION_BY_ID[id])
      .filter((q) => {
        if (!q) return false;
        const picked = activeAttempt.answers[q.id];
        if (reviewFilter === 'WRONG') return Boolean(picked) && picked !== q.correctAnswer;
        if (reviewFilter === 'HOTS') return q.cognitiveLevel === 'HOTS';
        if (reviewFilter === 'UNANSWERED') return !picked;
        return true;
      });
  }, [activeAttempt, reviewFilter]);

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
            Admin Panel · Diagnostik Kisi-Kisi & Kesiapan Olimpiade (+4 / -1 / 0)
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Analisa Kemampuan & Kesiapan Siswa
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Bandingkan penguasaan kisi-kisi secara klasikal (seluruh siswa) maupun diagnostik mendalam per individu peserta lengkap dengan telaah butir soal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setScopeMode('individual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
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
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
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
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
          <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900">
              Belum Ada Data Pengerjaan Siswa
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Setelah siswa menyelesaikan ujian di Halaman CBT (atau data ditarik dari Google Spreadsheet), analisa penguasaan kisi-kisi dan kesiapan Olimpiade akan tampil di sini.
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
        </div>
      ) : scopeMode === 'cohort' ? (
        /* ================= COHORT / CLASS-WIDE AGGREGATE ANALYSIS ================= */
        <div className="space-y-8">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Sangat Siap (Target Top 25)</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                {cohortAnalysis.tierCounts.sangatSiap} Siswa
              </div>
              <div className="mt-1 text-xs text-slate-500">Kesiapan ≥ 70% & HOTS ≥ 60%</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Kompetitif (Potensi Lolos)</div>
              <div className="mt-2 text-2xl font-bold text-blue-700 font-mono tabular-nums">
                {cohortAnalysis.tierCounts.kompetitif} Siswa
              </div>
              <div className="mt-1 text-xs text-slate-500">Kesiapan 50%–69%</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Perlu Penguatan Intensif</div>
              <div className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums">
                {cohortAnalysis.tierCounts.penguatan} Siswa
              </div>
              <div className="mt-1 text-xs text-slate-500">Kesiapan 30%–49%</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Pembinaan Dasar</div>
              <div className="mt-2 text-2xl font-bold text-rose-700 font-mono tabular-nums">
                {cohortAnalysis.tierCounts.dasar} Siswa
              </div>
              <div className="mt-1 text-xs text-slate-500">Kesiapan &lt; 30%</div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Rata-Rata Penguasaan Kognitif Klasikal ({cohortAnalysis.participantCount} Peserta)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menunjukkan apakah kendala siswa berada pada materi dasar (LOTS), aplikasi (MOTS), atau penalaran Olimpiade (HOTS).
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cohortAnalysis.cogAgg.map((c) => {
                const barColor =
                  c.level === 'LOTS'
                    ? 'bg-emerald-600'
                    : c.level === 'MOTS'
                    ? 'bg-amber-600'
                    : 'bg-rose-600';
                return (
                  <div key={c.level} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{c.level}</span>
                      <span className="font-mono tabular-nums text-xs font-bold text-slate-800">
                        {c.avgAccuracy}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${c.avgAccuracy}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {c.totalCorrect} jawaban benar dari {c.totalItems} butir diujikan
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Peta Penguasaan Kisi-Kisi Seluruh Siswa
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifikasi domain kisi-kisi yang paling membutuhkan pengayaan pembinaan di kelas/sekolah.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-6">Domain Kisi-Kisi</th>
                    <th className="py-3 px-4 text-right font-mono">Peserta Diuji</th>
                    <th className="py-3 px-4 text-right font-mono">Benar / Total Butir</th>
                    <th className="py-3 px-4 w-48">Rata-Rata Penguasaan</th>
                    <th className="py-3 px-4 text-right font-mono">Siswa Kategori Siap</th>
                    <th className="py-3 px-6 text-right">Status Klasikal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {cohortAnalysis.domainAgg.map((d) => {
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
                      <tr key={d.domain} className="hover:bg-slate-50/70">
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
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${d.avgAccuracy}%` }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 w-9 text-right">
                              {d.avgAccuracy}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {d.readyCount} / {d.participatingAttempts}
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
        </div>
      ) : (
        /* ================= INDIVIDUAL STUDENT ANALYSIS ================= */
        <div className="space-y-8">
          {/* Student Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <label htmlFor="attempt-select" className="text-xs font-semibold text-slate-600">
                Pilih Peserta:
              </label>
              <select
                id="attempt-select"
                value={activeAttempt.id}
                onChange={(e) => onSelectAttempt(e.target.value)}
                className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 max-w-md flex-1"
              >
                {attempts.map((att) => (
                  <option key={att.id} value={att.id}>
                    {att.student.name} ({att.student.school} · Kls {att.student.grade}) — {att.configTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="font-mono tabular-nums">
                Durasi: {formatTimer(activeAttempt.durationUsedSeconds)}
              </span>
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

          {/* 4-Column KPI Summary Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Skor Bersih Olimpiade</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {analysis.netScore} / {analysis.maxScore}
              </div>
              <div className="text-xs text-slate-600 font-mono tabular-nums">
                Benar {analysis.correctCount} · Salah {analysis.wrongCount} · Kosong {analysis.unansweredCount}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Indeks Kesiapan</div>
              <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums">
                {analysis.normalizedPercent}%
              </div>
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>{analysis.readinessTier}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Akurasi Jawaban Terisi</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {analysis.accuracyWhenAnswered}%
              </div>
              <div className="text-xs text-slate-600">
                Ketepatan pada soal yang dipilih untuk dijawab
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Poin Hilang Akibat Penalti (-1)</div>
              <div className="text-2xl font-bold text-rose-700 font-mono tabular-nums">
                -{analysis.penaltyLostPoints} poin
              </div>
              <div className="text-xs text-slate-600">
                Pengurangan dari {analysis.wrongCount} butir jawaban salah
              </div>
            </div>
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
                {analysis.cognitiveBreakdown.map((cog) => {
                  const barColor =
                    cog.level === 'LOTS'
                      ? 'bg-emerald-600'
                      : cog.level === 'MOTS'
                      ? 'bg-amber-600'
                      : 'bg-rose-600';

                  return (
                    <div key={cog.level} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">{cog.level}</span>
                        <span className="font-mono tabular-nums text-xs text-slate-600">
                          {cog.correct}/{cog.total} benar ({cog.accuracyPercent}%) · Skor {cog.netScore}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${cog.accuracyPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Rekomendasi Pembinaan Terprioritas
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Disusun otomatis dari pola kesalahan, penalti, dan kesenjangan antarlevel kognitif.
                </p>
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

          {/* Kisi-Kisi Mastery Matrix Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Analisa Penguasaan per Kisi-Kisi Juknis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ambang batas kategori Siap adalah akurasi ≥ 75% per domain materi.
              </p>
            </div>

            <div className="overflow-x-auto">
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
                  {analysis.domainBreakdown.map((d) => {
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
                      <tr key={d.domain} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-6 font-medium text-slate-900">{d.domain}</td>
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
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${d.accuracyPercent}%` }}
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
          </section>

          {/* Item-by-Item Diagnostic Review */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Telaah Jawaban & Pembahasan Per Butir
              </h2>
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
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
                Tidak ada butir soal pada kategori filter ini.
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
                        <div className="flex items-center gap-2 text-slate-500">
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
        </div>
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
