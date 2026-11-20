import {
  AttemptAnalysis,
  CbtAttempt,
  CognitiveLevel,
  CognitivePerformance,
  DomainPerformance,
  JUKNIS_CONSTANTS,
  OlympiadQuestion,
  SYLLABUS_BLUEPRINT,
  SyllabusDomain,
} from '../types/olympiad';
import { QUESTIONS_READING_1 } from './questionsReading1';
import { QUESTIONS_READING_2 } from './questionsReading2';
import { QUESTIONS_GRAMMAR } from './questionsGrammar';
import { EXTRA_GRAMMAR_DRILL_QUESTIONS, GRAMMAR_50_BANK } from './grammarFocus50';

export { GRAMMAR_50_BANK };

export const QUESTION_BANK: OlympiadQuestion[] = [
  ...QUESTIONS_READING_1,
  ...QUESTIONS_READING_2,
  ...QUESTIONS_GRAMMAR,
].sort((a, b) => a.id - b.id);

export const QUESTION_BY_ID: Record<number, OlympiadQuestion> = Object.fromEntries(
  [...QUESTION_BANK, ...EXTRA_GRAMMAR_DRILL_QUESTIONS].map((q) => [q.id, q])
);

export function getBankStatistics() {
  const byDomain: Record<SyllabusDomain, { total: number; LOTS: number; MOTS: number; HOTS: number }> = {
    Descriptive: { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    Procedure: { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    Narrative: { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    Recount: { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    Report: { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    'Short Functional Text': { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
    'Grammar & Structure': { total: 0, LOTS: 0, MOTS: 0, HOTS: 0 },
  };

  const byCognitive: Record<CognitiveLevel, number> = {
    LOTS: 0,
    MOTS: 0,
    HOTS: 0,
  };

  for (const q of QUESTION_BANK) {
    byDomain[q.domain].total += 1;
    byDomain[q.domain][q.cognitiveLevel] += 1;
    byCognitive[q.cognitiveLevel] += 1;
  }

  return {
    total: QUESTION_BANK.length,
    byDomain,
    byCognitive,
  };
}

export function analyzeAttempt(attempt: CbtAttempt): AttemptAnalysis {
  const questions = attempt.questionIds
    .map((id) => QUESTION_BY_ID[id])
    .filter((q): q is OlympiadQuestion => Boolean(q));

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const domainAccum: Record<
    SyllabusDomain,
    { total: number; correct: number; wrong: number; unanswered: number }
  > = {
    Descriptive: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    Procedure: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    Narrative: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    Recount: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    Report: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    'Short Functional Text': { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    'Grammar & Structure': { total: 0, correct: 0, wrong: 0, unanswered: 0 },
  };

  const cogAccum: Record<
    CognitiveLevel,
    { total: number; correct: number; wrong: number; unanswered: number }
  > = {
    LOTS: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    MOTS: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
    HOTS: { total: 0, correct: 0, wrong: 0, unanswered: 0 },
  };

  for (const q of questions) {
    const picked = attempt.answers[q.id];
    domainAccum[q.domain].total += 1;
    cogAccum[q.cognitiveLevel].total += 1;

    if (!picked) {
      unansweredCount += 1;
      domainAccum[q.domain].unanswered += 1;
      cogAccum[q.cognitiveLevel].unanswered += 1;
    } else if (picked === q.correctAnswer) {
      correctCount += 1;
      domainAccum[q.domain].correct += 1;
      cogAccum[q.cognitiveLevel].correct += 1;
    } else {
      wrongCount += 1;
      domainAccum[q.domain].wrong += 1;
      cogAccum[q.cognitiveLevel].wrong += 1;
    }
  }

  const netScore =
    correctCount * JUKNIS_CONSTANTS.SCORE_CORRECT +
    wrongCount * JUKNIS_CONSTANTS.SCORE_WRONG;
  const maxScore = questions.length * JUKNIS_CONSTANTS.SCORE_CORRECT;
  const normalizedPercent = maxScore > 0 ? Math.max(0, Math.round((netScore / maxScore) * 100)) : 0;
  const answeredTotal = correctCount + wrongCount;
  const accuracyWhenAnswered = answeredTotal > 0 ? Math.round((correctCount / answeredTotal) * 100) : 0;
  const penaltyLostPoints = wrongCount * Math.abs(JUKNIS_CONSTANTS.SCORE_WRONG);

  const domainBreakdown: DomainPerformance[] = SYLLABUS_BLUEPRINT.map((bp) => {
    const stat = domainAccum[bp.domain];
    const acc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    const dNet = stat.correct * 4 - stat.wrong * 1;
    const dMax = stat.total * 4;
    let status: DomainPerformance['status'] = 'Siap';
    if (acc < 50) status = 'Prioritas Remedial';
    else if (acc < 75) status = 'Perlu Penguatan';

    return {
      domain: bp.domain,
      total: stat.total,
      correct: stat.correct,
      wrong: stat.wrong,
      unanswered: stat.unanswered,
      accuracyPercent: acc,
      netScore: dNet,
      maxPossibleScore: dMax,
      status,
    };
  }).filter((d) => d.total > 0);

  const cognitiveBreakdown: CognitivePerformance[] = (['LOTS', 'MOTS', 'HOTS'] as CognitiveLevel[])
    .map((level) => {
      const stat = cogAccum[level];
      const acc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      return {
        level,
        total: stat.total,
        correct: stat.correct,
        wrong: stat.wrong,
        unanswered: stat.unanswered,
        accuracyPercent: acc,
        netScore: stat.correct * 4 - stat.wrong * 1,
      };
    })
    .filter((c) => c.total > 0);

  const hotsStat = cognitiveBreakdown.find((c) => c.level === 'HOTS');
  const lotsStat = cognitiveBreakdown.find((c) => c.level === 'LOTS');
  const motsStat = cognitiveBreakdown.find((c) => c.level === 'MOTS');

  let readinessTier: AttemptAnalysis['readinessTier'] = 'Pembinaan Dasar';
  if (normalizedPercent >= 70 && (!hotsStat || hotsStat.accuracyPercent >= 60)) {
    readinessTier = 'Sangat Siap (Target Top 25 Finalis)';
  } else if (normalizedPercent >= 50) {
    readinessTier = 'Kompetitif (Potensi Lolos)';
  } else if (normalizedPercent >= 30) {
    readinessTier = 'Perlu Penguatan Intensif';
  }

  const recommendations: string[] = [];

  if (wrongCount > 0 && accuracyWhenAnswered < 65) {
    recommendations.push(
      `Strategi Penalti (+4/-1): Siswa kehilangan ${penaltyLostPoints} poin akibat ${wrongCount} jawaban salah. Latih keberanian mengosongkan soal yang belum yakin (0 poin lebih aman daripada -1).`
    );
  }

  if (lotsStat && lotsStat.accuracyPercent >= 75 && hotsStat && hotsStat.accuracyPercent < 55) {
    recommendations.push(
      `Kesenjangan Kognitif (LOTS ${lotsStat.accuracyPercent}% vs HOTS ${hotsStat.accuracyPercent}%): Pemahaman literal sudah kuat, namun perlu pembinaan khusus pada inferensi implisit, evaluasi argumen, dan soal jebakan multi-premis.`
    );
  } else if (lotsStat && lotsStat.accuracyPercent < 65) {
    recommendations.push(
      `Fondasi Dasar (LOTS ${lotsStat.accuracyPercent}%): Perkuat kosakata akademik kelas 7–9 dan struktur kalimat dasar sebelum memperbanyak latihan soal HOTS.`
    );
  }

  if (motsStat && motsStat.accuracyPercent < 60) {
    recommendations.push(
      `Ketelitian Analisis Menengah (MOTS ${motsStat.accuracyPercent}%): Tingkatkan latihan rujukan kata ganti, hubungan sebab-akibat antarparagraf, dan kalkulasi syarat pada teks fungsional.`
    );
  }

  const weakDomains = [...domainBreakdown]
    .filter((d) => d.accuracyPercent < 65)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

  if (weakDomains.length > 0) {
    const topWeak = weakDomains
      .slice(0, 2)
      .map((d) => `${d.domain} (${d.accuracyPercent}%)`)
      .join(' dan ');
    recommendations.push(
      `Prioritas Kisi-Kisi: Fokuskan sesi pembinaan berikutnya pada domain ${topWeak} yang akurasinya masih di bawah ambang kompetitif 65%.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Performa seimbang di seluruh kisi-kisi dan level kognitif. Tahap berikutnya: perbanyak simulasi Listening Test 20 soal untuk persiapan Babak Final Top 25.'
    );
  }

  return {
    correctCount,
    wrongCount,
    unansweredCount,
    netScore,
    maxScore,
    normalizedPercent,
    accuracyWhenAnswered,
    penaltyLostPoints,
    readinessTier,
    domainBreakdown,
    cognitiveBreakdown,
    recommendations,
  };
}
