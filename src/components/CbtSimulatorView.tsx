import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpenText,
  CheckCircle2,
  Clock,
  Compass,
  Eraser,
  Flag,
  LayoutGrid,
  Play,
  Printer,
  RotateCcw,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react';
import heroStudyImg from '../assets/images/hero_olympiad_study_1795062081970.jpg';
import laurelEmblemImg from '../assets/images/olympiad_laurel_emblem_1795062082827.jpg';
import { analyzeAttempt, QUESTION_BANK, QUESTION_BY_ID } from '../data/questionBank';
import {
  CbtAttempt,
  CbtSessionConfig,
  CognitiveLevel,
  JUKNIS_CONSTANTS,
  OptionKey,
  StudentProfile,
  SYLLABUS_BLUEPRINT,
  SyllabusDomain,
} from '../types/olympiad';
import { formatTimer } from '../utils/exportQuestions';

interface CbtSimulatorViewProps {
  initialPreset?: {
    domain: SyllabusDomain | 'ALL';
    level: CognitiveLevel | 'ALL';
    autoFocusMode?: 'full' | 'focused';
  } | null;
  isAdminMode: boolean;
  onCompleteAttempt: (attempt: CbtAttempt) => Promise<{ syncedToSheets: boolean }>;
  onOpenAdminAnalytics?: (attemptId: string) => void;
}

type ExamModeChoice = 'full_preliminary' | 'diagnostic_21' | 'focused_drill';

function buildDiagnostic21Ids(): number[] {
  const picked: number[] = [];
  for (const bp of SYLLABUS_BLUEPRINT) {
    const domainQs = QUESTION_BANK.filter((q) => q.domain === bp.domain);
    const lots = domainQs.find((q) => q.cognitiveLevel === 'LOTS');
    const mots = domainQs.find((q) => q.cognitiveLevel === 'MOTS');
    const hots = domainQs.find((q) => q.cognitiveLevel === 'HOTS');
    if (lots) picked.push(lots.id);
    if (mots) picked.push(mots.id);
    if (hots) picked.push(hots.id);
  }
  return picked.sort((a, b) => a - b);
}

function getMotivationalMilestone(answeredCount: number, total: number): string {
  if (total === 0) return '';
  const ratio = answeredCount / total;
  if (answeredCount === 0) {
    return 'Mulai dengan tenang. Baca teks secara cermat dan hindari menebak asal (-1).';
  }
  if (ratio < 0.25) {
    return 'Langkah awal yang bagus — jaga ketelitian membaca konteks paragraf.';
  }
  if (ratio < 0.5) {
    return 'Ritme terjaga dengan baik. Tandai soal ragu agar mudah ditinjau ulang.';
  }
  if (ratio < 0.75) {
    return 'Lebih dari setengah ujian terlewati — fokuskan energi pada ketepatan analisa.';
  }
  if (ratio < 1) {
    return 'Tahap akhir menuju garis finis! Periksa kembali butir yang masih kosong atau ragu.';
  }
  return 'Seluruh soal telah terjawab. Tinjau ulang sejenak sebelum mengumpulkan.';
}

