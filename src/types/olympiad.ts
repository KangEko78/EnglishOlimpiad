export type SyllabusDomain =
  | 'Descriptive'
  | 'Procedure'
  | 'Narrative'
  | 'Recount'
  | 'Report'
  | 'Short Functional Text'
  | 'Grammar & Structure';

export type CognitiveLevel = 'LOTS' | 'MOTS' | 'HOTS';

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface OlympiadQuestion {
  id: number;
  domain: SyllabusDomain;
  cognitiveLevel: CognitiveLevel;
  bloomTag: string;
  topic: string;
  passageId?: string;
  passageTitle?: string;
  passage?: string;
  question: string;
  options: Record<OptionKey, string>;
  correctAnswer: OptionKey;
  explanation: string;
}

export interface DomainBlueprint {
  domain: SyllabusDomain;
  label: string;
  juknisScope: string;
  targetCount: number;
  olympiadFocus: string;
}

export interface StudentProfile {
  name: string;
  school: string;
  grade: '7' | '8' | '9';
}

export interface CbtSessionConfig {
  mode: 'full_preliminary' | 'focused_drill';
  title: string;
  questionIds: number[];
  durationMinutes: number;
}

export interface CbtAttempt {
  id: string;
  student: StudentProfile;
  mode: 'full_preliminary' | 'focused_drill';
  configTitle: string;
  startedAt: string;
  completedAt: string;
  durationUsedSeconds: number;
  totalQuestions: number;
  questionIds: number[];
  answers: Record<number, OptionKey>;
  flaggedIds: number[];
}

export interface DomainPerformance {
  domain: SyllabusDomain;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracyPercent: number;
  netScore: number;
  maxPossibleScore: number;
  status: 'Siap' | 'Perlu Penguatan' | 'Prioritas Remedial';
}

export interface CognitivePerformance {
  level: CognitiveLevel;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracyPercent: number;
  netScore: number;
}

export interface AttemptAnalysis {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  netScore: number;
  maxScore: number;
  normalizedPercent: number;
  accuracyWhenAnswered: number;
  penaltyLostPoints: number;
  readinessTier: 'Sangat Siap (Target Top 25 Finalis)' | 'Kompetitif (Potensi Lolos)' | 'Perlu Penguatan Intensif' | 'Pembinaan Dasar';
  domainBreakdown: DomainPerformance[];
  cognitiveBreakdown: CognitivePerformance[];
  recommendations: string[];
}

export const JUKNIS_CONSTANTS = {
  SCHOOL_NAME: 'SMP Negeri 2 Kalibaru',
  SCHOOL_SHORT: 'SMPN 2 Kalibaru',
  EVENT_NAME: 'English Olympiad Competition 2026',
  ORGANIZER: 'MGMP Bahasa Inggris SMP Kabupaten Banyuwangi',
  PRELIMINARY_QUESTIONS: 100,
  PRELIMINARY_DURATION_MINUTES: 120,
  FINALISTS_QUOTA: 25,
  BEST_FINALISTS_QUOTA: 5,
  FINAL_LISTENING_QUESTIONS: 20,
  SCORE_CORRECT: 4,
  SCORE_WRONG: -1,
  SCORE_UNANSWERED: 0,
} as const;

export const SYLLABUS_BLUEPRINT: DomainBlueprint[] = [
  {
    domain: 'Descriptive',
    label: 'Descriptive Text',
    juknisScope: 'Identifikasi ciri spesifik tempat, tokoh, benda, dan fenomena (Kelas 7–9)',
    targetCount: 12,
    olympiadFocus: 'Detail tersirat, rujukan kata ganti, makna kontekstual, dan sudut pandang penulis',
  },
  {
    domain: 'Procedure',
    label: 'Procedure Text',
    juknisScope: 'Langkah kerja, manual teknis, eksperimen sains, dan protokol keselamatan',
    targetCount: 12,
    olympiadFocus: 'Logika urutan, dampak jika satu langkah dilewati/diubah, dan instruksi bersyarat',
  },
  {
    domain: 'Narrative',
    label: 'Narrative Text',
    juknisScope: 'Cerita rakyat, fabel, legenda, dan fiksi bermuatan nilai moral',
    targetCount: 15,
    olympiadFocus: 'Konflik & resolusi, karakterisasi tokoh, pesan moral tersirat, dan gaya bahasa',
  },
  {
    domain: 'Recount',
    label: 'Recount Text',
    juknisScope: 'Pengalaman pribadi, catatan perjalanan, dan biografi tokoh sejarah/sains',
    targetCount: 12,
    olympiadFocus: 'Kronologi sebab-akibat, pembedaan fakta vs refleksi penulis, dan perubahan sikap',
  },
  {
    domain: 'Report',
    label: 'Report Text',
    juknisScope: 'Teks faktual ilmiah tentang alam, teknologi, ekologi, dan fenomena sosial',
    targetCount: 14,
    olympiadFocus: 'Generalisasi ilmiah, klasifikasi objek, sintesis data, dan implikasi ekologis',
  },
  {
    domain: 'Short Functional Text',
    label: 'Short Functional Text',
    juknisScope: 'Pengumuman, label produk/obat, jadwal acara, iklan, memo, dan peringatan',
    targetCount: 13,
    olympiadFocus: 'Kalkulasi syarat & pengecualian (exception traps), target audiens, dan implikasi tindakan',
  },
  {
    domain: 'Grammar & Structure',
    label: 'Grammar & Structure',
    juknisScope: 'Tenses, Passive, Conditional, Clauses, Modals, Concord, Parallelism, Error Analysis',
    targetCount: 22,
    olympiadFocus: 'Ketepatan sintaksis tingkat lanjut, transformasi kalimat, dan deteksi kesalahan halus',
  },
];
