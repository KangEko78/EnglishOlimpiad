import { OlympiadQuestion } from '../types/olympiad';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportQuestionsAsJson(questions: OlympiadQuestion[], filename = 'bank-100-soal-olimpiade-2026.json') {
  const payload = {
    meta: {
      event: 'English Olympiad Competition 2026 (SMP/MTs)',
      organizer: 'MGMP Bahasa Inggris Kabupaten Banyuwangi',
      totalQuestions: questions.length,
      scoring: { correct: 4, wrong: -1, unanswered: 0 },
      exportedAt: new Date().toISOString(),
    },
    questions,
  };
  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json;charset=utf-8');
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${normalized}"`;
}

export function exportQuestionsAsCsv(questions: OlympiadQuestion[], filename = 'bank-100-soal-olimpiade-2026.csv') {
  const headers = [
    'No',
    'Kisi-Kisi',
    'Level Kognitif',
    'Taksonomi Bloom',
    'Topik',
    'Judul Teks',
    'Teks Bacaan',
    'Pertanyaan',
    'Opsi A',
    'Opsi B',
    'Opsi C',
    'Opsi D',
    'Kunci Jawaban',
    'Pembahasan',
  ];

  const rows = questions.map((q) =>
    [
      String(q.id),
      q.domain,
      q.cognitiveLevel,
      q.bloomTag,
      q.topic,
      q.passageTitle ?? '',
      q.passage ?? '',
      q.question,
      q.options.A,
      q.options.B,
      q.options.C,
      q.options.D,
      q.correctAnswer,
      q.explanation,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8');
}

export function exportQuestionsAsAiken(questions: OlympiadQuestion[], filename = 'bank-100-soal-aiken-moodle.txt') {
  const blocks = questions.map((q) => {
    const contextPart = q.passage ? `[${q.passageTitle ?? q.domain}] ${q.passage.replace(/\s+/g, ' ')} ` : '';
    const stem = `${q.id}. [${q.domain} | ${q.cognitiveLevel}] ${contextPart}${q.question.replace(/\s+/g, ' ')}`;
    return [
      stem,
      `A. ${q.options.A}`,
      `B. ${q.options.B}`,
      `C. ${q.options.C}`,
      `D. ${q.options.D}`,
      `ANSWER: ${q.correctAnswer}`,
    ].join('\n');
  });

  downloadBlob(blocks.join('\n\n'), filename, 'text/plain;charset=utf-8');
}

export function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