export function CbtSimulatorView({
  initialPreset,
  isAdminMode,
  onCompleteAttempt,
  onOpenAdminAnalytics,
}: CbtSimulatorViewProps) {
  const [student, setStudent] = useState<StudentProfile>({
    name: '',
    school: JUKNIS_CONSTANTS.SCHOOL_NAME,
    grade: '8',
  });
  const [modeChoice, setModeChoice] = useState<ExamModeChoice>(
    initialPreset?.autoFocusMode === 'focused' ? 'focused_drill' : 'full_preliminary'
  );
  const [focusedDomain, setFocusedDomain] = useState<SyllabusDomain | 'ALL'>(
    initialPreset?.domain ?? 'ALL'
  );
  const [focusedLevel, setFocusedLevel] = useState<CognitiveLevel | 'ALL'>(
    initialPreset?.level ?? 'ALL'
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Interactive strategy simulator sliders (educational simulation on lobby)
  const [simCorrect, setSimCorrect] = useState(74);
  const [simWrong, setSimWrong] = useState(10);

  // Visual asset fallback toggles
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [emblemImgFailed, setEmblemImgFailed] = useState(false);

  // Active exam state
  const [activeSession, setActiveSession] = useState<CbtSessionConfig | null>(null);
  const [startedAtIso, setStartedAtIso] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({});
  const [flaggedIds, setFlaggedIds] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showQuestionNav, setShowQuestionNav] = useState(false);

  // Student submission receipt state (does not leak answer keys)
  const [completedReceipt, setCompletedReceipt] = useState<{
    attempt: CbtAttempt;
    syncedToSheets: boolean;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialPreset) {
      setCompletedReceipt(null);
      if (initialPreset.autoFocusMode === 'focused') {
        setModeChoice('focused_drill');
        setFocusedDomain(initialPreset.domain);
        setFocusedLevel(initialPreset.level);
      } else if (initialPreset.autoFocusMode === 'full') {
        setModeChoice('full_preliminary');
      }
    }
  }, [initialPreset]);

  const focusedQuestionIds = useMemo(() => {
    return QUESTION_BANK.filter((q) => {
      if (focusedDomain !== 'ALL' && q.domain !== focusedDomain) return false;
      if (focusedLevel !== 'ALL' && q.cognitiveLevel !== focusedLevel) return false;
      return true;
    }).map((q) => q.id);
  }, [focusedDomain, focusedLevel]);

  const diagnostic21Ids = useMemo(() => buildDiagnostic21Ids(), []);

  const previewConfig: CbtSessionConfig = useMemo(() => {
    if (modeChoice === 'full_preliminary') {
      return {
        mode: 'full_preliminary',
        title: 'Simulasi Penuh Babak Penyisihan (Standar Juknis)',
        questionIds: QUESTION_BANK.map((q) => q.id),
        durationMinutes: JUKNIS_CONSTANTS.PRELIMINARY_DURATION_MINUTES,
      };
    }
    if (modeChoice === 'diagnostic_21') {
      return {
        mode: 'focused_drill',
        title: 'Tes Diagnostik Cepat Semua Kisi-Kisi (21 Soal)',
        questionIds: diagnostic21Ids,
        durationMinutes: 25,
      };
    }
    const domainLabel = focusedDomain === 'ALL' ? 'Semua Kisi-Kisi' : focusedDomain;
    const levelLabel = focusedLevel === 'ALL' ? 'LOTS–HOTS' : focusedLevel;
    const minutes = Math.max(5, Math.ceil((focusedQuestionIds.length * 72) / 60));
    return {
      mode: 'focused_drill',
      title: `Latihan Terfokus: ${domainLabel} (${levelLabel})`,
      questionIds: focusedQuestionIds,
      durationMinutes: minutes,
    };
  }, [modeChoice, focusedDomain, focusedLevel, focusedQuestionIds, diagnostic21Ids]);

  const clampedSimWrong = Math.min(simWrong, 100 - simCorrect);
  const simSkipped = 100 - simCorrect - clampedSimWrong;
  const simNetScore = simCorrect * 4 - clampedSimWrong;
  const simPercent = Math.max(0, Math.round((simNetScore / 400) * 100));

  const startSessionWithConfig = (session: CbtSessionConfig) => {
    setFormError(null);
    setCompletedReceipt(null);
    setActiveSession(session);
    setStartedAtIso(new Date().toISOString());
    setCurrentIndex(0);
    setAnswers({});
    setFlaggedIds([]);
    setSecondsLeft(session.durationMinutes * 60);
    setShowSubmitConfirm(false);
    setShowQuestionNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finishExam = async (
    session: CbtSessionConfig,
    currentAnswers: Record<number, OptionKey>,
    currentFlags: number[],
    remainingSec: number
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const totalSec = session.durationMinutes * 60;
    const usedSec = Math.max(1, totalSec - remainingSec);
    const attempt: CbtAttempt = {
      id: `attempt-${Date.now()}`,
      student: {
        name: student.name.trim(),
        school: student.school.trim(),
        grade: student.grade,
      },
      mode: session.mode,
      configTitle: session.title,
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      durationUsedSeconds: usedSec,
      totalQuestions: session.questionIds.length,
      questionIds: session.questionIds,
      answers: currentAnswers,
      flaggedIds: currentFlags,
    };

    const res = await onCompleteAttempt(attempt);
    setActiveSession(null);
    setShowSubmitConfirm(false);
    setIsSubmitting(false);
    setCompletedReceipt({ attempt, syncedToSheets: res.syncedToSheets });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!activeSession) return;
    if (secondsLeft <= 0) {
      void finishExam(activeSession, answers, flaggedIds, 0);
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, secondsLeft]);

  useEffect(() => {
    if (!activeSession || showSubmitConfirm) return;
    const currentQId = activeSession.questionIds[currentIndex];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentIndex < activeSession.questionIds.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const key = e.key.toUpperCase() as OptionKey;
        setAnswers((prev) => ({ ...prev, [currentQId]: key }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, currentIndex, showSubmitConfirm]);

  const handleStartExam = () => {
    if (!student.name.trim() || !student.school.trim()) {
      setFormError('Lengkapi Nama Lengkap Siswa terlebih dahulu sebelum memulai ujian CBT.');
      return;
    }
    if (previewConfig.questionIds.length === 0) {
      setFormError('Kombinasi filter latihan menghasilkan 0 soal. Ubah pilihan kisi-kisi atau level.');
      return;
    }
    startSessionWithConfig(previewConfig);
  };

  // ================= STUDENT COMPLETION CERTIFICATE / READINESS RECEIPT =================
  if (completedReceipt) {
    const receiptAnalysis = analyzeAttempt(completedReceipt.attempt);
    const sortedDomains = [...receiptAnalysis.domainBreakdown].sort(
      (a, b) => a.accuracyPercent - b.accuracyPercent
    );
    const weakestDomain = sortedDomains[0];

    const motivationalMessage =
      receiptAnalysis.readinessTier === 'Sangat Siap (Target Top 25 Finalis)'
        ? 'Performa luar biasa! Pertahankan ketelitian dan lanjutkan mengasah sesi Listening untuk Babak Final.'
        : receiptAnalysis.readinessTier === 'Kompetitif (Potensi Lolos)'
        ? 'Pondasi Anda sudah kuat dan berpeluang besar menembus Top 25. Pertajam domain terlemah di bawah untuk mengamankan posisi Finalis.'
        : 'Langkah awal yang berharga! Gunakan hasil pemetaan di bawah sebagai kompas latihan berikutnya — setiap sesi membuat kemampuan analisamu makin tajam.';

    const handleLaunchWeakestDrill = () => {
      if (!weakestDomain) return;
      const drillIds = QUESTION_BANK.filter((q) => q.domain === weakestDomain.domain).map((q) => q.id);
      const minutes = Math.max(8, Math.ceil((drillIds.length * 72) / 60));
      startSessionWithConfig({
        mode: 'focused_drill',
        title: `Latihan Penguatan: ${weakestDomain.domain}`,
        questionIds: drillIds,
        durationMinutes: minutes,
      });
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl mx-auto py-4 sm:py-6 space-y-6"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          {/* Certificate Top Header with Academic Seal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="flex items-start gap-4">
              {emblemImgFailed ? (
                <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <Award className="w-7 h-7 text-blue-700" />
                </div>
              ) : (
                <img
                  src={laurelEmblemImg}
                  alt="Lambang Kehormatan Olimpiade Bahasa Inggris SMP Negeri 2 Kalibaru"
                  referrerPolicy="no-referrer"
                  onError={() => setEmblemImgFailed(true)}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-700">
                  Laporan Kesiapan Olimpiade · {JUKNIS_CONSTANTS.SCHOOL_NAME}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {completedReceipt.attempt.student.name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600">
                  {completedReceipt.attempt.student.school} · Kelas {completedReceipt.attempt.student.grade} · {completedReceipt.attempt.configTitle}
                </p>
                <p className="text-xs text-slate-500">
                  {completedReceipt.syncedToSheets
                    ? 'Tercatat di Database Spreadsheet SMP Negeri 2 Kalibaru untuk telaah Pembina.'
                    : 'Tersimpan di perangkat ini. Anda dapat mencetak laporan ini sebagai arsip latihan.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Sertifikat Hasil
            </button>
          </div>

          {/* Readiness Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Predikat Kesiapan Olimpiade</span>
              </div>
              <div className="text-lg font-bold text-slate-900">{receiptAnalysis.readinessTier}</div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                {motivationalMessage}
              </p>
            </div>
            <div className="sm:text-right shrink-0">
              <div className="text-xs text-slate-500">Indeks Kesiapan</div>
              <div className="text-3xl font-bold text-blue-700 font-mono tabular-nums">
                {receiptAnalysis.normalizedPercent}%
              </div>
            </div>
          </div>

          {/* 4-Metric Score Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500">Skor Olimpiade</div>
              <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
                {receiptAnalysis.netScore}
                <span className="text-xs font-normal text-slate-500">/{receiptAnalysis.maxScore}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500">Benar (+4)</div>
              <div className="mt-1 text-xl font-bold text-emerald-700 font-mono tabular-nums">
                {receiptAnalysis.correctCount}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500">Salah (-1)</div>
              <div className="mt-1 text-xl font-bold text-rose-700 font-mono tabular-nums">
                {receiptAnalysis.wrongCount}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500">Kosong (0)</div>
              <div className="mt-1 text-xl font-bold text-slate-700 font-mono tabular-nums">
                {receiptAnalysis.unansweredCount}
              </div>
            </div>
          </div>

          {/* Kisi-Kisi & Cognitive Readiness Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Peta Penguasaan Kisi-Kisi
              </h2>
              <div className="space-y-2.5">
                {receiptAnalysis.domainBreakdown.map((d, idx) => {
                  const barColor =
                    d.status === 'Siap'
                      ? 'bg-emerald-600'
                      : d.status === 'Perlu Penguatan'
                      ? 'bg-amber-600'
                      : 'bg-rose-600';
                  return (
                    <div key={d.domain} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{d.domain}</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {d.accuracyPercent}% ({d.status})
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: d.accuracyPercent / 100 }}
                          transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full w-full origin-left rounded-full ${barColor}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Profil Level Kognitif (LOTS · MOTS · HOTS)
                </h2>
                <div className="space-y-2.5">
                  {receiptAnalysis.cognitiveBreakdown.map((c, idx) => {
                    const barColor =
                      c.level === 'LOTS'
                        ? 'bg-emerald-600'
                        : c.level === 'MOTS'
                        ? 'bg-amber-600'
                        : 'bg-rose-600';
                    return (
                      <div key={c.level} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{c.level}</span>
                          <span className="font-mono tabular-nums text-slate-600">
                            {c.correct}/{c.total} benar ({c.accuracyPercent}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: c.accuracyPercent / 100 }}
                            transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            className={`h-full w-full origin-left rounded-full ${barColor}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-900">
                  Kompas Latihan Berikutnya
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                  {receiptAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-blue-700 shrink-0">0{i + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 no-print">
            <button
              type="button"
              onClick={() => {
                setCompletedReceipt(null);
                setStudent({ name: '', school: JUKNIS_CONSTANTS.SCHOOL_NAME, grade: '8' });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Ganti Peserta / Kembali ke Lobi
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {weakestDomain && weakestDomain.accuracyPercent < 85 && (
                <button
                  type="button"
                  onClick={handleLaunchWeakestDrill}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" />
                  Latih Materi Terlemah: {weakestDomain.domain}
                </button>
              )}

              {isAdminMode && onOpenAdminAnalytics && (
                <button
                  type="button"
                  onClick={() => onOpenAdminAnalytics(completedReceipt.attempt.id)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Buka Analisa Kisi-Kisi Lengkap
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ================= ACTIVE CBT WORKSPACE =================
  if (activeSession) {
    const currentQId = activeSession.questionIds[currentIndex];
    const currentQuestion = QUESTION_BY_ID[currentQId];
    const selectedOption = answers[currentQId];
    const isFlagged = flaggedIds.includes(currentQId);
    const answeredCount = Object.keys(answers).length;
    const totalCount = activeSession.questionIds.length;
    const unansweredCount = totalCount - answeredCount;
    const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
    const isLowTime = secondsLeft <= 300;
    const milestoneText = getMotivationalMilestone(answeredCount, totalCount);

    const toggleFlag = () => {
      setFlaggedIds((prev) =>
        prev.includes(currentQId) ? prev.filter((id) => id !== currentQId) : [...prev, currentQId]
      );
    };

    const clearChoice = () => {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQId];
        return next;
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs text-slate-500">
                {student.name} · {student.school} · Kelas {student.grade}
              </div>
              <h2 className="text-base font-semibold text-slate-900">{activeSession.title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowQuestionNav((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {showQuestionNav ? 'Sembunyikan Navigasi' : 'Tampilkan Navigasi'}
              </button>

              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border font-mono tabular-nums text-sm font-semibold ${
                  isLowTime
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTimer(secondsLeft)}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kumpulkan Ujian
              </button>
            </div>
          </div>

          {/* Animated Progress Strip & Encouraging Milestone */}
          <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">{milestoneText}</span>
              <span className="font-mono tabular-nums font-semibold text-blue-700">
                {answeredCount}/{totalCount} Terjawab ({progressPercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
              <motion.div
                initial={false}
                animate={{ scaleX: progressPercent / 100 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="h-full w-full origin-left bg-blue-700 rounded-full"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            className={`${
              showQuestionNav ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl p-6 space-y-6`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Butir {currentIndex + 1} / {activeSession.questionIds.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{currentQuestion.domain}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    No. {String(currentQuestion.id).padStart(3, '0')}
                  </span>
                </div>

                {currentQuestion.passage && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-5 space-y-2.5 max-h-[340px] overflow-y-auto">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <BookOpenText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{currentQuestion.passageTitle ?? 'Reading Passage'}</span>
                    </div>
                    <div className="font-serif text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">
                      {currentQuestion.passage}
                    </div>
                  </div>
                )}

                <div className="text-base font-medium text-slate-900 leading-relaxed whitespace-pre-line">
                  {currentQuestion.question}
                </div>

                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const isSelected = selectedOption === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [currentQId]: opt }))}
                        className={`w-full text-left flex items-start gap-3.5 px-4 py-3.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                            isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt}
                        </span>
                        <span className="text-sm sm:text-[15px] leading-snug">
                          {currentQuestion.options[opt]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFlag}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isFlagged
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {isFlagged ? 'Ditandai Ragu' : 'Tandai Ragu-Ragu'}
                </button>

                {selectedOption && (
                  <button
                    type="button"
                    onClick={clearChoice}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Kosongkan (0 Poin)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={currentIndex === activeSession.questionIds.length - 1}
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(activeSession.questionIds.length - 1, i + 1))
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Berikutnya
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {showQuestionNav && (
            <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Navigasi Nomor Soal</h3>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {answeredCount}/{activeSession.questionIds.length} Terjawab
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-5 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
                {activeSession.questionIds.map((qId, idx) => {
                  const isCurrent = idx === currentIndex;
                  const hasAns = Boolean(answers[qId]);
                  const flagged = flaggedIds.includes(qId);

                  let btnClass = 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100';
                  if (flagged && hasAns) {
                    btnClass = 'bg-amber-100 border-amber-400 text-amber-900 font-semibold';
                  } else if (flagged) {
                    btnClass = 'bg-amber-50 border-amber-300 text-amber-800 font-semibold';
                  } else if (hasAns) {
                    btnClass = 'bg-blue-700 border-blue-700 text-white font-semibold';
                  }

                  return (
                    <button
                      key={qId}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-md border text-xs font-mono tabular-nums transition-colors cursor-pointer ${btnClass} ${
                        isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Terjawab</span>
                  <span className="font-mono tabular-nums font-semibold text-blue-700">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ditandai Ragu-Ragu</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700">
                    {flaggedIds.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Dikosongkan (0 Poin)</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-700">
                    {unansweredCount}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
                Aturan Juknis: Benar <span className="font-mono font-semibold text-emerald-700">+4</span>, Salah <span className="font-mono font-semibold text-rose-700">-1</span>, Kosong <span className="font-mono font-semibold text-slate-900">0</span>. Pintasan keyboard: <span className="font-mono">A–D</span> dan panah kiri/kanan.
              </div>
            </aside>
          )}
        </div>

        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    Konfirmasi Pengumpulan Ujian CBT
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Jawaban yang dikumpulkan akan otomatis dinilai dengan sistem +4 / -1 / 0 dan dikirim ke database pembina SMP Negeri 2 Kalibaru.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Soal Terjawab</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {answeredCount} dari {activeSession.questionIds.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Masih Ditandai Ragu</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-700">
                    {flaggedIds.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Dikosongkan (0 Poin)</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-700">
                    {unansweredCount}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Kembali ke Ujian
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void finishExam(activeSession, answers, flaggedIds, secondsLeft)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Kumpulkan Sekarang'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= CBT LOBBY / MOTIVATIONAL HERO + MISSION SETUP =================
  return (
    <div className="space-y-8">
      {/* Split Hero Banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch"
      >
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-medium text-blue-700">
              Program Prestasi Bahasa Inggris · {JUKNIS_CONSTANTS.SCHOOL_NAME}
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              Road to Finalis Olimpiade Bahasa Inggris 2026
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Setiap latihan terukur membawa kontingen SMP Negeri 2 Kalibaru semakin dekat ke jajaran Top 25 Finalis Kabupaten Banyuwangi. Kuasai 7 kisi-kisi resmi dan asah ketajaman logika HOTS Anda di sini.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Target Seleksi</div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900">
                Top 25 Finalis
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Durasi Penyisihan</div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900">
                120 Menit
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Skor Target Aman</div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono tabular-nums text-blue-700">
                ≥ 280 Poin
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-slate-900">
          {heroImgFailed ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-blue-950 via-slate-900 to-slate-800 text-white">
              <Compass className="w-10 h-10 text-blue-300 mb-3" />
              <p className="font-serif italic text-lg text-slate-100">
                “Discipline in practice builds calm confidence on competition day.”
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {JUKNIS_CONSTANTS.SCHOOL_NAME} · English Olympiad Team 2026
              </p>
            </div>
          ) : (
            <>
              <img
                src={heroStudyImg}
                alt="Meja belajar Olimpiade Bahasa Inggris SMP Negeri 2 Kalibaru dengan pemandangan pegunungan pagi hari"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-6 sm:p-7">
                <p className="font-serif italic text-sm sm:text-base text-white/95 leading-snug">
                  “Read beyond the lines, weigh every clue, and let preparation speak for {JUKNIS_CONSTANTS.SCHOOL_SHORT}.”
                </p>
                <p className="text-xs text-slate-300 mt-1.5">
                  Tim Pembinaan Olimpiade · {JUKNIS_CONSTANTS.SCHOOL_NAME}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* Main Workspace Split: Setup Form + Interactive Scoring Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-7 space-y-6">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">1. Identitas Peserta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-1.5">
                <label className="block text-xs font-medium text-slate-700" htmlFor="student-name">
                  Nama Lengkap Siswa
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={student.name}
                  onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Contoh: Alya Putri"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-1 space-y-1.5">
                <label className="block text-xs font-medium text-slate-700" htmlFor="student-school">
                  Sekolah
                </label>
                <input
                  id="student-school"
                  type="text"
                  readOnly
                  value={student.school}
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-default focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1 space-y-1.5">
                <label className="block text-xs font-medium text-slate-700" htmlFor="student-grade">
                  Kelas
                </label>
                <select
                  id="student-grade"
                  value={student.grade}
                  onChange={(e) =>
                    setStudent((s) => ({ ...s, grade: e.target.value as '7' | '8' | '9' }))
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="7">Kelas 7</option>
                  <option value="8">Kelas 8</option>
                  <option value="9">Kelas 9</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">2. Pilih Misi Latihan CBT</h2>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setModeChoice('full_preliminary')}
                className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  modeChoice === 'full_preliminary'
                    ? 'bg-blue-50/70 border-blue-600'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Simulasi Penuh Babak Penyisihan (Standar Juknis)
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap shrink-0">
                    100 Soal · 120 Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Uji ketahanan konsentrasi penuh 100 butir LOTS, MOTS, dan HOTS dengan standar penilaian resmi skor maksimal 400.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModeChoice('diagnostic_21')}
                className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  modeChoice === 'diagnostic_21'
                    ? 'bg-blue-50/70 border-blue-600'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Tes Diagnostik Cepat 7 Kisi-Kisi
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap shrink-0">
                    21 Soal · 25 Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Ukur kekuatan awalmu di seluruh 7 materi (Descriptive hingga Grammar) hanya dalam 25 menit sebelum mendalami latihan khusus.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModeChoice('focused_drill')}
                className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  modeChoice === 'focused_drill'
                    ? 'bg-blue-50/70 border-blue-600'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Latihan Terfokus per Kisi-Kisi
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 whitespace-nowrap shrink-0">
                    {focusedQuestionIds.length} Soal ·{' '}
                    {Math.max(5, Math.ceil((focusedQuestionIds.length * 72) / 60))} Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Pertajam penguasaan domain atau tingkat kesulitan tertentu (LOTS, MOTS, atau HOTS) sesuai target latihanmu.
                </p>
              </button>
            </div>

            {modeChoice === 'focused_drill' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="drill-domain">
                    Pilih Kisi-Kisi
                  </label>
                  <select
                    id="drill-domain"
                    value={focusedDomain}
                    onChange={(e) => setFocusedDomain(e.target.value as SyllabusDomain | 'ALL')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="ALL">Semua Kisi-Kisi</option>
                    {SYLLABUS_BLUEPRINT.map((bp) => (
                      <option key={bp.domain} value={bp.domain}>
                        {bp.domain} ({bp.targetCount} soal)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="drill-level">
                    Pilih Level Kognitif
                  </label>
                  <select
                    id="drill-level"
                    value={focusedLevel}
                    onChange={(e) => setFocusedLevel(e.target.value as CognitiveLevel | 'ALL')}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="ALL">Semua Level (LOTS, MOTS, HOTS)</option>
                    <option value="LOTS">LOTS (Dasar)</option>
                    <option value="MOTS">MOTS (Menengah)</option>
                    <option value="HOTS">HOTS (Tinggi)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Paket terpilih: <span className="font-semibold text-slate-800">{previewConfig.questionIds.length} soal</span> ·{' '}
              <span className="font-mono tabular-nums">{previewConfig.durationMinutes} menit</span>
            </p>
            <button
              type="button"
              onClick={handleStartExam}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Mulai Ujian CBT Sekarang
            </button>
          </div>
        </div>

        {/* Interactive Strategy Simulator & Readiness Benchmarks */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900">
                Simulasi Strategi Skor (+4 / -1 / 0)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Geser simulasi di bawah untuk melihat mengapa mengosongkan soal ragu (<span className="font-mono font-semibold">0</span>) jauh lebih aman dibanding menebak asal (<span className="font-mono font-semibold text-rose-700">-1</span>).
            </p>

            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor="sim-correct" className="font-medium text-slate-700">
                    Jawaban Benar (+4)
                  </label>
                  <span className="font-mono tabular-nums font-bold text-emerald-700">
                    {simCorrect} soal
                  </span>
                </div>
                <input
                  id="sim-correct"
                  type="range"
                  min={0}
                  max={100}
                  value={simCorrect}
                  onChange={(e) => {
                    const nextCorrect = Number(e.target.value);
                    setSimCorrect(nextCorrect);
                    if (simWrong > 100 - nextCorrect) {
                      setSimWrong(100 - nextCorrect);
                    }
                  }}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label htmlFor="sim-wrong" className="font-medium text-slate-700">
                    Tebakan Salah (-1)
                  </label>
                  <span className="font-mono tabular-nums font-bold text-rose-700">
                    {clampedSimWrong} soal
                  </span>
                </div>
                <input
                  id="sim-wrong"
                  type="range"
                  min={0}
                  max={100 - simCorrect}
                  value={clampedSimWrong}
                  onChange={(e) => setSimWrong(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-600">Estimasi Skor Bersih</span>
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {simNetScore}{' '}
                  <span className="text-xs font-normal text-slate-500">/ 400 ({simPercent}%)</span>
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ scaleX: simPercent / 100 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full w-full origin-left rounded-full ${
                    simPercent >= 70
                      ? 'bg-emerald-600'
                      : simPercent >= 50
                      ? 'bg-blue-600'
                      : 'bg-amber-600'
                  }`}
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dikosongkan: <span className="font-mono font-semibold">{simSkipped} soal</span>.{' '}
                {simNetScore >= 280
                  ? 'Sudah menembus zona aman Target Top 25 Finalis (≥ 280 poin).'
                  : `Butuh +${280 - simNetScore} poin lagi untuk mencapai zona aman Finalis (280 poin).`}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Tangga Predikat Kesiapan</h3>
            <dl className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex items-center justify-between gap-2">
                <dt className="font-semibold text-emerald-700">Sangat Siap (Target Finalis)</dt>
                <dd className="font-mono tabular-nums text-slate-700">≥ 70%</dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-2">
                <dt className="font-semibold text-blue-700">Kompetitif (Potensi Lolos)</dt>
                <dd className="font-mono tabular-nums text-slate-700">50% – 69%</dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-2">
                <dt className="font-semibold text-amber-700">Penguatan Intensif</dt>
                <dd className="font-mono tabular-nums text-slate-700">30% – 49%</dd>
              </div>
              <div className="py-2 flex items-center justify-between gap-2">
                <dt className="font-semibold text-rose-700">Pembinaan Dasar</dt>
                <dd className="font-mono tabular-nums text-slate-700">&lt; 30%</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
