import { Clock, ShieldCheck, Target } from 'lucide-react';
import { JUKNIS_CONSTANTS } from '../types/olympiad';

interface StudentGuideViewProps {
  onStartExam: () => void;
}

export function StudentGuideView({ onStartExam }: StudentGuideViewProps) {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <section className="pb-6 border-b border-slate-200 space-y-2">
        <p className="text-xs font-medium text-blue-700">
          {JUKNIS_CONSTANTS.ORGANIZER}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
          Tata Tertib & Petunjuk Pelaksanaan Ujian
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Bacalah ketentuan pelaksanaan dan sistem penilaian Olimpiade Bahasa Inggris SMP/MTs 2026 di bawah ini sebelum memulai ujian CBT.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Durasi Penyisihan</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            120 Menit
          </div>
          <p className="text-xs text-slate-500">100 soal pilihan ganda (A–D)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Target className="w-4 h-4 text-slate-400" />
            <span>Bobot Penilaian</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            +4 / -1 / 0
          </div>
          <p className="text-xs text-slate-500">Benar +4 · Salah -1 · Kosong 0</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>Kualifikasi Final</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            25 Finalis
          </div>
          <p className="text-xs text-slate-500">Melaju ke Babak Final Listening Test</p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Ketentuan Peserta Selama Ujian
        </h2>
        <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5 leading-relaxed">
          <li>Peserta adalah siswa aktif kelas 7, 8, atau 9 SMP/MTs Negeri dan Swasta se-Kabupaten Banyuwangi.</li>
          <li>Isi Nama Lengkap, Asal Sekolah, dan Kelas secara akurat sebelum menekan tombol mulai ujian.</li>
          <li>Peserta tidak diperkenankan menggunakan kamus cetak, kamus digital, maupun alat bantu penerjemah lainnya.</li>
          <li>Gunakan fitur <strong>Tandai Ragu-Ragu</strong> untuk meninjau ulang soal sulit, dan tombol <strong>Kosongkan (0 Poin)</strong> apabila tidak yakin agar terhindar dari penalti <strong>-1 poin</strong>.</li>
          <li>Waktu berjalan otomatis dan ujian akan terkumpul otomatis saat waktu habis.</li>
        </ol>

        <div className="pt-3">
          <button
            type="button"
            onClick={onStartExam}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            Lanjut ke Halaman Ujian CBT
          </button>
        </div>
      </section>
    </div>
  );
}
