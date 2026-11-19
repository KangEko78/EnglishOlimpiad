import { analyzeAttempt } from '../data/questionBank';
import { CbtAttempt, OptionKey } from '../types/olympiad';

export const SPREADSHEET_ID = '1h9rnGrXYQfke0V8fT6C_ARe73W4UWqH_yk8KVSxV5SA';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

export const CODE_GS_SOURCE = `/**
 * Google Apps Script Web App — English Olympiad Competition 2026
 * Database Spreadsheet ID: ${SPREADSHEET_ID}
 *
 * Cara Deploy:
 * 1. Buka https://script.google.com -> New Project (atau Extensions > Apps Script dari Spreadsheet).
 * 2. Tempel seluruh kode ini ke file Code.gs, lalu tekan Ctrl+S (Save).
 * 3. Pilih fungsi "setupOlympiadSystem" di dropdown atas lalu klik Run (sekali saja untuk izin & buat sheet).
 * 4. Klik Deploy > New deployment > Type: Web app.
 * 5. Execute as: "Me", Who has access: "Anyone".
 * 6. Salin Web App URL (akhiran /exec) dan tempel ke Admin Panel -> Code.gs & DB.
 */

const SPREADSHEET_ID = '${SPREADSHEET_ID}';
const SHEET_RESULTS = 'Hasil_CBT';

const HEADERS = [
  'Timestamp',
  'Attempt_ID',
  'Nama_Siswa',
  'Asal_Sekolah',
  'Kelas',
  'Mode_Ujian',
  'Judul_Paket',
  'Durasi_Detik',
  'Total_Soal',
  'Benar',
  'Salah',
  'Kosong',
  'Skor_Olimpiade',
  'Skor_Maksimal',
  'Indeks_Kesiapan_Persen',
  'Status_Kesiapan',
  'Akurasi_Terjawab_Persen',
  'Poin_Hilang_Penalti',
  'Descriptive_Persen',
  'Procedure_Persen',
  'Narrative_Persen',
  'Recount_Persen',
  'Report_Persen',
  'SFT_Persen',
  'Grammar_Persen',
  'LOTS_Persen',
  'MOTS_Persen',
  'HOTS_Persen',
  'Question_IDs_JSON',
  'Answers_JSON'
];

function setupOlympiadSystem() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_();
  Logger.log('Setup berhasil! Spreadsheet: ' + ss.getName() + ' | Sheet: ' + sheet.getName());
  return 'OK: ' + sheet.getName();
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_RESULTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RESULTS);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet_();

    if (action === 'ping') {
      return jsonResponse_({
        ok: true,
        spreadsheetName: ss.getName(),
        sheetName: sheet.getName(),
        rowCount: Math.max(0, sheet.getLastRow() - 1)
      });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse_({ ok: true, attempts: [] });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const attempts = values
      .filter(function(row) { return row[1]; })
      .map(function(row) {
        let questionIds = [];
        let answers = {};
        try { questionIds = JSON.parse(row[28] || '[]'); } catch (err) {}
        try { answers = JSON.parse(row[29] || '{}'); } catch (err) {}

        return {
          id: String(row[1]),
          student: {
            name: String(row[2] || ''),
            school: String(row[3] || ''),
            grade: String(row[4] || '8')
          },
          mode: String(row[5] || 'full_preliminary'),
          configTitle: String(row[6] || ''),
          startedAt: String(row[0] || ''),
          completedAt: String(row[0] || ''),
          durationUsedSeconds: Number(row[7] || 0),
          totalQuestions: Number(row[8] || questionIds.length),
          questionIds: questionIds,
          answers: answers,
          flaggedIds: []
        };
      })
      .reverse();

    return jsonResponse_({ ok: true, attempts: attempts });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || 'saveAttempt';
    const sheet = getOrCreateSheet_();

    if (action === 'deleteAttempt' && body.attemptId) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(body.attemptId)) {
            sheet.deleteRow(i + 2);
            return jsonResponse_({ ok: true, deleted: true });
          }
        }
      }
      return jsonResponse_({ ok: true, deleted: false });
    }

    const attempt = body.attempt;
    const summary = body.summary || {};
    if (!attempt || !attempt.id) {
      return jsonResponse_({ ok: false, error: 'Invalid attempt payload' });
    }

    // Prevent duplicate Attempt_ID rows
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const existingIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (let i = 0; i < existingIds.length; i++) {
        if (String(existingIds[i][0]) === String(attempt.id)) {
          return jsonResponse_({ ok: true, duplicate: true, id: attempt.id });
        }
      }
    }

    const domainMap = summary.domainMap || {};
    const cogMap = summary.cogMap || {};

    const row = [
      attempt.completedAt || new Date().toISOString(),
      attempt.id,
      attempt.student ? attempt.student.name : '',
      attempt.student ? attempt.student.school : '',
      attempt.student ? attempt.student.grade : '',
      attempt.mode || 'full_preliminary',
      attempt.configTitle || '',
      Number(attempt.durationUsedSeconds || 0),
      Number(attempt.totalQuestions || 0),
      Number(summary.correctCount || 0),
      Number(summary.wrongCount || 0),
      Number(summary.unansweredCount || 0),
      Number(summary.netScore || 0),
      Number(summary.maxScore || 0),
      Number(summary.normalizedPercent || 0),
      String(summary.readinessTier || ''),
      Number(summary.accuracyWhenAnswered || 0),
      Number(summary.penaltyLostPoints || 0),
      domainMap['Descriptive'] != null ? domainMap['Descriptive'] : '',
      domainMap['Procedure'] != null ? domainMap['Procedure'] : '',
      domainMap['Narrative'] != null ? domainMap['Narrative'] : '',
      domainMap['Recount'] != null ? domainMap['Recount'] : '',
      domainMap['Report'] != null ? domainMap['Report'] : '',
      domainMap['Short Functional Text'] != null ? domainMap['Short Functional Text'] : '',
      domainMap['Grammar & Structure'] != null ? domainMap['Grammar & Structure'] : '',
      cogMap['LOTS'] != null ? cogMap['LOTS'] : '',
      cogMap['MOTS'] != null ? cogMap['MOTS'] : '',
      cogMap['HOTS'] != null ? cogMap['HOTS'] : '',
      JSON.stringify(attempt.questionIds || []),
      JSON.stringify(attempt.answers || {})
    ];

    sheet.appendRow(row);
    return jsonResponse_({ ok: true, id: attempt.id });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}
`;

