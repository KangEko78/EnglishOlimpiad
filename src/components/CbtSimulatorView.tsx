import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock,
  Eraser,
  Flag,
  LayoutGrid,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
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

export function CbtSimulatorView({
  initialPreset,
  isAdminMode,
  onCompleteAttempt,
  onOpenAdminAnalytics,
}: CbtSimulatorViewProps) {
  const [student, setStudent] = useState<StudentProfile>({
    name: '',
    school: '',
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
        title: 'Simulasi Penuh Babak Penyisihan (Juknis 2026)',
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
      setFormError('Lengkapi Nama Siswa dan Asal Sekolah SMP/MTs terlebih dahulu sebelum memulai CBT.');
      return;
    }
    if (previewConfig.questionIds.length === 0) {
      setFormError('Kombinasi filter latihan menghasilkan 0 soal. Ubah pilihan kisi-kisi atau level.');
      return;
    }
    setFormError(null);
    setCompletedReceipt(null);
    setActiveSession(previewConfig);
    setStartedAtIso(new Date().toISOString());
    setCurrentIndex(0);
    setAnswers({});
    setFlaggedIds([]);
    setSecondsLeft(previewConfig.durationMinutes * 60);
    setShowSubmitConfirm(false);
  };

  // ================= STUDENT COMPLETION RECEIPT =================
  if (completedReceipt) {
    const receiptAnalysis = analyzeAttempt(completedReceipt.attempt);
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3.5 pb-5 border-b border-slate-100">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900">
                Ujian CBT Selesai & Tersimpan
              </h1>
              <p className="text-sm text-slate-600">
                {completedReceipt.attempt.student.name} · {completedReceipt.attempt.student.school} · Kelas {completedReceipt.attempt.student.grade}
              </p>
              <p className="text-xs text-slate-500">
                {completedReceipt.syncedToSheets
                  ? 'Hasil telah dikirim ke Database Spreadsheet Olimpiade dan siap ditelaah oleh Pembina di Admin Panel.'
                  : 'Hasil tersimpan pada perangkat ini. Pembina dapat menelaah analisa lengkap per kisi-kisi melalui Admin Panel.'}
              </p>
            </div>
          </div>

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

          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-blue-800">Predikat Kesiapan Saat Ini</div>
              <div className="text-sm font-bold text-slate-900">{receiptAnalysis.readinessTier}</div>
            </div>
            <div className="text-lg font-bold text-blue-700 font-mono tabular-nums">
              {receiptAnalysis.normalizedPercent}%
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCompletedReceipt(null);
                setStudent({ name: '', school: '', grade: '8' });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Mulai Sesi Peserta Berikutnya
            </button>

            {isAdminMode && onOpenAdminAnalytics && (
              <button
                type="button"
                onClick={() => onOpenAdminAnalytics(completedReceipt.attempt.id)}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                Buka Analisa Kisi-Kisi Lengkap
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= ACTIVE CBT WORKSPACE =================
  if (activeSession) {
    const currentQId = activeSession.questionIds[currentIndex];
    const currentQuestion = QUESTION_BY_ID[currentQId];
    const selectedOption = answers[currentQId];
    const isFlagged = flaggedIds.includes(currentQId);
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = activeSession.questionIds.length - answeredCount;
    const isLowTime = secondsLeft <= 300;

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
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            className={`${
              showQuestionNav ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-xl p-6 space-y-6`}
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
                    Jawaban yang dikumpulkan akan otomatis dinilai dengan sistem +4 / -1 / 0 dan dikirim ke database panitia.
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

  // ================= CBT LOBBY / SETUP SCREEN =================
  return (
    <div className="space-y-8">
      <section className="pb-6 border-b border-slate-200 space-y-2 max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          {JUKNIS_CONSTANTS.EVENT_NAME} · {JUKNIS_CONSTANTS.ORGANIZER}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
          Portal Ujian CBT Olimpiade Bahasa Inggris
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Isi identitas peserta dengan benar sebelum memulai ujian. Sistem menerapkan aturan skor resmi Babak Penyisihan (+4 benar, -1 salah, 0 kosong).
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
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
                  Asal Sekolah (SMP/MTs)
                </label>
                <input
                  id="student-school"
                  type="text"
                  value={student.school}
                  onChange={(e) => setStudent((s) => ({ ...s, school: e.target.value }))}
                  placeholder="Contoh: SMPN 2 Kabat"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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
            <h2 className="text-base font-semibold text-slate-900">2. Pilih Paket Ujian CBT</h2>

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
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                    100 Soal · 120 Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Seluruh 100 butir soal LOTS, MOTS, dan HOTS dengan durasi resmi 120 menit dan skor maksimal 400.
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
                    Tes Diagnostik Cepat Kisi-Kisi
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                    21 Soal · 25 Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  3 soal representatif (LOTS, MOTS, HOTS) dari masing-masing 7 kisi-kisi untuk pemetaan kemampuan secara cepat.
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
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-700">
                    {focusedQuestionIds.length} Soal ·{' '}
                    {Math.max(5, Math.ceil((focusedQuestionIds.length * 72) / 60))} Menit
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Pilih domain materi dan tingkat kesulitan tertentu sesuai arahan pembina olimpiade.
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

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleStartExam}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Mulai Ujian CBT Sekarang
            </button>
          </div>
        </div>

        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Ringkasan Paket Terpilih</h3>
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between gap-2">
              <dt className="text-slate-500">Paket</dt>
              <dd className="font-medium text-slate-900 text-right">{previewConfig.title}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-2">
              <dt className="text-slate-500">Jumlah Soal</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900">
                {previewConfig.questionIds.length} butir
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-2">
              <dt className="text-slate-500">Batas Waktu</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900">
                {previewConfig.durationMinutes} menit
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-2">
              <dt className="text-slate-500">Skor Maksimal</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900">
                {previewConfig.questionIds.length * 4} poin
              </dd>
            </div>
          </dl>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-900">Aturan Penilaian & Strategi:</p>
            <p>
              Jawaban benar bernilai <span className="font-mono font-semibold text-emerald-700">+4</span>, salah <span className="font-mono font-semibold text-rose-700">-1</span>, dan tidak dijawab <span className="font-mono font-semibold">0</span>. Gunakan tombol Kosongkan bila tidak yakin untuk menghindari pengurangan nilai.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
