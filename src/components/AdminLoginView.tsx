import { FormEvent, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react';

interface AdminLoginViewProps {
  onSuccess: () => void;
  onBackToStudent: () => void;
}

const ADMIN_USER = 'olimpiad';
const ADMIN_PASS = 'smpn2kbr';

export function AdminLoginView({ onSuccess, onBackToStudent }: AdminLoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      setError(null);
      onSuccess();
    } else {
      setError('Username atau password Admin Panel tidak sesuai.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Login Admin Panel</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Akses khusus pembina & panitia untuk membuka hasil siswa, analisa kisi-kisi, bank 100 soal beserta kunci, dan konfigurasi database Apps Script.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="block text-xs font-semibold text-slate-700">
              Username Admin
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              Masuk ke Admin Panel
            </button>
            <button
              type="button"
              onClick={onBackToStudent}
              className="w-full py-2 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Ujian Siswa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