export interface PingResult {
  ok: boolean;
  spreadsheetName?: string;
  sheetName?: string;
  rowCount?: number;
  error?: string;
}

export async function pingAppsScript(webAppUrl: string): Promise<PingResult> {
  const url = `${webAppUrl.trim()}${webAppUrl.includes('?') ? '&' : '?'}action=ping`;
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  return (await res.json()) as PingResult;
}

export async function fetchAttemptsFromSheets(webAppUrl: string): Promise<CbtAttempt[]> {
  const url = `${webAppUrl.trim()}${webAppUrl.includes('?') ? '&' : '?'}action=list`;
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Gagal memuat data Spreadsheet (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { ok: boolean; attempts?: CbtAttempt[]; error?: string };
  if (!data.ok) {
    throw new Error(data.error || 'Respons Apps Script tidak valid');
  }

  return (data.attempts ?? []).map((att) => {
    const cleanAnswers: Record<number, OptionKey> = {};
    if (att.answers && typeof att.answers === 'object') {
      for (const [k, v] of Object.entries(att.answers)) {
        const num = Number(k);
        if (!Number.isNaN(num) && (v === 'A' || v === 'B' || v === 'C' || v === 'D')) {
          cleanAnswers[num] = v;
        }
      }
    }
    return {
      ...att,
      answers: cleanAnswers,
      questionIds: Array.isArray(att.questionIds) ? att.questionIds.map(Number) : [],
      flaggedIds: Array.isArray(att.flaggedIds) ? att.flaggedIds.map(Number) : [],
    };
  });
}

export async function pushAttemptToSheets(
  webAppUrl: string,
  attempt: CbtAttempt
): Promise<{ ok: boolean; error?: string }> {
  const analysis = analyzeAttempt(attempt);
  const domainMap: Record<string, number> = {};
  for (const d of analysis.domainBreakdown) {
    domainMap[d.domain] = d.accuracyPercent;
  }
  const cogMap: Record<string, number> = {};
  for (const c of analysis.cognitiveBreakdown) {
    cogMap[c.level] = c.accuracyPercent;
  }

  const payload = {
    action: 'saveAttempt',
    attempt,
    summary: {
      correctCount: analysis.correctCount,
      wrongCount: analysis.wrongCount,
      unansweredCount: analysis.unansweredCount,
      netScore: analysis.netScore,
      maxScore: analysis.maxScore,
      normalizedPercent: analysis.normalizedPercent,
      readinessTier: analysis.readinessTier,
      accuracyWhenAnswered: analysis.accuracyWhenAnswered,
      penaltyLostPoints: analysis.penaltyLostPoints,
      domainMap,
      cogMap,
    },
  };

  // Use text/plain to avoid CORS preflight failures on Google Apps Script Web Apps
  const res = await fetch(webAppUrl.trim(), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  const json = (await res.json()) as { ok: boolean; error?: string };
  return json;
}

export async function deleteAttemptFromSheets(
  webAppUrl: string,
  attemptId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(webAppUrl.trim(), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteAttempt', attemptId }),
  });

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  const json = (await res.json()) as { ok: boolean; error?: string };
  return json;
}
