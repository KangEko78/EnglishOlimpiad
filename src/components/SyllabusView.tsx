import { BookOpen, CheckCircle2, Clock, FileWarning, Target } from 'lucide-react';
import { getBankStatistics } from '../data/questionBank';
import { JUKNIS_CONSTANTS, SYLLABUS_BLUEPRINT } from '../types/olympiad';

interface SyllabusViewProps {
  onStartFullCbt: () => void;
  onBrowseBank: () => void;
}

export function SyllabusView({ onStartFullCbt, onBrowseBank }: SyllabusViewProps) {
  const stats = getBankStatistics();

  return (
    <div className="space-y-10">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-slate-200">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-medium tracking-wide text-blue-700">
            Dokumen Acuan Resmi · {JUKNIS_CONSTANTS.ORGANIZER}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Matriks Kisi-Kisi & Standar Olimpiade 2026
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Seluruh 100 butir soal pilihan ganda disusun berdasarkan Bab C–E Petunjuk Teknis English Olympiad Competition tingkat SMP/MTs se-Kabupaten Banyuwangi Tahun 2026, dengan proporsi kognitif LOTS, MOTS, dan HOTS yang terukur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onBrowseBank}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tinjau 100 Soal
          </button>
          <button
            type="button"
            onClick={onStartFullCbt}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Mulai Simulasi 120 Menit
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Babak Penyisihan</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {JUKNIS_CONSTANTS.PRELIMINARY_QUESTIONS} Soal
          </p>
          <p className="mt-1 text-xs text-slate-500">Pilihan ganda A–D · Paper / CBT</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Durasi Pengerjaan</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {JUKNIS_CONSTANTS.PRELIMINARY_DURATION_MINUTES} Menit
          </p>
          <p className="mt-1 text-xs text-slate-500">Rata-rata 72 detik per butir soal</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Aturan Penilaian</span>
            <Target className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            +4 / -1 / 0
          </p>
          <p className="mt-1 text-xs text-slate-500">Skor maksimal 400 · Penalti salah -1</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Kuota Babak Final</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            25 Finalis
          </p>
          <p className="mt-1 text-xs text-slate-500">Dilanjutkan 20 soal Listening Test</p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Distribusi Kisi-Kisi & Level Kognitif (100 Soal)
            </h2>
            <p className="text-sm text-slate-500">
              Pemetaan jumlah soal berdasarkan cakupan materi kelas 7–9 dan tingkat kedalaman Olimpiade.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            Total: {stats.byCognitive.LOTS} LOTS · {stats.byCognitive.MOTS} MOTS · {stats.byCognitive.HOTS} HOTS
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-6">Domain Kisi-Kisi</th>
                <th className="py-3.5 px-4">Fokus Standar Olimpiade</th>
                <th className="py-3.5 px-4 text-right font-mono">LOTS</th>
                <th className="py-3.5 px-4 text-right font-mono">MOTS</th>
                <th className="py-3.5 px-4 text-right font-mono">HOTS</th>
                <th className="py-3.5 px-6 text-right font-mono">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {SYLLABUS_BLUEPRINT.map((bp) => {
                const counts = stats.byDomain[bp.domain];
                return (
                  <tr key={bp.domain} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 align-top">
                      <div className="font-semibold text-slate-900">{bp.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{bp.juknisScope}</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 max-w-md">
                      {bp.olympiadFocus}
                    </td>
                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-emerald-700 font-medium">
                      {counts.LOTS}
                    </td>
                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-amber-700 font-medium">
                      {counts.MOTS}
                    </td>
                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-rose-700 font-medium">
                      {counts.HOTS}
                    </td>
                    <td className="py-4 px-6 align-top text-right font-mono tabular-nums font-bold text-slate-900">
                      {counts.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900">
                <td className="py-3.5 px-6" colSpan={2}>
                  Total Keseluruhan Bank Soal Penyisihan
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                  {stats.byCognitive.LOTS} (25%)
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700">
                  {stats.byCognitive.MOTS} (40%)
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-rose-700">
                  {stats.byCognitive.HOTS} (35%)
                </td>
                <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                  {stats.total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Jadwal Resmi Juknis 2026
          </h3>
          <dl className="divide-y divide-slate-200 text-sm">
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-600">Sosialisasi & Pendaftaran Online</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">17 Okt – 28 Nov 2026</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-600">Technical Meeting (Zoom)</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">12 November 2026</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-600">Pelaksanaan Lomba Offline (Penyisihan & Final)</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">2 Desember 2026</dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-600">Penyerahan Trophy & Sertifikat</dt>
              <dd className="font-mono tabular-nums text-slate-900 text-right">2 Desember 2026</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <FileWarning className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-base font-semibold">
              Catatan Penyelarasan dari Juknis Asli
            </h3>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed list-disc pl-5">
            <li>
              Bagian C Juknis belum merinci materi <span className="font-medium text-slate-900">Listening Test</span> untuk 25 finalis; modul soal saat ini difokuskan pada 100 butir <span className="font-medium text-slate-900">Babak Penyisihan</span>.
            </li>
            <li>
              Pada halaman 3 Juknis masih terdapat catatan draft <span className="italic">"(Buatkan google form pengumpulan link video)"</span> yang tidak relevan dengan lomba Paper-Based Test.
            </li>
            <li>
              Dalam simulasi CBT aplikasi ini, aturan penalti <span className="font-mono font-medium text-slate-900">+4 / -1 / 0</span> diterapkan secara ketat agar siswa terbiasa mengelola risiko menebak jawaban.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
