import { useMemo, useState } from 'react';
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Printer,
  Search,
} from 'lucide-react';
import { getBankStatistics, QUESTION_BANK } from '../data/questionBank';
import { CognitiveLevel, SYLLABUS_BLUEPRINT, SyllabusDomain } from '../types/olympiad';
import {
  exportQuestionsAsAiken,
  exportQuestionsAsCsv,
  exportQuestionsAsJson,
} from '../utils/exportQuestions';

interface QuestionBankViewProps {
  onStartFocusedCbt: (domain: SyllabusDomain | 'ALL', level: CognitiveLevel | 'ALL') => void;
}

const COGNITIVE_LABEL: Record<CognitiveLevel, string> = {
  LOTS: 'LOTS · Dasar (C1–C2)',
  MOTS: 'MOTS · Menengah (C3–C4)',
  HOTS: 'HOTS · Tinggi (C4–C5)',
};

const COGNITIVE_STYLE: Record<CognitiveLevel, string> = {
  LOTS: 'text-emerald-700',
  MOTS: 'text-amber-700',
  HOTS: 'text-rose-700',
};

export function QuestionBankView({ onStartFocusedCbt }: QuestionBankViewProps) {
  const [selectedDomain, setSelectedDomain] = useState<SyllabusDomain | 'ALL'>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<CognitiveLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const [collapsedPassages, setCollapsedPassages] = useState<Record<string, boolean>>({});
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const stats = useMemo(() => getBankStatistics(), []);

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return QUESTION_BANK.filter((q) => {
      if (selectedDomain !== 'ALL' && q.domain !== selectedDomain) return false;
      if (selectedLevel !== 'ALL' && q.cognitiveLevel !== selectedLevel) return false;
      if (!query) return true;
      return (
        q.question.toLowerCase().includes(query) ||
        q.topic.toLowerCase().includes(query) ||
        (q.passageTitle?.toLowerCase().includes(query) ?? false) ||
        (q.passage?.toLowerCase().includes(query) ?? false) ||
        String(q.id) === query
      );
    });
  }, [selectedDomain, selectedLevel, searchQuery]);

  const togglePassage = (key: string) => {
    setCollapsedPassages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const triggerExportFeedback = (label: string) => {
    setExportFeedback(label);
    window.setTimeout(() => setExportFeedback(null), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header & Export Toolbar */}
      <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 pb-6 border-b border-slate-200 no-print">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-blue-700">
            Bank Soal Standar Olimpiade · Juknis MGMP Banyuwangi 2026
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            100 Soal Pilihan Ganda (LOTS, MOTS & HOTS)
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Telaah seluruh butir soal sesuai 7 kisi-kisi resmi, verifikasi kunci jawaban beserta rasionalnya, atau ekspor langsung ke format CBT (Aiken, CSV, JSON) maupun cetak naskah Paper-Based Test.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              exportQuestionsAsAiken(filteredQuestions);
              triggerExportFeedback(`Berhasil ekspor ${filteredQuestions.length} soal ke format Aiken (.txt)`);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Aiken (CBT)
          </button>
          <button
            type="button"
            onClick={() => {
              exportQuestionsAsCsv(filteredQuestions);
              triggerExportFeedback(`Berhasil ekspor ${filteredQuestions.length} soal ke CSV`);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              exportQuestionsAsJson(filteredQuestions);
              triggerExportFeedback(`Berhasil ekspor ${filteredQuestions.length} soal ke JSON`);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Naskah
          </button>
        </div>
      </section>

      {exportFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 no-print">
          <Check className="w-4 h-4 shrink-0" />
          <span>{exportFeedback}</span>
        </div>
      )}

      {/* Distribution & Filter Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Cognitive Level Segmented Control */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setSelectedLevel('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLevel === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Level ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLevel('LOTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLevel === 'LOTS'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              LOTS ({stats.byCognitive.LOTS})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLevel('MOTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLevel === 'MOTS'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MOTS ({stats.byCognitive.MOTS})
            </button>
            <button
              type="button"
              onClick={() => setSelectedLevel('HOTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLevel === 'HOTS'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              HOTS ({stats.byCognitive.HOTS})
            </button>
          </div>

          {/* Search & Key Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor, topik, atau kata kunci..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAnswerKey((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showAnswerKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showAnswerKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
            </button>

            <button
              type="button"
              onClick={() => onStartFocusedCbt(selectedDomain, selectedLevel)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Uji di CBT ({filteredQuestions.length} Soal)
            </button>
          </div>
        </div>

        {/* Domain Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedDomain('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedDomain === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            Semua Kisi-Kisi ({stats.total})
          </button>
          {SYLLABUS_BLUEPRINT.map((bp) => {
            const count = stats.byDomain[bp.domain].total;
            const active = selectedDomain === bp.domain;
            return (
              <button
                key={bp.domain}
                type="button"
                onClick={() => setSelectedDomain(bp.domain)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {bp.domain} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono tabular-nums">
          Menampilkan {filteredQuestions.length} dari {stats.total} soal
        </span>
        {(selectedDomain !== 'ALL' || selectedLevel !== 'ALL' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedDomain('ALL');
              setSelectedLevel('ALL');
              setSearchQuery('');
            }}
            className="text-blue-700 hover:underline font-medium cursor-pointer no-print"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">
            Tidak ada soal yang cocok dengan filter saat ini
          </p>
          <p className="text-sm text-slate-500">
            Ubah kata kunci pencarian atau pilih kombinasi kisi-kisi dan level kognitif lain.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredQuestions.map((q) => {
            const passageKey = `${q.id}-${q.passageId ?? 'none'}`;
            const isCollapsed = collapsedPassages[passageKey] ?? false;

            return (
              <article
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 break-inside-avoid"
              >
                {/* Clean Zero-Pill Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      Soal #{String(q.id).padStart(3, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{q.domain}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-semibold ${COGNITIVE_STYLE[q.cognitiveLevel]}`}>
                      {COGNITIVE_LABEL[q.cognitiveLevel]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{q.bloomTag}</span>
                  </div>
                  <span className="text-xs text-slate-500">{q.topic}</span>
                </div>

                {/* Passage Stimulus (if present) */}
                {q.passage && (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <BookOpenText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{q.passageTitle ?? 'Reading Stimulus'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePassage(passageKey)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer no-print"
                      >
                        {isCollapsed ? (
                          <>
                            <span>Buka Teks</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Lipat Teks</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="font-serif text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">
                        {q.passage}
                      </div>
                    )}
                  </div>
                )}

                {/* Question Stem */}
                <div className="text-[15px] font-medium text-slate-900 leading-relaxed whitespace-pre-line">
                  {q.question}
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const isCorrect = showAnswerKey && q.correctAnswer === opt;
                    return (
                      <div
                        key={opt}
                        className={`flex items-start gap-3 px-3.5 py-2.5 rounded-lg border text-sm transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`font-mono font-semibold text-xs mt-0.5 shrink-0 ${
                            isCorrect ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {opt}.
                        </span>
                        <span className="leading-snug flex-1">{q.options[opt]}</span>
                        {isCorrect && (
                          <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {showAnswerKey && (
                  <div className="pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-900">
                      Kunci {q.correctAnswer} — Pembahasan:{' '}
                    </span>
                    {q.explanation}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
